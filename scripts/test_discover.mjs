// Standalone validation: discover a wallet's REAL Cetus positions on mainnet and
// estimate USD value. Run: node scripts/test_discover.mjs [walletAddress]
// Proves the discovery+value pipeline before wiring it into the server.

const RPC = "https://fullnode.mainnet.sui.io:443";
const CETUS_PKG =
  "0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb";
const POS_TYPE = `${CETUS_PKG}::position::Position`;
const WALLET =
  process.argv[2] ||
  "0xf4f3d9b64a545915a201af3c751ebda13b729c7c2dfad79f18e44792f5ca4541";

async function rpc(method, params) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await res.json();
  if (j.error) throw new Error(`${method}: ${JSON.stringify(j.error)}`);
  return j.result;
}

// i32 stored as { fields: { bits: u32 } }; >2^31 means negative.
function decodeI32(wrapped) {
  const bits = Number(wrapped?.fields?.bits ?? wrapped?.bits ?? wrapped ?? 0);
  return bits >= 2 ** 31 ? bits - 2 ** 32 : bits;
}
// TypeName.name is the type string WITHOUT 0x prefix.
function coinType(wrapped) {
  const n = wrapped?.fields?.name ?? wrapped?.name ?? wrapped;
  return typeof n === "string" ? "0x" + n.replace(/^0x/, "") : String(n);
}
function symbolOf(type) {
  return (type.split("::").pop() || type).toUpperCase();
}
const PYTH = {
  SUI: "Crypto.SUI/USD", ETH: "Crypto.ETH/USD", WETH: "Crypto.ETH/USD",
  BTC: "Crypto.BTC/USD", WBTC: "Crypto.BTC/USD",
  USDC: "Crypto.USDC/USD", USDT: "Crypto.USDT/USD", SUIUSDT: "Crypto.USDT/USD",
  CETUS: "Crypto.CETUS/USD", DEEP: "Crypto.DEEP/USD",
};
const priceCache = new Map();
async function usdPrice(symbol) {
  const stable = ["USDC", "USDT", "SUIUSDT", "USDY", "BUCK"];
  if (stable.includes(symbol)) return 1;
  if (priceCache.has(symbol)) return priceCache.get(symbol);
  const feed = PYTH[symbol];
  if (!feed) return 0;
  try {
    const now = Math.floor(Date.now() / 1000);
    const url = `https://benchmarks.pyth.network/v1/shims/tradingview/history?symbol=${feed}&resolution=D&from=${now - 5 * 86400}&to=${now}`;
    const r = await fetch(url);
    const j = await r.json();
    const p = Array.isArray(j.c) && j.c.length ? Number(j.c[j.c.length - 1]) : 0;
    priceCache.set(symbol, p);
    return p;
  } catch {
    return 0;
  }
}
const decCache = new Map();
async function decimals(type) {
  if (decCache.has(type)) return decCache.get(type);
  try {
    const m = await rpc("suix_getCoinMetadata", [type]);
    const d = m?.decimals ?? 9;
    decCache.set(type, d);
    return d;
  } catch {
    return 9;
  }
}

// CLMM amounts from liquidity + tick range + current sqrt price (all floats).
function amounts(L, tickLower, tickUpper, currentSqrt) {
  const pa = Math.pow(1.0001, tickLower / 2);
  const pb = Math.pow(1.0001, tickUpper / 2);
  const sc = currentSqrt;
  let a = 0, b = 0;
  if (sc <= pa) {
    a = L * (1 / pa - 1 / pb);
  } else if (sc >= pb) {
    b = L * (pb - pa);
  } else {
    a = L * (1 / sc - 1 / pb);
    b = L * (sc - pa);
  }
  return { rawA: a, rawB: b };
}

async function main() {
  let positions;
  if (process.env.POS) {
    // Value a single position object directly (math validation, any owner).
    const o = await rpc("sui_getObject", [
      process.env.POS,
      { showContent: true },
    ]);
    positions = [{ data: o.data }];
    console.log("Single position:", process.env.POS, "\n");
  } else {
    console.log("Wallet:", WALLET);
    const owned = await rpc("suix_getOwnedObjects", [
      WALLET,
      { filter: { StructType: POS_TYPE }, options: { showContent: true } },
      null, 50,
    ]);
    positions = owned.data || [];
    console.log("Cetus positions found:", positions.length, "\n");
  }

  const poolCache = new Map();
  async function poolSqrt(poolId) {
    if (poolCache.has(poolId)) return poolCache.get(poolId);
    const o = await rpc("sui_getObject", [poolId, { showContent: true }]);
    const f = o?.data?.content?.fields || {};
    const x64 = Number(f.current_sqrt_price ?? 0);
    const sqrt = x64 / 2 ** 64; // raw sqrt price (token units, pre-decimals)
    poolCache.set(poolId, sqrt);
    return sqrt;
  }

  let total = 0;
  for (const p of positions) {
    const f = p.data.content.fields;
    const poolId = f.pool;
    const L = Number(f.liquidity);
    const tl = decodeI32(f.tick_lower_index);
    const tu = decodeI32(f.tick_upper_index);
    const tA = coinType(f.coin_type_a);
    const tB = coinType(f.coin_type_b);
    const symA = symbolOf(tA), symB = symbolOf(tB);

    const sqrt = await poolSqrt(poolId);
    const { rawA, rawB } = amounts(L, tl, tu, sqrt);
    const [dA, dB, pA, pB] = await Promise.all([
      decimals(tA), decimals(tB), usdPrice(symA), usdPrice(symB),
    ]);
    const amtA = rawA / 10 ** dA, amtB = rawB / 10 ** dB;
    const usd = amtA * pA + amtB * pB;
    total += usd;

    console.log(`• ${symA}-${symB}  (pool ${poolId.slice(0, 10)}…)`);
    console.log(`   ticks [${tl}, ${tu}]  L=${L}`);
    console.log(`   ${symA}: ${amtA.toFixed(4)} ×$${pA}  |  ${symB}: ${amtB.toFixed(4)} ×$${pB}`);
    console.log(`   ≈ $${usd.toFixed(2)}\n`);
  }
  console.log("TOTAL ≈ $" + total.toFixed(2));
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });
