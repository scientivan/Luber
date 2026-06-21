export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8787";

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed: ${res.status} ${res.statusText}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) message = data.error;
    } catch {
      // ponytail: plain fallback until backend returns a stricter error envelope.
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export async function fetchHistory(walletAddress: string, filter?: "portfolio" | "pool") {
  const res = await fetch(`${API_BASE}/portfolio/history`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, filter }),
  });
  return parseJson<{ items: unknown[]; webLink?: string }>(res);
}

export async function executeRebalance({ walletAddress, planId }: { walletAddress: string; planId?: string }) {
  const res = await fetch(`${API_BASE}/portfolio/rebalance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, planId }),
  });
  return parseJson<{
    txDigest: string;
    explorer: string;
    moneySaved: number;
    reportTxDigest: string;
    preview: string;
  }>(res);
}

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson<T>(res);
}

export function fetchPositions(walletAddress: string) {
  return post<{ positions: any[]; count: number; valueBasis: string }>("/wallet/positions", {
    walletAddress,
  });
}

export function fetchHealth(
  walletAddress: string,
  opts?: { source?: "wallet" | "portfolio"; positionIds?: string[] }
) {
  return post<any>("/portfolio/health", { walletAddress, ...opts });
}

export function simulateShock(walletAddress: string, asset: string, pct: number) {
  return post<any>("/simulate/shock", { walletAddress, asset, pct });
}

export function fetchPoolDiagnose(walletAddress: string, poolId: string) {
  return post<any>("/pool/diagnose", { walletAddress, poolId });
}

export function fetchGuardStatus(walletAddress: string) {
  return post<any>("/guard/status", { walletAddress });
}

export function registerGuard(payload: {
  walletAddress: string;
  capId?: string;
  portfolioId?: string;
  txDigest?: string;
}) {
  return post<{ ok: boolean; watching: boolean; portfolioId: string; clusterToken: string | null }>(
    "/guard/register",
    payload
  );
}
