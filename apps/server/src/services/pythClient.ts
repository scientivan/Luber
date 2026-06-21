import { config } from "../config.js";

/**
 * Pyth price feed IDs for major tokens on Sui.
 * These are the official Pyth Network price feed identifiers.
 * Source: https://pyth.network/developers/price-feed-ids
 */
const PYTH_PRICE_FEED_IDS: Record<string, string> = {
  ETH: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  BTC: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  SUI: "0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744",
  USDC: "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
  USDT: "0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b",
};

interface PythPrice {
  id: string;
  price: { price: string; conf: string; expo: number; publish_time: number };
  ema_price: { price: string; conf: string; expo: number; publish_time: number };
}

interface PythLatestPriceResponse {
  parsed?: PythPrice[];
}

/**
 * Pyth Client - Fetches real-time prices from Pyth Hermes API.
 * Used by the autonomous watcher to detect price drops and trigger saves.
 */
export const pythClient = {
  /**
   * Fetch current prices for a set of tokens from Pyth Hermes.
   * Returns a map of token symbol -> current USD price.
   */
  async getCurrentPrices(tokens: string[]): Promise<Record<string, number>> {
    const prices: Record<string, number> = {};
    
    // Map tokens to their canonical symbols (WETH -> ETH, etc.)
    const canonical = tokens.map(t => canonicalToken(t));
    const uniqueTokens = Array.from(new Set(canonical));
    
    // Get price feed IDs for the tokens we're watching
    const priceIds = uniqueTokens
      .map(t => PYTH_PRICE_FEED_IDS[t.toUpperCase()])
      .filter(Boolean);
    
    if (priceIds.length === 0) {
      console.warn("[pythClient] No valid price feed IDs found for tokens:", tokens);
      return prices;
    }

    try {
      // Pyth Hermes latest_price_feeds endpoint
      const idsParam = priceIds.map(id => `ids[]=${id}`).join("&");
      const url = `${config.pyth.hermesUrl}/v2/updates/price/latest?${idsParam}`;
      
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`[pythClient] Hermes API error: ${res.status}`);
        return prices;
      }

      const data: PythLatestPriceResponse = await res.json();
      
      if (!data.parsed || data.parsed.length === 0) {
        console.warn("[pythClient] No price data returned from Hermes");
        return prices;
      }

      // Parse prices and map back to token symbols
      for (const feed of data.parsed) {
        const tokenSymbol = Object.keys(PYTH_PRICE_FEED_IDS).find(
          k => PYTH_PRICE_FEED_IDS[k] === feed.id
        );
        
        if (tokenSymbol) {
          const priceStr = feed.price.price;
          const expo = feed.price.expo;
          const price = Number(priceStr) * Math.pow(10, expo);
          prices[tokenSymbol] = price;
        }
      }

      return prices;
    } catch (err) {
      console.error("[pythClient] Failed to fetch current prices:", err);
      return prices;
    }
  },
};

/** Canonical token normalization (matches scout.ts logic) */
function canonicalToken(sym: string): string {
  const s = (sym ?? "").trim().toUpperCase();
  if (s === "WETH" || s === "STETH" || s === "WSTETH" || s === "WEETH") return "ETH";
  if (s === "WBTC" || s === "TBTC" || s === "LBTC") return "BTC";
  return s;
}
