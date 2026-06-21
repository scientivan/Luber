import type { Position } from "@lp-guardian/core";
import { config } from "../config.js";
import { suiClient } from "../chain/suiClient.js";
import { DEMO_POSITIONS, demoPriceHistory } from "../services/mockData.js";

/**
 * Scout — discovers all LP positions for a wallet as Sui objects, and pulls the
 * price history needed for correlation. In mock mode it returns the canonical
 * demo wallet so every other surface can develop independently (Day-0).
 */
export const scout = {
  async discoverPositions(walletAddress: string): Promise<Position[]> {
    if (config.mockMode) return DEMO_POSITIONS;

    // Real: read owned Portfolio/Position objects via RPC, enrich with
    // Cetus/Turbos pool metadata. (Filled in on Day 2 integration.)
    const owned = await suiClient.getOwnedObjects({
      owner: walletAddress,
      filter: { StructType: `${config.sui.packageId}::lp_guardian::Position` },
      options: { showContent: true },
    });
    return owned.data.map(mapObjectToPosition).filter(Boolean) as Position[];
  },

  async priceHistory(_tokens: string[]): Promise<Record<string, number[]>> {
    // Real: Pyth/Hermes historical or a price-history provider. Mock for now.
    return demoPriceHistory();
  },
};

function mapObjectToPosition(obj: unknown): Position | null {
  // Placeholder mapper — shape depends on the deployed Move struct.
  void obj;
  return null;
}
