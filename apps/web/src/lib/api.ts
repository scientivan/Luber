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
