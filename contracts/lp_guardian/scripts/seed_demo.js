#!/usr/bin/env node
/* eslint-disable no-console */
// Seed 3 demo Portfolio objects on Sui testnet + emit deployment.json / deployment.md.
//
// Usage:
//   PKG=0x<packageId> node scripts/seed_demo.js
// (PKG defaults to the published package below.)
//
// Notes:
// - The Sui CLI `call` cannot handle a function returning a non-`drop` value, so `authorize_strategist`
//   (returns StrategistCap) is invoked via a PTB that transfers the cap.
// - For demo seeding the cap's agent_address is set to the OWNER address so the same key can also
//   mint a sample HealthReport. BE Agent should re-authorize the REAL agent address later
//   (call authorize_strategist with the watcher's address; optionally revoke_cap first).

const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const PKG =
  process.env.PKG ||
  "0xb92cb12fa82d01848df23c3fc632421ec4c07608e8ac98fbbca11a2b62195e40";
const MODULE = "lp_guardian";
const GAS = "100000000";
const EXPIRES = "99999999"; // far-future epoch
const FUND_MIST = "10000000"; // 0.01 SUI deposited into each demo vault

// Distinct fake pool ids used for whitelist + position pool_id references.
const POOL = {
  ETH_USDC: id(0x101),
  ETH_USDT: id(0x102),
  BTC_USDC: id(0x103),
  SUI_USDC: id(0x104),
  STETH_ETH: id(0x105),
};
const whitelistArg = `[${[POOL.ETH_USDC, POOL.BTC_USDC, POOL.SUI_USDC].join(",")}]`;

function id(n) {
  return "0x" + n.toString(16).padStart(64, "0");
}

function sh(cmd) {
  const raw = execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const i = raw.indexOf("{");
  if (i < 0) throw new Error("no JSON in output of: " + cmd + "\n" + raw);
  return JSON.parse(raw.slice(i));
}

function assertOk(o, label) {
  const st = o.effects && o.effects.status && o.effects.status.status;
  if (st !== "success") throw new Error(`${label} failed: ${JSON.stringify(o.effects.status)}`);
  return o;
}

function created(o, typeSuffix) {
  const c = o.objectChanges.find(
    (x) => x.type === "created" && x.objectType.endsWith(typeSuffix),
  );
  return c && c.objectId;
}

const OWNER = execSync("sui client active-address", { encoding: "utf8" })
  .trim()
  .split("\n")
  .pop()
  .trim();

console.log("Package:", PKG);
console.log("Owner  :", OWNER);

// ---- demo portfolio configs (story mirrors brief demo wallets) ----
// protocol: 0=cetus 1=turbos 2=deepbook. value_usd sums shape the correlation story.
const CONFIGS = [
  {
    label: "Demo1-Amber",
    healthExpected: 42,
    risk: 1, // amber
    insights: "87% of value is one ETH bet across 5 positions",
    allocation: "ETH 40 / BTC 30 / USDC 30",
    confidence: 72,
    positions: [
      { protocol: 0, pool: POOL.ETH_USDC, x: "ETH", y: "USDC", liq: 1200, tl: -1000, tu: 1000, val: 4200 },
      { protocol: 0, pool: POOL.ETH_USDT, x: "ETH", y: "USDT", liq: 900, tl: -800, tu: 800, val: 2600 },
      { protocol: 1, pool: POOL.STETH_ETH, x: "stETH", y: "ETH", liq: 600, tl: -400, tu: 400, val: 1500 },
      { protocol: 0, pool: POOL.ETH_USDC, x: "WETH", y: "USDC", liq: 500, tl: -1200, tu: 1200, val: 900 },
      { protocol: 2, pool: POOL.BTC_USDC, x: "BTC", y: "USDC", liq: 300, tl: 0, tu: 0, val: 800 },
    ],
  },
  {
    label: "Demo2-Red",
    healthExpected: 35,
    risk: 2, // red
    insights: "ETH cluster + 3 dust positions; concentration critical",
    allocation: "ETH 35 / BTC 25 / SUI 20 / USDC 20",
    confidence: 68,
    positions: [
      { protocol: 0, pool: POOL.ETH_USDC, x: "ETH", y: "USDC", liq: 1500, tl: -900, tu: 900, val: 3800 },
      { protocol: 0, pool: POOL.ETH_USDT, x: "ETH", y: "USDT", liq: 1100, tl: -700, tu: 700, val: 2400 },
      { protocol: 1, pool: POOL.STETH_ETH, x: "stETH", y: "ETH", liq: 700, tl: -300, tu: 300, val: 1700 },
      { protocol: 0, pool: POOL.ETH_USDC, x: "WETH", y: "USDC", liq: 400, tl: -1100, tu: 1100, val: 700 },
      { protocol: 2, pool: POOL.BTC_USDC, x: "BTC", y: "USDC", liq: 250, tl: 0, tu: 0, val: 600 },
      { protocol: 0, pool: POOL.SUI_USDC, x: "SUI", y: "USDC", liq: 80, tl: -200, tu: 200, val: 35 },
      { protocol: 1, pool: POOL.ETH_USDC, x: "ETH", y: "USDC", liq: 40, tl: -100, tu: 100, val: 18 },
      { protocol: 0, pool: POOL.ETH_USDT, x: "ETH", y: "USDT", liq: 20, tl: -50, tu: 50, val: 9 },
    ],
  },
  {
    label: "Demo3-Green",
    healthExpected: 65,
    risk: 0, // green
    insights: "Diversified across ETH/BTC/SUI; minor optimization only",
    allocation: "ETH 34 / BTC 33 / SUI 33",
    confidence: 80,
    positions: [
      { protocol: 0, pool: POOL.ETH_USDC, x: "ETH", y: "USDC", liq: 1000, tl: -1000, tu: 1000, val: 3400 },
      { protocol: 2, pool: POOL.BTC_USDC, x: "BTC", y: "USDC", liq: 900, tl: 0, tu: 0, val: 3300 },
      { protocol: 0, pool: POOL.SUI_USDC, x: "SUI", y: "USDC", liq: 1200, tl: -600, tu: 600, val: 3300 },
    ],
  },
];

const out = { packageId: PKG, network: "testnet", owner: OWNER, demoPortfolios: [], whitelist: whitelistArg };

for (const cfg of CONFIGS) {
  console.log(`\n=== ${cfg.label} ===`);

  // 1) create_portfolio (returns ID -> drop; shares the Portfolio)
  let o = assertOk(
    sh(
      `sui client call --package ${PKG} --module ${MODULE} --function create_portfolio ` +
        `--args "${whitelistArg}" 100 --gas-budget ${GAS} --json`,
    ),
    "create_portfolio",
  );
  const portfolioId = created(o, "::Portfolio");
  console.log("portfolio:", portfolioId);

  // 2) deposit (ptb: split gas -> deposit)
  assertOk(
    sh(
      `sui client ptb --split-coins gas "[${FUND_MIST}]" --assign c ` +
        `--move-call ${PKG}::${MODULE}::deposit @${portfolioId} c.0 --gas-budget ${GAS} --json`,
    ),
    "deposit",
  );

  // 3) add positions (call; String args supported)
  for (const p of cfg.positions) {
    assertOk(
      sh(
        `sui client call --package ${PKG} --module ${MODULE} --function add_position ` +
          `--args ${portfolioId} ${p.protocol} ${p.pool} "${p.x}" "${p.y}" ${p.liq} ${Math.abs(p.tl)} ${Math.abs(p.tu)} ${p.val} ` +
          `--gas-budget ${GAS} --json`,
      ),
      "add_position",
    );
  }
  console.log("positions added:", cfg.positions.length);

  // 4) authorize_strategist (ptb: agent=OWNER, transfer cap to OWNER)
  o = assertOk(
    sh(
      `sui client ptb --move-call ${PKG}::${MODULE}::authorize_strategist @${portfolioId} @${OWNER} ${EXPIRES} ` +
        `--assign cap --transfer-objects "[cap]" @${OWNER} --gas-budget ${GAS} --json`,
    ),
    "authorize_strategist",
  );
  const capId = created(o, "::StrategistCap");
  console.log("cap:", capId);

  // 5) mint_health_report (call; sender==agent==owner; returns frozen HealthReport)
  o = assertOk(
    sh(
      `sui client call --package ${PKG} --module ${MODULE} --function mint_health_report ` +
        `--args ${portfolioId} ${capId} ${cfg.healthExpected} ${cfg.risk} "${cfg.insights}" "${cfg.allocation}" ${cfg.confidence} ` +
        `--gas-budget ${GAS} --json`,
    ),
    "mint_health_report",
  );
  const reportId = created(o, "::HealthReport");
  console.log("healthReport:", reportId);

  out.demoPortfolios.push({
    label: cfg.label,
    portfolioId,
    capId,
    healthReportId: reportId,
    healthExpected: cfg.healthExpected,
    riskLevel: ["green", "amber", "red"][cfg.risk],
    positionCount: cfg.positions.length,
  });
}

const root = path.resolve(__dirname, "..");
fs.writeFileSync(path.join(root, "deployment.json"), JSON.stringify(out, null, 2));

const ex = (t) => `https://suiscan.xyz/testnet/object/${t}`;
let md = `# LP Guardian — testnet deployment\n\n`;
md += `**Package:** \`${PKG}\` — [explorer](https://suiscan.xyz/testnet/object/${PKG})\n\n`;
md += `**Network:** testnet · **Owner/deployer:** \`${OWNER}\`\n\n`;
md += `> Demo caps are authorized to the OWNER address for seeding. BE Agent: call \`authorize_strategist\`\n`;
md += `> with the real watcher address (optionally \`revoke_cap\` first) to hand control to the agent.\n\n`;
md += `## Demo portfolios\n\n| Label | Health | Risk | Positions | Portfolio | HealthReport |\n`;
md += `|---|---|---|---|---|---|\n`;
for (const d of out.demoPortfolios) {
  md += `| ${d.label} | ${d.healthExpected} | ${d.riskLevel} | ${d.positionCount} | [${d.portfolioId.slice(0, 10)}…](${ex(d.portfolioId)}) | [${d.healthReportId.slice(0, 10)}…](${ex(d.healthReportId)}) |\n`;
}
md += `\n## Move entry points\n\n`;
md += "`create_portfolio`, `deposit`, `add_position`, `authorize_strategist`, `rebalance`, `withdraw`, `revoke_cap`, `mint_health_report`, `register_deepbook_pool` + getters.\n";
fs.writeFileSync(path.join(root, "deployment.md"), md);

console.log("\nWrote deployment.json + deployment.md");
console.log(JSON.stringify(out, null, 2));
