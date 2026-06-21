import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { config } from "../config.js";

export const suiClient = new SuiClient({
  url: config.sui.rpcUrl || getFullnodeUrl(config.sui.network),
});

/** Read-only client for discovering a wallet's REAL LP positions (mainnet). */
export const discoveryClient = new SuiClient({ url: config.discovery.rpcUrl });

/** The agent keypair that holds the StrategistCap (never the user's funds). */
export function strategistKeypair(): Ed25519Keypair {
  if (!config.strategist.privateKey) {
    throw new Error("STRATEGIST_PRIVATE_KEY not set — required to sign as the agent.");
  }
  return Ed25519Keypair.fromSecretKey(config.strategist.privateKey);
}
