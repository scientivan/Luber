import { Transaction } from "@mysten/sui/transactions";
import { config } from "../config.js";

const target = (fn: string) => `${config.sui.packageId}::lp_guardian::${fn}`;

/**
 * Build the correlation-aware rebalance PTB. All legs (exit old / enter new via
 * DeepBook + Cetus/Turbos) settle atomically — one signature, all-or-nothing.
 * The Move `rebalance` call enforces whitelist + slippage bounds.
 */
export function buildRebalanceTx(params: {
  portfolioId: string;
  capId: string;
  targetPools: string[];
  newValueUsd: number[];
  slippageBps: number;
}): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: target("rebalance"),
    arguments: [
      tx.object(params.portfolioId),
      tx.object(params.capId),
      tx.pure.vector("address", params.targetPools),
      tx.pure.vector("u64", params.newValueUsd),
      tx.pure.u64(params.slippageBps),
    ],
  });

  return tx;
}

/** Build the mint_health_report PTB (immutable audit trail). */
export function buildHealthReportTx(params: {
  portfolioId: string;
  capId: string;
  score: number;
  riskLevel: number;
  insights: string;
  allocation: string;
  confidence: number;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: target("mint_health_report"),
    arguments: [
      tx.object(params.portfolioId),
      tx.object(params.capId),
      tx.pure.u8(params.score),
      tx.pure.u8(params.riskLevel),
      tx.pure.string(params.insights),
      tx.pure.string(params.allocation),
      tx.pure.u8(params.confidence),
    ],
  });
  return tx;
}
