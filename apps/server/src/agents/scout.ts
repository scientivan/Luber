import type { Position } from "@lp-guardian/core";
import { config, resolvePortfolio } from "../config.js";
import { suiClient } from "../chain/suiClient.js";
import { DEMO_POSITIONS } from "../services/mockData.js";

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

/**
 * Scout — discovers all LP positions for a wallet as Sui on-chain objects,
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
      // key so our array index matches the on-chain dof index — `rebalance` applies
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
   * symbol (WETH/stETH → ETH) so the keys line up with `position.token`. Returns
   * `{}` when nothing usable is found — BE Data then sources prices itself and
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
      return history; // may be {} — BE Data fills + labels it
    } catch (err) {
      console.error("[scout] failed to fetch real price history; BE Data will source it:", err);
      return {};
    }
  },
};

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
    token: canonicalToken(tokenX), // primary token for clustering (WETH/stETH → ETH)
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
    const res = await fetch("https://api-sui.cetus.zone/v2/sui/pools");
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
