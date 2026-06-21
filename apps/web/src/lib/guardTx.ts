import { Transaction } from "@mysten/sui/transactions";

/**
 * Frontend config for arming Guard (testnet demo contract). The owner signs ONE
 * transaction that mints a revocable StrategistCap for the agent address and
 * transfers it to the agent — the agent can rebalance but Move forbids withdrawal.
 */
export const guardConfig = {
  packageId: import.meta.env.VITE_LPG_PACKAGE_ID as string | undefined,
  portfolioId: import.meta.env.VITE_LPG_PORTFOLIO_ID as string | undefined,
  agentAddress: import.meta.env.VITE_STRATEGIST_ADDRESS as string | undefined,
  // Cap expiry (Sui epoch). Large default so the demo cap doesn't lapse mid-demo.
  expiresAtEpoch: BigInt(import.meta.env.VITE_GUARD_EXPIRES_EPOCH || "18446744073709551615"),
  network: (import.meta.env.VITE_GUARD_NETWORK as string | undefined) || "testnet",
};

export function guardConfigReady(): boolean {
  return Boolean(guardConfig.packageId && guardConfig.portfolioId && guardConfig.agentAddress);
}

/** Build the mint-StrategistCap PTB: authorize_strategist → transfer cap to agent. */
export function buildArmGuardTx(): Transaction {
  const { packageId, portfolioId, agentAddress, expiresAtEpoch } = guardConfig;
  if (!packageId || !portfolioId || !agentAddress) {
    throw new Error("Guard contract env not configured (VITE_LPG_PACKAGE_ID / PORTFOLIO_ID / STRATEGIST_ADDRESS).");
  }
  const tx = new Transaction();
  const cap = tx.moveCall({
    target: `${packageId}::lp_guardian::authorize_strategist`,
    arguments: [
      tx.object(portfolioId),
      tx.pure.address(agentAddress),
      tx.pure.u64(expiresAtEpoch),
    ],
  });
  tx.transferObjects([cap], tx.pure.address(agentAddress));
  return tx;
}
