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
    // Whitelisted pool ids the agent may target in rebalance (Move enforces this).
    whitelist: (process.env.LPG_WHITELIST ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  },

  // Demo portfolios + their StrategistCaps (from deployment.json / .env). Lets a
  // diagnose request target any of the 3 demo wallets, and the watcher arm the
  // real cap for autonomous saves.
  demos: {
    amber: { portfolio: process.env.LPG_DEMO_AMBER_PORTFOLIO ?? "0x0", cap: process.env.LPG_DEMO_AMBER_CAP ?? "0x0" },
    red: { portfolio: process.env.LPG_DEMO_RED_PORTFOLIO ?? "0x0", cap: process.env.LPG_DEMO_RED_CAP ?? "0x0" },
    green: { portfolio: process.env.LPG_DEMO_GREEN_PORTFOLIO ?? "0x0", cap: process.env.LPG_DEMO_GREEN_CAP ?? "0x0" },
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

  // When no package is deployed yet, run on mock data so every surface works.
  get mockMode() {
    return (process.env.MOCK_MODE ?? (this.sui.packageId === "0x0" ? "true" : "false")) === "true";
  },
};

export const explorerTx = (digest: string) => `${config.sui.explorerBase}/tx/${digest}`;
export const explorerObj = (id: string) => `${config.sui.explorerBase}/object/${id}`;

/** Optional explicit wallet→portfolio map (JSON env), e.g. {"0xabc":"0x40fc..."}. */
function walletPortfolioMap(): Record<string, string> {
  try {
    return JSON.parse(process.env.LPG_WALLET_PORTFOLIO_MAP ?? "{}");
  } catch {
    return {};
  }
}

/**
 * Resolve which portfolio a request targets. Accepts: a portfolio id passed
 * directly (demo selector), an explicit wallet→portfolio mapping, then falls back
 * to the primary `LPG_PORTFOLIO_ID`. Returns `{ portfolioId, capId }`.
 */
export function resolvePortfolio(walletOrPortfolio: string): { portfolioId: string; capId: string } {
  const demos = Object.values(config.demos);
  const direct = demos.find((d) => d.portfolio === walletOrPortfolio);
  if (direct) return { portfolioId: direct.portfolio, capId: direct.cap };

  const mapped = walletPortfolioMap()[walletOrPortfolio];
  if (mapped) {
    const d = demos.find((x) => x.portfolio === mapped);
    return { portfolioId: mapped, capId: d?.cap ?? "0x0" };
  }
  const fallback = demos.find((d) => d.portfolio === config.sui.portfolioId);
  return { portfolioId: config.sui.portfolioId, capId: fallback?.cap ?? "0x0" };
}
