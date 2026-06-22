import type { Position } from "@lp-guardian/core";

/** Canonical demo-1 wallet: 5 positions that are secretly one 87% ETH bet. */
export const DEMO_POSITIONS: Position[] = [
  { objectId: "0xpos1", protocol: "cetus", poolId: "0xdemo1", pair: "ETH-USDC", tokenX: "ETH", tokenY: "USDC", valueUSD: 3800, inRange: true },
  { objectId: "0xpos2", protocol: "cetus", poolId: "0xdemo2", pair: "ETH-USDT", tokenX: "ETH", tokenY: "USDT", valueUSD: 2600, inRange: true },
  { objectId: "0xpos3", protocol: "turbos", poolId: "0xdemo3", pair: "WETH-SUI", tokenX: "ETH", tokenY: "SUI", valueUSD: 2300, inRange: false, daysOutOfRange: 14 },
  { objectId: "0xpos4", protocol: "cetus", poolId: "0xdemo4", pair: "stETH-ETH", tokenX: "ETH", tokenY: "ETH", valueUSD: 1500, inRange: true },
  { objectId: "0xpos5", protocol: "cetus", poolId: "0xdemo5", pair: "BTC-USDC", tokenX: "BTC", tokenY: "USDC", valueUSD: 50, inRange: true, isDust: true },
];

export const DEMO_MODE_POSITIONS: Position[] = [
  {
    objectId: `0x${"d1".repeat(32)}`,
    protocol: "cetus",
    poolId: `0x${"a1".repeat(32)}`,
    pair: "SUI-USDC",
    tokenX: "SUI",
    tokenY: "USDC",
    token: "SUI",
    valueUSD: 4_800,
    inRange: true,
    daysOutOfRange: 0,
    source: "demo",
    recommendation: "hold",
    migrationReason: "Position is active and earning fees inside its configured range.",
  },
  {
    objectId: `0x${"d2".repeat(32)}`,
    protocol: "cetus",
    poolId: `0x${"a2".repeat(32)}`,
    pair: "ETH-USDC",
    tokenX: "ETH",
    tokenY: "USDC",
    token: "ETH",
    valueUSD: 3_250,
    inRange: false,
    daysOutOfRange: 18,
    source: "demo",
    recommendation: "migrate",
    migrationReason: "Position has stayed outside its range for 18 days; migrate into a range centered on current price.",
  },
];

export function isDemoPosition(positionId: string): boolean {
  return DEMO_MODE_POSITIONS.some((position) => position.objectId === positionId);
}

/** Synthetic correlated price history for the compute service. */
export function demoPriceHistory(n = 120): Record<string, number[]> {
  const base: number[] = [];
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += (Math.random() - 0.5) * 2;
    base.push(acc);
  }
  const walk = (factorW: number, noise: number, start: number) =>
    base.map((b) => start * Math.exp(0.01 * (factorW * b + noise * (Math.random() - 0.5) * 10)));
  return {
    ETH: walk(1.0, 0.2, 3000),
    BTC: walk(0.3, 0.8, 60000),
    SUI: walk(0.5, 0.6, 1.2),
    USDC: Array(n).fill(1),
    USDT: Array(n).fill(1),
  };
}
