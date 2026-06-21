import { config } from "../config.js";

/** Thin client over the Python compute service (§7.2). */
async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${config.beDataUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`be-data ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export const beData = {
  correlation: (positions: unknown[], priceHistory: Record<string, number[]>) =>
    post("/compute/correlation", { positions, priceHistory }),

  risk: (positions: unknown[], priceHistory: Record<string, number[]>, opts?: { deepBookDepth?: unknown; riskTolerance?: string }) =>
    post("/compute/risk", { positions, priceHistory, deepBookDepth: opts?.deepBookDepth, riskTolerance: opts?.riskTolerance ?? "med" }),

  stress: (positions: unknown[], priceHistory: Record<string, number[]>, asset: string, pct: number) =>
    post("/compute/stress", { positions, priceHistory, asset, pct }),

  simulateShock: (positions: unknown[], priceHistory: Record<string, number[]>, asset: string, pct: number, plan?: unknown) =>
    post("/compute/simulate-shock", { positions, priceHistory, asset, pct, plan }),
};
