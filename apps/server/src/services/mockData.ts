import type { Position } from "@lp-guardian/core";

/** Canonical demo-1 wallet: 5 positions that are secretly one 87% ETH bet. */
export const DEMO_POSITIONS: Position[] = [
  { objectId: "0xpos1", protocol: "cetus", poolId: "0xdemo1", pair: "ETH-USDC", tokenX: "ETH", tokenY: "USDC", valueUSD: 3800, inRange: true },
  { objectId: "0xpos2", protocol: "cetus", poolId: "0xdemo2", pair: "ETH-USDT", tokenX: "ETH", tokenY: "USDT", valueUSD: 2600, inRange: true },
  { objectId: "0xpos3", protocol: "turbos", poolId: "0xdemo3", pair: "WETH-SUI", tokenX: "ETH", tokenY: "SUI", valueUSD: 2300, inRange: false, daysOutOfRange: 14 },
  { objectId: "0xpos4", protocol: "cetus", poolId: "0xdemo4", pair: "stETH-ETH", tokenX: "ETH", tokenY: "ETH", valueUSD: 1500, inRange: true },
  { objectId: "0xpos5", protocol: "cetus", poolId: "0xdemo5", pair: "BTC-USDC", tokenX: "BTC", tokenY: "USDC", valueUSD: 50, inRange: true, isDust: true },
];

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
