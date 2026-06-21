import type { Position } from "@lp-guardian/core";
import { config, resolvePortfolio } from "../config.js";
import { suiClient, discoveryClient } from "../chain/suiClient.js";
import { DEMO_POSITIONS } from "../services/mockData.js";
import { deepbookClient } from "../services/deepbookClient.js";
import { Network, TurbosSdk } from "turbos-clmm-sdk";
import * as supabaseService from "../services/supabaseService.js";
import { pythClient } from "../services/pythClient.js";

/**
 * Canonical token for correlation/pricing. ETH-family wrappers collapse to ETH so
 * WETH/stETH positions join the ETH cluster and share one price series (otherwise
 * the hero "87% is one ETH bet" splits apart).
 */
export function canonicalToken(sym: string): string {
  const s = (sym ?? "").trim().toUpperCase();
  if (s === "WETH" || s === "STETH" || s === "WSTETH" || s === "WEETH") return "ETH";
  if (s === "WBTC" || s === "TBTC" || s === "LBTC") return "BTC";
  return s;
}

const turbosSdk = new TurbosSdk(
  config.sui.network === "mainnet" ? Network.mainnet : Network.testnet,
  suiClient as any
);

/**
 * Scout â€” discovers all LP positions for a wallet as Sui on-chain objects,
 * enriches them using public DEX REST APIs (Cetus/Turbos), and pulls historical
 * price feeds for correlation analysis.
 */
export const scout = {
  async discoverPositions(walletAddress: string): Promise<Position[]> {
    if (config.mockMode) return DEMO_POSITIONS;

    const { portfolioId } = resolvePortfolio(walletAddress);
    if (!portfolioId || portfolioId === "0x0") {
      console.warn("[Scout] No portfolio ID configured, falling back to mock");
      return DEMO_POSITIONS;
    }

    try {
      // 1. Get dynamic field children (Position objects) from the Portfolio shared object
      const dfRes = await suiClient.getDynamicFields({ parentId: portfolioId });
      
      // Position objects are stored with numeric keys (0, 1, 2, ...). Sort by that
      // key so our array index matches the on-chain dof index â€” `rebalance` applies
      // new_value_usd[j] to position[j], so order MUST be deterministic.
      const positionDFs = dfRes.data
        .filter(df =>
          df.objectType.includes("::lp_guardian::Position") ||
          typeof df.name.value === "number"
        )
        .sort((a, b) => Number(a.name.value) - Number(b.name.value));

      if (positionDFs.length === 0) {
        console.warn("[Scout] No positions found in portfolio");
        return [];
      }

      // 2. Fetch the actual Position objects
      const positionIds = positionDFs.map(df => df.objectId);
      const objects = await suiClient.multiGetObjects({
        ids: positionIds,
        options: { showContent: true },
      });

      const positions = objects
        .map(obj => mapObjectToPosition(obj))
        .filter((p): p is Position => p !== null);

      if (positions.length === 0) {
        return [];
      }

      // 3. Fetch Cetus pool metadata from REST API to enrich inRange status
      const cetusPools = await fetchCetusPools();

      // Enrich positions with pool state
      for (const pos of positions) {
        if (pos.protocol === "cetus") {
          const cetusPool = cetusPools.find(p => p.pool_address === pos.poolId);
          if (cetusPool) {
            const currentTick = Number(cetusPool.current_tick);
            // Positions contain tick limits. We assume they are stored as numbers in our fields.
            // Under normal CLMM, if current_tick is outside [tick_lower, tick_upper], it's out of range.
            const tickLower = (pos as any).tickLower ?? 0;
            const tickUpper = (pos as any).tickUpper ?? 0;
            if (tickLower !== 0 || tickUpper !== 0) {
              pos.inRange = currentTick >= tickLower && currentTick <= tickUpper;
            }
          }
        } else if (pos.protocol === "turbos") {
          try {
            const pool = await turbosSdk.pool.getPool(pos.poolId);
            const currentTick = Number((pool as any).tick_current_index?.fields?.bits || (pool as any).tickCurrentIndex || (pool as any).tick_current_index || 0);
            const tickLower = (pos as any).tickLower ?? 0;
            const tickUpper = (pos as any).tickUpper ?? 0;
            if (tickLower !== 0 || tickUpper !== 0) {
              pos.inRange = currentTick >= tickLower && currentTick <= tickUpper;
            }
          } catch (err) {
            console.error(`[scout] failed to fetch Turbos pool ${pos.poolId}:`, err);
          }
        } else if (pos.protocol === "deepbook") {
          const dbData = await deepbookClient.getLiquidityProfile(pos.poolId, pos.tokenX, pos.tokenY);
          (pos as any).deepBookData = dbData;
          // For DeepBook, a very wide spread implies poor liquidity/unhealthy pool
          if (dbData.spreadBps > 100) pos.inRange = false;
        }
      }

    
    // Initialize baseline prices in Supabase if empty (first-time setup)
    if (config.supabase.url) {
      const existingBaselines = await supabaseService.getBaselinePrices(walletAddress).catch(() => ({}));
      const hasBaselines = Object.keys(existingBaselines).length > 0;
      
      if (!hasBaselines && positions.length > 0) {
        const uniqueTokens = Array.from(new Set(positions.map(p => p.token).filter(Boolean)));
        if (uniqueTokens.length > 0) {
          const initialPrices = await pythClient.getCurrentPrices(uniqueTokens as string[]).catch(() => ({}));
          await supabaseService.setBaselinePrices(walletAddress, portfolioId, initialPrices).catch(console.error);
          console.log(`[scout] Initial baseline prices set for ${walletAddress.slice(0, 10)}...`);
        }
      }
    }
      return positions;
    } catch (err) {
      console.error("[scout] failed to discover positions on-chain, falling back to demo:", err);
      return DEMO_POSITIONS;
    }
  },

  /**
   * Fetch historical prices from Pyth Benchmarks TV Shim, keyed by CANONICAL
   * symbol (WETH/stETH â†’ ETH) so the keys line up with `position.token`. Returns
   * `{}` when nothing usable is found â€” BE Data then sources prices itself and
   * labels the provenance (we never silently substitute fake numbers here).
   */
  async priceHistory(tokens: string[]): Promise<Record<string, number[]>> {
    if (config.mockMode) return {}; // let BE Data synthesize (single, labeled source)

    const history: Record<string, number[]> = {};
    const toTimestamp = Math.floor(Date.now() / 1000);
    const fromTimestamp = toTimestamp - 30 * 24 * 60 * 60; // 30 days ago

    // Canonicalize + de-dup so the ETH family is fetched once and shares a series.
    const canon = Array.from(new Set(tokens.map((t) => canonicalToken(t.split("::").pop() || t))));

    try {
      for (const symbol of canon) {
        if (history[symbol]) continue;
        const prices = await fetchPythHistoricalPrices(symbol, fromTimestamp, toTimestamp);
        if (prices.length > 0) history[symbol] = prices;
      }
      return history; // may be {} â€” BE Data fills + labels it
    } catch (err) {
      console.error("[scout] failed to fetch real price history; BE Data will source it:", err);
      return {};
    }
  },

  /**
   * Discover a wallet's REAL Cetus LP positions on MAINNET (read-only). Unlike
   * `discoverPositions` (which reads our Portfolio shared object), this scans the
   * wallet's owned Cetus position NFTs and estimates USD value directly on-chain
   * (CLMM amounts from liquidity + tick range + pool sqrt price Ã— Pyth spot).
   * Returns [] when the wallet holds no Cetus positions.
   */
  async discoverWalletPositions(walletAddress: string): Promise<Position[]> {
    const posType = `${config.discovery.cetusPkg}::position::Position`;
    const owned = await discoveryClient.getOwnedObjects({
      owner: walletAddress,
      filter: { StructType: posType },
      options: { showContent: true },
    });

    const fieldsList = (owned.data ?? [])
      .map((o) => o.data?.content as any)
      .filter((c) => c && c.dataType === "moveObject")
      .map((c) => c.fields);
    if (fieldsList.length === 0) return [];

    // Read each unique pool's current sqrt price once.
    const poolIds = Array.from(new Set(fieldsList.map((f: any) => f.pool)));
    const poolSqrt = new Map<string, number>();
    await Promise.all(
      poolIds.map(async (pid) => {
        try {
          const o = await discoveryClient.getObject({
            id: pid as string,
            options: { showContent: true },
          });
          const x64 = Number((o.data?.content as any)?.fields?.current_sqrt_price ?? 0);
          poolSqrt.set(pid as string, x64 / 2 ** 64);
        } catch {
          poolSqrt.set(pid as string, 0);
        }
      })
    );

    const positions: Position[] = [];
    for (const f of fieldsList as any[]) {
      const poolId = f.pool as string;
      const liquidity = Number(f.liquidity);
      const tickLower = decodeI32(f.tick_lower_index);
      const tickUpper = decodeI32(f.tick_upper_index);
      const typeA = coinTypeOf(f.coin_type_a);
      const typeB = coinTypeOf(f.coin_type_b);
      const symA = symbolOfType(typeA);
      const symB = symbolOfType(typeB);

      const sqrt = poolSqrt.get(poolId) ?? 0;
      const { rawA, rawB } = clmmAmounts(liquidity, tickLower, tickUpper, sqrt);
      const [decA, decB, priceA, priceB] = await Promise.all([
        coinDecimals(typeA),
        coinDecimals(typeB),
        spotPriceUSD(symA),
        spotPriceUSD(symB),
      ]);
      const valueUSD = (rawA / 10 ** decA) * priceA + (rawB / 10 ** decB) * priceB;
      const sqrtLower = Math.pow(1.0001, tickLower / 2);
      const sqrtUpper = Math.pow(1.0001, tickUpper / 2);

      positions.push({
        objectId: f.id?.id ?? "",
        protocol: "cetus",
        poolId,
        pair: `${symA}-${symB}`,
        tokenX: symA,
        tokenY: symB,
        token: canonicalToken(symA),
        valueUSD: Math.round(valueUSD * 100) / 100,
        inRange: sqrt > sqrtLower && sqrt < sqrtUpper,
        daysOutOfRange: 0,
        isDust: valueUSD < 5,
      });
    }
    return positions;
  },
};

// ---- Wallet-discovery helpers (CLMM math + on-chain metadata + Pyth spot) ----

/** i32 stored as { fields: { bits: u32 } }; values â‰¥ 2^31 are negative. */
function decodeI32(wrapped: any): number {
  const bits = Number(wrapped?.fields?.bits ?? wrapped?.bits ?? wrapped ?? 0);
  return bits >= 2 ** 31 ? bits - 2 ** 32 : bits;
}

/** Cetus stores coin types as TypeName { name } (no 0x prefix). */
function coinTypeOf(wrapped: any): string {
  const n = wrapped?.fields?.name ?? wrapped?.name ?? wrapped;
  return typeof n === "string" ? "0x" + String(n).replace(/^0x/, "") : String(n);
}

function symbolOfType(type: string): string {
  return (type.split("::").pop() || type).toUpperCase();
}

/** Token amounts (raw, pre-decimals) for a CLMM position. */
function clmmAmounts(L: number, tickLower: number, tickUpper: number, currentSqrt: number) {
  const pa = Math.pow(1.0001, tickLower / 2);
  const pb = Math.pow(1.0001, tickUpper / 2);
  const sc = currentSqrt;
  let rawA = 0;
  let rawB = 0;
  if (sc <= pa) rawA = L * (1 / pa - 1 / pb);
  else if (sc >= pb) rawB = L * (pb - pa);
  else {
    rawA = L * (1 / sc - 1 / pb);
    rawB = L * (sc - pa);
  }
  return { rawA, rawB };
}

const _decCache = new Map<string, number>();
async function coinDecimals(type: string): Promise<number> {
  if (_decCache.has(type)) return _decCache.get(type)!;
  try {
    const m = await discoveryClient.getCoinMetadata({ coinType: type });
    const d = m?.decimals ?? 9;
    _decCache.set(type, d);
    return d;
  } catch {
    return 9;
  }
}

const _priceCache = new Map<string, number>();
const PYTH_FEED: Record<string, string> = {
  SUI: "Crypto.SUI/USD", ETH: "Crypto.ETH/USD", WETH: "Crypto.ETH/USD",
  STETH: "Crypto.ETH/USD", BTC: "Crypto.BTC/USD", WBTC: "Crypto.BTC/USD",
  USDC: "Crypto.USDC/USD", USDT: "Crypto.USDT/USD", CETUS: "Crypto.CETUS/USD",
  DEEP: "Crypto.DEEP/USD", NS: "Crypto.NS/USD", WAL: "Crypto.WAL/USD",
};
const _STABLES = ["USDC", "USDT", "SUIUSDT", "USDY", "BUCK", "AUSD", "FDUSD"];
async function spotPriceUSD(symbol: string): Promise<number> {
  if (_STABLES.includes(symbol)) return 1;
  if (_priceCache.has(symbol)) return _priceCache.get(symbol)!;
  const feed = PYTH_FEED[symbol] ?? `Crypto.${symbol}/USD`;
  try {
    const now = Math.floor(Date.now() / 1000);
    const url = `https://benchmarks.pyth.network/v1/shims/tradingview/history?symbol=${feed}&resolution=D&from=${now - 5 * 86400}&to=${now}`;
    const res = await fetch(url);
    const j: any = await res.json();
    const p = Array.isArray(j.c) && j.c.length ? Number(j.c[j.c.length - 1]) : 0;
    _priceCache.set(symbol, p);
    return p;
  } catch {
    return 0;
  }
}

/** Parses Sui object response into LP Position domain structure */
function mapObjectToPosition(obj: any): Position | null {
  if (!obj || obj.error || !obj.data || !obj.data.content) return null;
  const content = obj.data.content;
  if (content.dataType !== "moveObject") return null;

  const fields = content.fields;
  const objectId = obj.data.objectId;

  const protocolVal = Number(fields.protocol);
  const protocol: "cetus" | "turbos" | "deepbook" | "kriya" =
    protocolVal === 0 ? "cetus" :
    protocolVal === 1 ? "turbos" :
    protocolVal === 2 ? "deepbook" : "kriya";

  const tokenX = fields.token_x;
  const tokenY = fields.token_y;

  return {
    objectId,
    protocol,
    poolId: fields.pool_id,
    pair: `${tokenX}-${tokenY}`,
    tokenX,
    tokenY,
    token: canonicalToken(tokenX), // primary token for clustering (WETH/stETH â†’ ETH)
    valueUSD: Number(fields.value_usd || 0),
    inRange: true, // Default true, enriched later
    daysOutOfRange: 0,
    isDust: Number(fields.value_usd) < 5, // Dust threshold: < $5
    // Attach raw fields for range calculations
    ...({
      tickLower: Number(fields.tick_lower ?? 0),
      tickUpper: Number(fields.tick_upper ?? 0),
      liquidity: fields.liquidity,
    } as any)
  };
}

/** Fetches active Cetus pools from public REST API */
async function fetchCetusPools(): Promise<any[]> {
  try {
    const res = await fetch(
      `${config.cetus.apiUrl}/v2/sui/pools`
    );  
    if (!res.ok) return [];
    const json: any = await res.json();
    return json.data?.pools || [];
  } catch (err) {
    console.error("[scout] failed to fetch Cetus pools:", err);
    return [];
  }
}

/** Fetches historical daily prices using free Pyth Benchmarks API */
async function fetchPythHistoricalPrices(symbol: string, from: number, to: number): Promise<number[]> {
  try {
    // Map common token symbols to Pyth symbol names
    const pythSymbolMap: Record<string, string> = {
      "SUI": "Crypto.SUI/USD",
      "ETH": "Crypto.ETH/USD",
      "BTC": "Crypto.BTC/USD",
      "USDC": "Crypto.USDC/USD",
      "USDT": "Crypto.USDT/USD",
    };
    const pythSymbol = pythSymbolMap[symbol] || `Crypto.${symbol}/USD`;

    const url = `https://benchmarks.pyth.network/v1/shims/tradingview/history?symbol=${pythSymbol}&resolution=D&from=${from}&to=${to}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json: any = await res.json();
    
    // Pyth TV history response uses 'c' array for close prices
    if (json && Array.isArray(json.c)) {
      return json.c.map((val: any) => Number(val));
    }
    return [];
  } catch (err) {
    console.error(`[scout] failed to fetch historical prices for ${symbol}:`, err);
    return [];
  }
}
