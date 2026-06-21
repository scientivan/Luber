// ─────────────────────────────────────────────────────────────────────────
// Core domain types — frozen Day 0. Source of truth for all surfaces.
// HERO of the product = portfolio-level correlation. Everything below
// foregrounds the "your portfolio is secretly one bet" insight.
// ─────────────────────────────────────────────────────────────────────────

export type RiskLevel = "green" | "amber" | "red";
export type Protocol = "cetus" | "turbos" | "deepbook" | "kriya";

/** A single LP position discovered by Scout (on-chain object + enrichment). */
export interface Position {
  /** Sui object id of the position / pool ref. */
  objectId: string;
  protocol: Protocol;
  poolId: string;
  pair: string; // e.g. "ETH-USDC"
  tokenX: string;
  tokenY: string;
  /** Canonical primary token for correlation/clustering (e.g. WETH/stETH → ETH). */
  token?: string;
  valueUSD: number;
  inRange: boolean;
  daysOutOfRange?: number;
  /** True when gas-to-close exceeds position value. */
  isDust?: boolean;
}

/** The hero: the largest correlation cluster across all positions. */
export interface CorrelationCluster {
  /** Dominant correlated asset, e.g. "ETH". */
  token: string;
  /** % of portfolio value exposed to this one bet. */
  exposurePct: number;
  /** Indices into PortfolioHealth.positions that belong to the cluster. */
  positions: number[];
}

/** Plain-English stress-test result — "talk money, not math". */
export interface StressTest {
  asset: string;
  pct: number; // signed; negative = drop
  atRiskUSD: number;
  perPosition?: { positionIndex: number; lossUSD: number }[];
}

/** Risk-Aware Suggested Allocation — transparent, never "optimal". */
export interface Allocation {
  token: string;
  currentPct: number;
  targetPct: number;
}

export interface SuggestedAllocation {
  allocations: Allocation[];
  expectedHealthRange: [number, number];
  confidence: number; // 0..1
  riskOfWorsening: number; // 0..1
  assumptions: string[];
}

export type InsightType =
  | "correlation_risk"
  | "dust_detected"
  | "out_of_range"
  | "concentration_risk";

export interface Insight {
  id: string;
  type: InsightType;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string; // plain English
  affectedPositions: number[];
}

/** Top-level diagnose result — backs `diagnose_portfolio` + `/portfolio/health`. */
export interface PortfolioHealth {
  walletAddress: string;
  healthScore: number; // 0..100
  riskLevel: RiskLevel;
  totalValueUSD: number;
  positionCount: number;
  cluster: CorrelationCluster;
  stress: StressTest;
  positions: Position[];
  bleedingPools: BleedingPool[];
  insights: Insight[];
  suggestedAllocation?: SuggestedAllocation;
  txDigest?: string;
  reportObjectId?: string;
}

/** A pool flagged in diagnose — becomes the "menu" for deep_diagnose_pool. */
export interface BleedingPool {
  poolId: string;
  protocol: Protocol;
  pair: string;
  status: "bleeding" | "healthy" | "watch";
}

/** DeepBook exit-liquidity profile (read-only via SDK). */
export interface DeepBookLiquidityProfile {
  poolId: string;
  baseToken: string;
  quoteToken: string;
  midPrice: number;
  spreadBps: number;
  depthUSD: number;
  depthAt2Percent: number;
}

export interface PoolDeepDive {
  poolId: string;
  protocol: Protocol;
  pair: string;
  status: "bleeding" | "healthy" | "watch";
  inRange: boolean;
  daysOutOfRange: number;
  estImpermanentLossUSD: number;
  contributionToClusterPct: number;
  exitLiquidity: {
    depthUSD: number;
    slippageBpsAt30pct: number;
    feasible: boolean;
  };
}

/** simulate_shock / /simulate/shock result. */
export interface ShockResult {
  scenario: { asset: string; pct: number };
  atRiskUSD: number;
  guarded: {
    moneySaved: number;
    postShockLossUSD: number;
    postHealth: number;
    /** The counterfactual formula, shown on hover. Never a fabricated number. */
    formula: string;
  };
}

/** A correlation-aware rebalance plan, previewed before the single signature. */
export interface RebalancePlan {
  planId: string;
  steps: RebalanceStep[];
  expectedHealthRange: [number, number];
  confidence: number;
  /** Plain-English dry-run line shown before signing. */
  preview: string;
}

export interface RebalanceStep {
  stepNumber: number;
  action: string;
  protocol: Protocol;
  parameters: Record<string, unknown>;
  deepBookData?: DeepBookLiquidityProfile;
}

/** History item — public on-chain activity (preview) or claimed private detail. */
export interface HistoryItem {
  id: string;
  type: "diagnosis" | "fix" | "autonomous_save";
  level: "portfolio" | "pool";
  timestamp: string;
  summary: string;
  moneySaved?: number;
  txDigest?: string;
}

// ── Capability / Guard ──────────────────────────────────────────────────

export interface GuardStatus {
  active: boolean;
  capId?: string;
  expiresAtEpoch?: number;
  revocable: true;
}
