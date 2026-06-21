import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ExternalLink, FileText } from "lucide-react";
import type { HistoryItem } from "@lp-guardian/core";
import { fetchHistory } from "../lib/api.js";
import { WalletGate } from "../components/WalletGate.js";
import "../styles/history.css";

export function History() {
  const { walletAddress } = useParams();
  const navigate = useNavigate();
  const [wallet, setWallet] = useState(walletAddress ?? "");
  const [filter, setFilter] = useState<"portfolio" | "pool">("portfolio");
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(target = wallet) {
    if (!target) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchHistory(target, filter);
      setHistoryItems(data.items);
      if (!walletAddress) navigate(`/history/${target}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load history");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!walletAddress) return;
    setWallet(walletAddress);
    void load(walletAddress);
  }, [walletAddress, filter]);

  const content = (
    <>
      <section className="panel" style={{ marginBottom: 24 }}>
        <h2>Inspect wallet activity</h2>
        <p>Diagnosis and on-chain action summaries are public, matching Sui portfolio data.</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <input
            value={wallet}
            onChange={(event) => setWallet(event.target.value)}
            placeholder="Sui wallet address"
            style={{ flex: 1, minWidth: 260, padding: 12, border: "2px solid var(--ink)" }}
          />
          <button className="btn btn-primary" onClick={() => void load()} disabled={!wallet || loading}>
            {loading ? "Loading…" : "Load history"}
          </button>
        </div>
      </section>

      <div className="history-tabs">
        <button className={`history-tab ${filter === "portfolio" ? "active" : ""}`} onClick={() => setFilter("portfolio")}>Portfolio Level</button>
        <button className={`history-tab ${filter === "pool" ? "active" : ""}`} onClick={() => setFilter("pool")}>Pool Level</button>
      </div>

      {error ? <div className="panel history-no-data" style={{ color: "var(--bleed)" }}>{error}</div> :
        loading ? <div className="history-no-data">Loading diagnostics…</div> :
        !walletAddress ? <div className="panel history-no-data">Enter a wallet address to inspect public activity.</div> :
        historyItems.length === 0 ? <div className="panel history-no-data">No saved activity yet for this wallet.</div> :
        <div className="history-feed">
          {historyItems.map((item) => (
            <article key={item.id} className="panel history-card">
              <div className="history-card-top">
                <div className="history-card-meta">
                  <span className={`history-card-type ${item.type}`}>{item.type.replace("_", " ")}</span>
                  <span className="history-time">{new Date(item.timestamp).toLocaleString()}</span>
                </div>
                <Link className="btn btn-ghost" to={item.level === "portfolio" ? `/d/${walletAddress}` : `/history/${walletAddress}`}>
                  <FileText size={14} /> View context
                </Link>
              </div>
              <p className="history-summary">{item.summary}</p>
              {(item.moneySaved != null || item.txDigest) && (
                <div className="history-details">
                  {item.moneySaved != null && <div className="history-detail-item positive">Saved ${item.moneySaved.toLocaleString()}</div>}
                  {item.txDigest && <a className="history-detail-item" href={`https://suiscan.xyz/testnet/tx/${item.txDigest}`} target="_blank" rel="noreferrer">Tx: {item.txDigest.slice(0, 10)}… <ExternalLink size={12} /></a>}
                </div>
              )}
            </article>
          ))}
        </div>
      }
    </>
  );

  return (
    <main className="history-theme history-grid-paper">
      <header className="history-header">
        <Link className="history-brand" to="/">
          <img src="/luber-logo.webp" alt="Luber logo" />
          <span><b>Luber</b><small>Public Diagnostic History</small></span>
        </Link>
        <Link to="/status" className="btn btn-ghost">System status</Link>
      </header>

      <div className="history-content">
        {walletAddress ? <WalletGate expected={walletAddress}>{content}</WalletGate> : content}
      </div>
    </main>
  );
}
