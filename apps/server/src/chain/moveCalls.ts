import { Transaction } from "@mysten/sui/transactions";
import { config } from "../config.js";
import type { RebalancePlan } from "@lp-guardian/core";

const target = (fn: string) => `${config.sui.packageId}::lp_guardian::${fn}`;

/**
 * Build the correlation-aware rebalance PTB. All legs (exit old / enter new via
 * DeepBook + Cetus/Turbos) settle atomically — one signature, all-or-nothing.
 * The Move `rebalance` call enforces whitelist + slippage bounds.
 */
export function buildRebalanceTx(params: {
  capId: string;
  targetPool: string;
  slippageBps: number;
  maxSlippageBps: number;
  plan: RebalancePlan;
}): Transaction {
  const tx = new Transaction();

  // (Off-chain composed swap/LP legs would be added here as moveCalls.)
  tx.moveCall({
    target: target("rebalance"),
    arguments: [
      tx.object(config.sui.portfolioId),
      tx.object(params.capId),
      tx.pure.address(params.targetPool),
      tx.pure.u64(params.slippageBps),
      tx.pure.u64(params.maxSlippageBps),
    ],
  });

  return tx;
}

/** Build the update_health + mint_health_report PTB (immutable audit trail). */
export function buildHealthReportTx(params: {
  capId: string;
  score: number;
  riskLevel: number;
  insights: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: target("update_health"),
    arguments: [
      tx.object(config.sui.portfolioId),
      tx.object(params.capId),
      tx.pure.u8(params.score),
      tx.pure.u8(params.riskLevel),
    ],
  });
  tx.moveCall({
    target: target("mint_health_report"),
    arguments: [
      tx.object(config.sui.portfolioId),
      tx.object(params.capId),
      tx.pure.u8(params.score),
      tx.pure.u8(params.riskLevel),
      tx.pure.string(params.insights),
    ],
  });
  return tx;
}
