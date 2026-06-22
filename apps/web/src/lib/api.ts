import type {
  AuthChallenge,
  AuthSession,
  HistoryItem,
  PoolDeepDive,
  PortfolioHealth,
  RebalanceIntent,
  MigrationResult,
  ShockResult,
  SystemStatus,
} from "@lp-guardian/core";

export const API_BASE = (
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:8787"
).replace(/\/+$/, "");

export const WS_BASE = API_BASE.replace(/^http/, "ws");

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed: ${res.status} ${res.statusText}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) message = data.error;
    } catch {
      // Keep HTTP fallback.
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  sessionToken?: string,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  if (sessionToken) headers.set("Authorization", `Bearer ${sessionToken}`);
  return parseJson<T>(await fetch(`${API_BASE}${path}`, { ...options, headers }));
}

const post = <T>(path: string, body: unknown, sessionToken?: string) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) }, sessionToken);

export const fetchPortfolioHealth = (walletAddress: string) =>
  post<PortfolioHealth>("/portfolio/health", { walletAddress });

export const fetchPoolHealth = (walletAddress: string, poolId: string) =>
  post<PoolDeepDive>("/portfolio/pool-health", { walletAddress, poolId });

export const migratePool = (walletAddress: string, positionId: string) =>
  post<MigrationResult>("/portfolio/migrate", { walletAddress, positionId });

export const simulateShock = (walletAddress: string, asset: string, pct: number) =>
  post<ShockResult>("/simulate/shock", { walletAddress, asset, pct });

export const fetchHistory = (walletAddress: string, filter: "portfolio" | "pool" | "all" = "all") =>
  post<{ items: HistoryItem[]; webLink?: string }>("/portfolio/history", { walletAddress, filter });

export const createAuthChallenge = (walletAddress: string) =>
  post<AuthChallenge>("/auth/challenge", { walletAddress });

export const verifyAuth = (walletAddress: string, nonce: string, signature: string) =>
  post<AuthSession>("/auth/verify", { walletAddress, nonce, signature });

export const logoutSession = (sessionToken: string) =>
  post<{ ok: boolean }>("/auth/logout", {}, sessionToken);

export const prepareRebalance = (walletAddress: string, sessionToken: string) =>
  post<RebalanceIntent>("/portfolio/rebalance/prepare", { walletAddress }, sessionToken);

export const executeRebalance = (
  input: { walletAddress: string; planId: string; signature: string },
  sessionToken: string,
) =>
  post<{
    txDigest: string;
    explorer: string;
    moneySaved: number;
    reportTxDigest: string;
    preview: string;
  }>("/portfolio/rebalance", input, sessionToken);

export interface GuardPreparation {
  eligible: boolean;
  packageId: string;
  portfolioId: string;
  agentAddress: string;
  expiresAtEpoch: number;
}

export const prepareGuard = (walletAddress: string, sessionToken: string) =>
  post<GuardPreparation>("/portfolio/guard/prepare", { walletAddress }, sessionToken);

export const confirmGuard = (
  input: { walletAddress: string; txDigest: string; capId: string },
  sessionToken: string,
) => post<{ active: boolean; capId: string; txDigest: string }>("/portfolio/guard/confirm", input, sessionToken);

export const triggerWatcherShock = (
  input: { walletAddress: string; asset: string; pct: number },
  sessionToken: string,
) => post<{ success: boolean; message: string }>("/watcher/trigger-shock", input, sessionToken);

export interface GuardStatus {
  walletAddress: string;
  guardEnabled: boolean;
  thresholdPct: number;
  lastCheckAt: string | null;
  watching: boolean;
  clusterToken: string | null;
  baselinePrices: Record<string, number>;
  recentActivity: Array<{
    type: string;
    timestamp: string;
    summary: string;
    moneySaved?: number;
    txDigest?: string;
  }>;
  webLink: string;
}

export const fetchGuardStatus = (walletAddress: string) =>
  post<GuardStatus>("/guard/status", { walletAddress });

export const fetchSystemStatus = () => request<SystemStatus>("/status");
