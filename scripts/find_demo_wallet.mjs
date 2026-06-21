// Find a GOOD demo wallet: scan recent Cetus positions, value them, and for the
// high-value ones grab the owner, then value the owner's FULL portfolio. Ranks
// real wallets by total USD (>=2 positions preferred). Run: node scripts/find_demo_wallet.mjs

const RPC = "https://fullnode.mainnet.sui.io:443";
const PKG = "0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb";
const POS_TYPE = `${PKG}::position::Position`;

async function rpc(method, params) {
  const r = await fetch(RPC, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  return (await r.json()).result;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const decodeI32 = (w) => { const b = Number(w?.fields?.bits ?? w?.bits ?? w ?? 0); return b >= 2 ** 31 ? b - 2 ** 32 : b; };
const coinType = (w) => { const n = w?.fields?.name ?? w?.name ?? w; return typeof n === "string" ? "0x" + n.replace(/^0x/, "") : String(n); };
const sym = (t) => (t.split("::").pop() || t).toUpperCase();
const FEED = { SUI:"Crypto.SUI/USD",ETH:"Crypto.ETH/USD",WETH:"Crypto.ETH/USD",BTC:"Crypto.BTC/USD",WBTC:"Crypto.BTC/USD",USDC:"Crypto.USDC/USD",USDT:"Crypto.USDT/USD",CETUS:"Crypto.CETUS/USD",DEEP:"Crypto.DEEP/USD",NS:"Crypto.NS/USD",WAL:"Crypto.WAL/USD" };
const STABLE = ["USDC","USDT","SUIUSDT","USDY","BUCK","AUSD","FDUSD"];
const pcache = new Map(), dcache = new Map(), poolcache = new Map();
async function price(s){ if(STABLE.includes(s))return 1; if(pcache.has(s))return pcache.get(s); const f=FEED[s]??`Crypto.${s}/USD`; try{const n=Math.floor(Date.now()/1e3);const r=await fetch(`https://benchmarks.pyth.network/v1/shims/tradingview/history?symbol=${f}&resolution=D&from=${n-5*86400}&to=${n}`);const j=await r.json();const p=Array.isArray(j.c)&&j.c.length?Number(j.c[j.c.length-1]):0;pcache.set(s,p);return p;}catch{return 0;} }
async function decimals(t){ if(dcache.has(t))return dcache.get(t); try{const m=await rpc("suix_getCoinMetadata",[t]);const d=m?.decimals??9;dcache.set(t,d);return d;}catch{return 9;} }
async function poolSqrt(id){ if(poolcache.has(id))return poolcache.get(id); try{const o=await rpc("sui_getObject",[id,{showContent:true}]);const x=Number(o?.data?.content?.fields?.current_sqrt_price??0);const s=x/2**64;poolcache.set(id,s);return s;}catch{return 0;} }
function amts(L,tl,tu,sc){const pa=Math.pow(1.0001,tl/2),pb=Math.pow(1.0001,tu/2);let a=0,b=0;if(sc<=pa)a=L*(1/pa-1/pb);else if(sc>=pb)b=L*(pb-pa);else{a=L*(1/sc-1/pb);b=L*(sc-pa);}return{a,b};}
async function valuePos(f){const L=Number(f.liquidity);const tl=decodeI32(f.tick_lower_index),tu=decodeI32(f.tick_upper_index);const tA=coinType(f.coin_type_a),tB=coinType(f.coin_type_b);const sA=sym(tA),sB=sym(tB);const sc=await poolSqrt(f.pool);const{a,b}=amts(L,tl,tu,sc);const[dA,dB,pA,pB]=await Promise.all([decimals(tA),decimals(tB),price(sA),price(sB)]);return{pair:`${sA}-${sB}`,usd:(a/10**dA)*pA+(b/10**dB)*pB};}

async function portfolioValue(owner){
  const res=await rpc("suix_getOwnedObjects",[owner,{filter:{StructType:POS_TYPE},options:{showContent:true}},null,50]);
  const fl=(res?.data??[]).map(o=>o.data?.content?.fields).filter(Boolean);
  let total=0; const pairs=[];
  for(const f of fl){ const v=await valuePos(f); total+=v.usd; pairs.push(`${v.pair}($${v.usd.toFixed(0)})`); }
  return { n: fl.length, total, pairs };
}

async function main(){
  console.log("Scanning high-value positions → owners → full portfolios…\n");
  // 1. collect recent position object ids (both events, more pages)
  const ids=new Set();
  for(const ev of [`${PKG}::pool::AddLiquidityEvent`,`${PKG}::pool::OpenPositionEvent`,`${PKG}::pool::RemoveLiquidityEvent`]){
    let cursor=null;
    for(let p=0;p<4;p++){
      const res=await rpc("suix_queryEvents",[{MoveEventType:ev},cursor,50,true]);
      if(!res?.data?.length)break;
      for(const e of res.data){const pid=e.parsedJson?.position; if(pid)ids.add(pid);}
      cursor=res.nextCursor; if(!res.hasNextPage)break; await sleep(120);
    }
  }
  // 2. collect owners of positions worth > $80
  const owners=new Set();
  let scanned=0;
  for(const id of ids){
    if(scanned++>120)break;
    const o=await rpc("sui_getObject",[id,{showContent:true,showOwner:true}]);
    const d=o?.data; if(!d?.content)continue;
    const ow=d.owner?.AddressOwner; if(!ow)continue;
    const v=await valuePos(d.content.fields);
    if(v.usd>80)owners.add(ow);
    await sleep(40);
  }
  console.log("owners to evaluate:",owners.size,"\n");
  // 3. value full portfolios
  const results=[];
  for(const ow of owners){ const pv=await portfolioValue(ow); results.push({ow,...pv}); await sleep(50); }

  const multi=results.filter(r=>r.n>=3&&r.total>800).sort((a,b)=>b.total-a.total);
  console.log("=== ⭐ MULTI-POSITION wallets (n>=3, best for correlation demo) ===");
  if(!multi.length)console.log("  (none this pass — rerun)");
  for(const r of multi.slice(0,6)){
    console.log(`\n  $${r.total.toFixed(0)}  ·  ${r.n} positions  ·  ${r.ow}`);
    console.log("    " + r.pairs.slice(0,12).join("  "));
  }
  const single=results.filter(r=>r.n>0).sort((a,b)=>b.total-a.total);
  console.log("\n=== high-value wallets (any count) ===");
  for(const r of single.slice(0,6)) console.log(`  $${r.total.toFixed(0)} · ${r.n}pos · ${r.ow}`);
}
main().catch(e=>{console.error("FATAL",e);process.exit(1);});
