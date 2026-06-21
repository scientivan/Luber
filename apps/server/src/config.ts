import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 8787),
  beDataUrl: process.env.BE_DATA_URL ?? "http://localhost:8000",

  sui: {
    network: (process.env.SUI_NETWORK ?? "testnet") as "testnet" | "mainnet" | "devnet",
    rpcUrl: process.env.SUI_RPC_URL ?? "https://fullnode.testnet.sui.io:443",
    explorerBase: process.env.SUI_EXPLORER_BASE ?? "https://suiscan.xyz/testnet",
    packageId: process.env.LPG_PACKAGE_ID ?? "0x0",
    portfolioId: process.env.LPG_PORTFOLIO_ID ?? "0x0",
  },

  strategist: {
    // Agent key holds the StrategistCap only — never the user's funds.
    privateKey: process.env.STRATEGIST_PRIVATE_KEY ?? "",
  },

  watcher: {
    enabled: (process.env.WATCHER_ENABLED ?? "true") === "true",
    pollMs: Number(process.env.WATCHER_POLL_MS ?? 5000),
  },

  pyth: {
    hermesUrl: process.env.PYTH_HERMES_URL ?? "https://hermes.pyth.network",
  },

  ai: {
    apiKey: process.env.GEMINI_API_KEY ?? "",
    model: process.env.AI_MODEL ?? "gemini-1.5-flash",
    enabled: !!process.env.GEMINI_API_KEY,
  },

  // When no package is deployed yet, run on mock data so every surface works.
  get mockMode() {
    return (process.env.MOCK_MODE ?? (this.sui.packageId === "0x0" ? "true" : "false")) === "true";
  },
};

export const explorerTx = (digest: string) => `/tx/`;
export const explorerObj = (id: string) => `/object/`;
