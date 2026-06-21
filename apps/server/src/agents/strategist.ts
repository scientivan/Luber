import type {
  PortfolioHealth,
  RebalancePlan,
  RebalanceStep,
  ShockResult,
  RiskLevel,
  Position,
} from "@lp-guardian/core";
import { config, explorerTx, resolvePortfolio } from "../config.js";
import { pythClient } from "../services/pythClient.js";
import * as supabaseService from "../services/supabaseService.js";
import { beData } from "../services/beDataClient.js";
import { scout } from "./scout.js";
import { suiClient, strategistKeypair } from "../chain/suiClient.js";
import { buildRebalanceTx, buildHealthReportTx } from "../chain/moveCalls.js";

const riskToU8 = (r: RiskLevel) => (r === "green" ? 0 : r === "amber" ? 1 : 2);

/**
 * Build a REAL correlation-aware rebalance plan from the computed allocation.
 * Every number is derived (no hardcoded 87â†’40 / [58,72] / 0.72). Each step's
 * `valueUsd` is the new per-position valuation â€” Move `rebalance` applies these by
 * position index â€” distributing each token's target value across its positions in
 * proportion to current size.
 */
export function buildPlanFromAllocation(health: PortfolioHealth): RebalancePlan {
  const alloc = health.suggestedAllocation;
  const positions = health.positions;
  const total = positions.reduce((s, p) => s + p.valueUSD, 0) || 1;

  const targetByToken = new Map<string, number>();
  if (alloc) for (const a of alloc.allocations) targetByToken.set(a.token, (a.targetPct / 100) * total);
  const curByToken = new Map<string, number>();
  for (const p of positions) {
    const t = p.token ?? p.tokenX;
    curByToken.set(t, (curByToken.get(t) ?? 0) + p.valueUSD);
  }

  const steps: RebalanceStep[] = positions.map((p, i) => {
    const t = p.token ?? p.tokenX;
    const tgt = targetByToken.get(t);
    const cur = curByToken.get(t) ?? 0;
    const newVal = tgt != null && cur > 0 ? Math.round((p.valueUSD / cur) * tgt) : Math.round(p.valueUSD);
    const action = newVal < p.valueUSD ? "reduce" : newVal > p.valueUSD ? "increase" : "hold";
    return { stepNumber: i + 1, action, protocol: p.protocol, parameters: { poolId: p.poolId, valueUsd: newVal, token: t }, deepBookData: (p as any).deepBookData };
  });

  const targetPct = alloc?.allocations.find((a) => a.token === health.cluster.token)?.targetPct ?? 40;
  return {
    planId: `plan_${Date.now()}`,
    steps,
    expectedHealthRange: alloc?.expectedHealthRange ?? [health.healthScore, health.healthScore],
    confidence: alloc?.confidence ?? 0.5,
    preview: `Cut ${health.cluster.token} cluster ${Math.round(health.cluster.exposurePct)}%â†’${Math.round(targetPct)}% into uncorrelated assets via DeepBook.`,
  };
}

/**
 * Strategist ï¿½ the portfolio brain + the on-chain signer. Calls BE Data for
 * correlation/risk, assembles the diagnose payload, and (for Fix/Guard) signs
 * PTBs via the StrategistCap.
 */
export const strategist = {
  async diagnose(walletAddress: string, opts?: { positions?: Position[] }): Promise<PortfolioHealth> {
    const positions = opts?.positions ?? (await scout.discoverPositions(walletAddress));
    const priceHistory = await scout.priceHistory(positions.flatMap((p) => [p.tokenX, p.tokenY]));

    const risk = await beData.risk(positions, priceHistory);
    const stress = await beData.stress(positions, priceHistory, risk["cluster"].token, -10);

    const totalValueUSD = positions.reduce((s, p) => s + p.valueUSD, 0);
    const bleedingPools = positions
      .filter((p) => !p.inRange || p.isDust)
      .map((p) => ({ poolId: p.poolId, protocol: p.protocol, pair: p.pair, status: "bleeding" as const }));

    return {
      walletAddress,
      healthScore: risk["healthScore"],
      riskLevel: risk["riskLevel"],
      totalValueUSD,
      positionCount: positions.length,
      cluster: risk["cluster"],
      stress,
      positions,
      bleedingPools,
      insights: risk["insights"],
      suggestedAllocation: risk["suggestedAllocation"],
    };
  },

  async simulate(walletAddress: string, asset: string, pct: number): Promise<ShockResult> {
    const positions = await scout.discoverPositions(walletAddress);
    const priceHistory = await scout.priceHistory(positions.flatMap((p) => [p.tokenX, p.tokenY]));
    return beData.simulateShock(positions, priceHistory, asset, pct) as Promise<ShockResult>;
  },

  /**
   * One-signature Fix: diagnose â†’ build a real plan â†’ sign the rebalance via the
   * StrategistCap â†’ mint the audit report. Returns the real tx digests + the
   * honest counterfactual money-saved (not a fabricated constant).
   */
  async rebalance(walletAddress: string): Promise<{ txDigest: string; explorer: string; moneySaved: number; reportTxDigest: string; preview: string }> {
    const health = await this.diagnose(walletAddress);
    const plan = buildPlanFromAllocation(health);
    const { portfolioId, capId } = resolvePortfolio(walletAddress);

    const { txDigest, explorer } = await this.executeRebalance(capId, portfolioId, plan);
    const sim = await this.simulate(walletAddress, health.cluster.token, -10);
    const report = await this.mintReport(capId, portfolioId, { ...health, txDigest });


    // Log manual rebalance event to Supabase
    await supabaseService.logEvent(walletAddress, portfolioId, "manual_rebalance", {
      txDigest,
      moneySaved: sim.guarded.moneySaved,
      clusterToken: health.cluster.token
    }).catch(console.error);
    
    // Auto-refresh baseline prices after successful rebalance
    const uniqueTokens = Array.from(new Set((health.positions || []).map(p => p.token).filter(Boolean)));
    if (uniqueTokens.length > 0) {
      const newPrices = await pythClient.getCurrentPrices(uniqueTokens as string[]).catch(() => ({}));
      await supabaseService.setBaselinePrices(walletAddress, portfolioId, newPrices).catch(console.error);
    }
    return { txDigest, explorer, moneySaved: sim.guarded.moneySaved, reportTxDigest: report.txDigest, preview: plan.preview };
  },

  /** Sign the rebalance PTB via the StrategistCap. One signature, atomic. */
  async executeRebalance(capId: string, portfolioId: string, plan: RebalancePlan): Promise<{ txDigest: string; explorer: string }> {
    if (config.mockMode) {
      const txDigest = "0xMOCK_REBALANCE_" + plan.planId;
      return { txDigest, explorer: explorerTx(txDigest) };
    }

    // new_value_usd is applied by position index; target_pools is the whitelist gate.
    const newValueUsd = plan.steps.map((s) => Number(s.parameters.valueUsd || 0));
    const targetPools = config.sui.whitelist.length
      ? config.sui.whitelist
      : Array.from(new Set(plan.steps.map((s) => s.parameters.poolId as string).filter(Boolean)));

    const tx = buildRebalanceTx({ portfolioId, capId, targetPools, newValueUsd, slippageBps: 80 });

    const res = await suiClient.signAndExecuteTransaction({
      signer: strategistKeypair(),
      transaction: tx,
    });
    return { txDigest: res.digest, explorer: explorerTx(res.digest) };
  },

  /** Persist the analysis as an immutable HealthReport (audit trail). */
  async mintReport(capId: string, portfolioId: string, health: PortfolioHealth): Promise<{ txDigest: string }> {
    if (config.mockMode) return { txDigest: "0xMOCK_REPORT" };

    const allocation = health.suggestedAllocation
      ? JSON.stringify(health.suggestedAllocation.allocations)
      : "[]";

    const tx = buildHealthReportTx({
      portfolioId,
      capId,
      score: health.healthScore,
      riskLevel: riskToU8(health.riskLevel),
      insights: health.insights.map((i) => i.title).join("; "),
      allocation,
      confidence: Math.round((health.suggestedAllocation?.confidence || 0.5) * 100),
    });

    const res = await suiClient.signAndExecuteTransaction({
      signer: strategistKeypair(),
      transaction: tx,
    });
    return { txDigest: res.digest };
  },
};
