import "dotenv/config";
import { isValidSuiAddress, normalizeSuiAddress } from "@mysten/sui/utils";

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

  auth: {
    challengeTtlMs: Number(process.env.AUTH_CHALLENGE_TTL_MS ?? 5 * 60_000),
    sessionTtlMs: Number(process.env.AUTH_SESSION_TTL_MS ?? 24 * 60 * 60_000),
    rebalanceIntentTtlMs: Number(process.env.REBALANCE_INTENT_TTL_MS ?? 5 * 60_000),
  },

  watcher: {
    enabled: (process.env.WATCHER_ENABLED ?? "true") === "true",
    pollMs: Number(process.env.WATCHER_POLL_MS ?? 5000),
    thresholdPct: Number(process.env.WATCHER_THRESHOLD_PCT ?? -5), // default -5% drop triggers save
  },

  pyth: {
    hermesUrl: process.env.PYTH_HERMES_URL ?? "https://hermes.pyth.network",
  },

  cetus: {
    apiUrl: process.env.CETUS_API_URL ?? "https://api-sui.cetus.zone",
  },

  // Read-only discovery of a wallet's REAL Cetus LP positions. Defaults to MAINNET
  // (that's where real liquidity lives) regardless of the contract network.
  discovery: {
    rpcUrl: process.env.DISCOVERY_RPC_URL ?? "https://fullnode.mainnet.sui.io:443",
    cetusPkg:
      process.env.CETUS_CLMM_PKG ??
      "0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb",
  },

  supabase: {
    url: process.env.SUPABASE_URL ?? "",
    anonKey: process.env.SUPABASE_ANON_KEY ?? "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
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

export function normalizeAddress(value: string): string {
  if (!isValidSuiAddress(value)) throw new Error("Invalid Sui address");
  return normalizeSuiAddress(value);
}

export function configuredDemoWallets(): Set<string> {
  const wallets = new Set<string>();
  for (const key of Object.keys(walletPortfolioMap())) {
    try {
      wallets.add(normalizeAddress(key));
    } catch {
      // Ignore malformed deployment config instead of authorizing it.
    }
  }
  if (process.env.LPG_OWNER_ADDRESS) {
    try {
      wallets.add(normalizeAddress(process.env.LPG_OWNER_ADDRESS));
    } catch {
      // Invalid owner env is handled as no eligible wallet.
    }
  }
  return wallets;
}

/**
 * Resolve which portfolio a request targets. Accepts: a portfolio id passed
 * directly (demo selector) or an explicit wallet→portfolio mapping.
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
  throw new Error("Wallet is not mapped to an LP Guardian demo portfolio");
}

export function resolveActionPortfolio(walletAddress: string): { portfolioId: string; capId: string } {
  const wallet = normalizeAddress(walletAddress);
  if (!configuredDemoWallets().has(wallet)) {
    throw new Error("On-chain actions are available only for configured demo wallets");
  }
  const mapping = walletPortfolioMap();
  const mappedKey = Object.keys(mapping).find((key) => {
    try {
      return normalizeAddress(key) === wallet;
    } catch {
      return false;
    }
  });
  const portfolioId = mappedKey ? mapping[mappedKey] : config.sui.portfolioId;
  const demo = Object.values(config.demos).find((item) => item.portfolio === portfolioId);
  if (!portfolioId || portfolioId === "0x0" || !demo?.cap || demo.cap === "0x0") {
    throw new Error("Demo wallet has no configured portfolio or StrategistCap");
  }
  return { portfolioId, capId: demo.cap };
}
