import type { DeepBookLiquidityProfile } from "@lp-guardian/core";
import { suiClient } from "../chain/suiClient.js";

/**
 * DeepBook Client - Wraps the @mysten/deepbook-v3 SDK.
 * Fetches order book depth, spread, and mid-price for DeepBook pools.
 * Uses lazy init to allow graceful fallback if the SDK is unavailable.
 */
export const deepbookClient = {
  /**
   * Fetch liquidity profile for a pool.
   */
  async getLiquidityProfile(poolId: string, baseToken: string, quoteToken: string): Promise<DeepBookLiquidityProfile> {
    const baseSymbol = baseToken.split("::").pop() || "DEEP";
    const quoteSymbol = quoteToken.split("::").pop() || "USDC";
    const fallback: DeepBookLiquidityProfile = {
      poolId, baseToken: baseSymbol, quoteToken: quoteSymbol,
      midPrice: 1.0, spreadBps: 15, depthUSD: 500_000, depthAt2Percent: 120_000,
    };
    if (!poolId || poolId === "0x0") return fallback;

    try {
      const { DeepBookClient } = await import("@mysten/deepbook-v3");
      const db = new DeepBookClient({ client: suiClient, address: "0x0", env: "testnet" } as any);
      const summary = (db as any).getBookSummary ? await (db as any).getBookSummary(poolId) : null;
      if (!summary) return fallback;

      const askPrice = Number(summary.bestAskPrice ?? 0);
      const bidPrice = Number(summary.bestBidPrice ?? 0);
      const mid = (askPrice + bidPrice) / 2 || 1.0;
      const spread = askPrice - bidPrice;
      const spreadBps = mid > 0 ? Math.round((spread / mid) * 10000) : 15;
      const depth = (Number(summary.askQuantity ?? 0) + Number(summary.bidQuantity ?? 0)) * mid;

      return {
        poolId,
        baseToken: baseSymbol,
        quoteToken: quoteSymbol,
        midPrice: mid,
        spreadBps: Math.max(spreadBps, 1),
        depthUSD: Math.round(depth || 500_000),
        depthAt2Percent: Math.round((depth || 500_000) * 0.24),
      };
    } catch (err) {
      console.warn(`[DeepBook] fallback for pool ${poolId.slice(0, 10)}:`, (err as Error)?.message ?? String(err));
      return fallback;
    }
  },
};
