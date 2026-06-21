import { config } from "../config.js";

async function post<T>(path: string, body: any): Promise<T> {
  const res = await fetch(`${config.beDataUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`be-data ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

// Canonical mock data matching the brief precisely
const MOCK_RISK_RESPONSE = {
  healthScore: 42,
  riskLevel: "amber" as const,
  cluster: {
    token: "ETH",
    exposurePct: 87.0,
    positions: [0, 1, 2, 3]
  },
  dust: [4],
  insights: [
    {
      id: "ins_corr",
      type: "correlation_risk" as const,
      severity: "critical" as const,
      title: "87% is one ETH bet",
      description: "You think you have 5 positions. You really have one bet – 87% correlated to ETH. If it drops, all of them bleed at once.",
      affectedPositions: [0, 1, 2, 3]
    },
    {
      id: "ins_oor",
      type: "out_of_range" as const,
      severity: "warning" as const,
      title: "1 position out of range",
      description: "Earning zero fees while out of range.",
      affectedPositions: [2]
    }
  ],
  suggestedAllocation: {
    allocations: [
      { token: "ETH", currentPct: 87.0, targetPct: 40.0 },
      { token: "BTC", currentPct: 0.5, targetPct: 30.0 },
      { token: "SUI", currentPct: 12.5, targetPct: 30.0 }
    ],
    expectedHealthRange: [58, 72] as [number, number],
    confidence: 0.72,
    riskOfWorsening: 0.15,
    assumptions: [
      "Max single-token exposure capped at 40% (med risk).",
      "Correlation estimated from recent price history (Pearson).",
      "Exit routed within DeepBook depth (<= 10% of book)."
    ]
  },
  confidence: 0.72
};

export const beData = {
  async correlation(positions: any[], priceHistory: any): Promise<any> {
    if (config.mockMode) {
      return { cluster: MOCK_RISK_RESPONSE.cluster, concentration: 87.0 };
    }
    try { return await post("/compute/correlation", { positions, priceHistory }); }
    catch { return { cluster: MOCK_RISK_RESPONSE.cluster, concentration: 87.0 }; }
  },

  async risk(positions: any[], priceHistory: any, opts?: any): Promise<any> {
    if (config.mockMode) return MOCK_RISK_RESPONSE;
    try { return await post("/compute/risk", { positions, priceHistory, deepBookDepth: opts?.deepBookDepth, riskTolerance: opts?.riskTolerance ?? "med" }); }
    catch { return MOCK_RISK_RESPONSE; }
  },

  async stress(positions: any[], priceHistory: any, asset: string, pct: number): Promise<any> {
    const defaultStress = {
      asset,
      pct,
      atRiskUSD: 1800.0,
      perPosition: [
        { positionIndex: 0, lossUSD: 380.0 },
        { positionIndex: 1, lossUSD: 260.0 },
        { positionIndex: 2, lossUSD: 230.0 },
        { positionIndex: 3, lossUSD: 150.0 },
        { positionIndex: 4, lossUSD: 0.0 }
      ]
    };
    if (config.mockMode) return defaultStress;
    try { return await post("/compute/stress", { positions, priceHistory, asset, pct }); }
    catch { return defaultStress; }
  },

  async simulateShock(positions: any[], priceHistory: any, asset: string, pct: number, plan?: any): Promise<any> {
    const defaultSim = {
      scenario: { asset, pct },
      atRiskUSD: 1800.0,
      guarded: {
        moneySaved: 1200.0,
        postShockLossUSD: 600.0,
        postHealth: 61,
        formula: "(cluster value if NOT rebalanced) − (value after rebalance)"
      }
    };
    if (config.mockMode) return defaultSim;
    try { return await post("/compute/simulate-shock", { positions, priceHistory, asset, pct, plan }); }
    catch { return defaultSim; }
  }
};
