import type { Position, Protocol } from "@lp-guardian/core";
import { config } from "../config.js";
import { suiClient } from "../chain/suiClient.js";
import { DEMO_POSITIONS, demoPriceHistory } from "../services/mockData.js";

/**
 * Scout — discovers all LP positions for a wallet as Sui objects, and pulls the
 * price history needed for correlation.
 */
export const scout = {
  async discoverPositions(walletAddress: string): Promise<Position[]> {
    // We target the mainnet/testnet release now. Find the Portfolio object owned by the wallet.
    // For MVP/Demo, we might rely on config.sui.portfolioId if set, otherwise search owned objects.
    const portfolioId = config.sui.portfolioId;
    if (!portfolioId || portfolioId === "0x0") {
      console.warn("[Scout] No portfolio ID configured, falling back to mock");
      return DEMO_POSITIONS;
    }

    try {
      // 1. Get dynamic fields (Positions) attached to the Portfolio
      const dfRes = await suiClient.getDynamicFields({ parentId: portfolioId });
      
      const positionObjectIds = dfRes.data
        .filter(df => df.objectType.includes("::Position"))
        .map(df => df.objectId);

      if (positionObjectIds.length === 0) return [];

      // 2. Fetch the actual position objects
      const objects = await suiClient.multiGetObjects({
        ids: positionObjectIds,
        options: { showContent: true }
      });

      // 3. Map and enrich with Cetus/Turbos metadata
      const positions: Position[] = [];
      for (const obj of objects) {
        if (obj.error || !obj.data) continue;
        const mapped = await mapObjectToPosition(obj.data);
        if (mapped) positions.push(mapped);
      }

      return positions;
    } catch (err) {
      console.error("[Scout] Failed to discover positions:", err);
      return DEMO_POSITIONS; // Fallback to mock on error during dev
    }
  },

  async priceHistory(_tokens: string[]): Promise<Record<string, number[]>> {
    // Real: Pyth/Hermes historical or a price-history provider. 
    // Skeleton ready for mainnet integration.
    return demoPriceHistory();
  },
};

/**
 * Converts a raw Sui object (from the Move contract) into a core Position.
 * Enriches with Cetus/Turbos metadata via API/RPC.
 */
async function mapObjectToPosition(obj: any): Promise<Position | null> {
  const content = obj.content;
  if (!content || content.dataType !== "moveObject") return null;

  const fields = content.fields as any;
  const protocolId = Number(fields.protocol);
  const protocolName: Protocol = protocolId === 0 ? "cetus" : protocolId === 1 ? "turbos" : "deepbook";
  
  const tokenX = fields.token_x || "UNKNOWN";
  const tokenY = fields.token_y || "UNKNOWN";

  // Base position mapping from on-chain struct
  const position: Position = {
    objectId: obj.objectId,
    protocol: protocolName,
    poolId: fields.pool_id,
    pair: `-`,
    tokenX,
    tokenY,
    valueUSD: Number(fields.value_usd) / 1e6, // Assuming 6 decimals for USD representation
    inRange: true, // Will be updated via enrichment
    isDust: false
  };

  // Enrich with Cetus/Turbos metadata
  try {
    if (protocolName === "cetus") {
      // Mock Cetus SDK call - in real app, use @cetusprotocol/cetus-sui-clmm-sdk
      // const pool = await cetusSdk.Pool.getPool(fields.pool_id);
      position.inRange = true; 
      position.isDust = position.valueUSD < 5;
    } else if (protocolName === "turbos") {
      // Mock Turbos SDK call - in real app, use turbos-clmm-sdk
      position.inRange = false;
      position.daysOutOfRange = 2;
    }
  } catch (err) {
    console.warn("[Scout] Failed to fetch metadata for  pool", err);
  }

  return position;
}
