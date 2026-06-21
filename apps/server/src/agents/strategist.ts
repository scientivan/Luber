import type {
  PortfolioHealth,
  RebalancePlan,
  ShockResult,
  RiskLevel,
} from "@lp-guardian/core";
import { config, explorerTx } from "../config.js";
import { beData } from "../services/beDataClient.js";
import { scout } from "./scout.js";
import { suiClient, strategistKeypair } from "../chain/suiClient.js";
import { buildRebalanceTx, buildHealthReportTx } from "../chain/moveCalls.js";

const riskToU8 = (r: RiskLevel) => (r === "green" ? 0 : r === "amber" ? 1 : 2);

/**
 * Strategist — the portfolio brain + the on-chain signer. Calls BE Data for
 * correlation/risk, assembles the diagnose payload, and (for Fix/Guard) signs
 * PTBs via the StrategistCap.
 */
export const strategist = {
  async diagnose(walletAddress: string): Promise<PortfolioHealth> {
    const positions = await scout.discoverPositions(walletAddress);
    const priceHistory = await scout.priceHistory(positions.map((p) => p.tokenX));

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
    const priceHistory = await scout.priceHistory(positions.map((p) => p.tokenX));
    return beData.simulateShock(positions, priceHistory, asset, pct) as Promise<ShockResult>;
  },

  /** Sign the rebalance PTB via the StrategistCap. One signature, atomic. */
  async executeRebalance(capId: string, plan: RebalancePlan): Promise<{ txDigest: string; explorer: string }> {
    if (config.mockMode) {
      const txDigest = "0xMOCK_REBALANCE_" + plan.planId;
      return { txDigest, explorer: explorerTx(txDigest) };
    }
    const tx = buildRebalanceTx({
      capId,
      targetPool: config.sui.portfolioId,
      slippageBps: 80,
      maxSlippageBps: 100,
      plan,
    });
    const res = await suiClient.signAndExecuteTransaction({
      signer: strategistKeypair(),
      transaction: tx,
    });
    return { txDigest: res.digest, explorer: explorerTx(res.digest) };
  },

  /** Persist the analysis as an immutable HealthReport (audit trail). */
  async mintReport(capId: string, health: PortfolioHealth): Promise<{ txDigest: string }> {
    if (config.mockMode) return { txDigest: "0xMOCK_REPORT" };
    const tx = buildHealthReportTx({
      capId,
      score: health.healthScore,
      riskLevel: riskToU8(health.riskLevel),
      insights: health.insights.map((i) => i.title).join("; "),
    });
    const res = await suiClient.signAndExecuteTransaction({ signer: strategistKeypair(), transaction: tx });
    return { txDigest: res.digest };
  },
};
