import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, ShieldCheck, FileText } from "lucide-react";
import { useCurrentAccount, useDAppKit, useWallets } from "@mysten/dapp-kit-react";
import { WalletGate } from "../components/WalletGate.js";
import { fetchHistory } from "../lib/api.js";
import { shortAddress as shortAddr } from "../lib/address.js";
import type { HistoryItem } from "@lp-guardian/core";
import "../styles/history.css";

export function History() {
  const { walletAddress } = useParams();
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  const wallets = useWallets();

  async function connect() {
    const wallet = wallets[0];
    if (!wallet) return;
    await dAppKit.connectWallet({ wallet });
  }
  async function disconnect() {
    await dAppKit.disconnectWallet();
  }

  // When the URL carries a wallet (MCP deep-link), that wallet is authoritative and
  // gated behind a connection match. Otherwise fall back to the connected account.
  const activeAddress = walletAddress || account?.address;
  const shortAddress = activeAddress ? shortAddr(activeAddress) : "";

  return (
    <main className="history-theme history-grid-paper">
      <header className="history-header">
        <Link className="history-brand" to="/">
          <img src="/luber-logo.webp" alt="Luber logo" />
          <span>
            <b>Luber</b>
            <small>Diagnostic History</small>
          </span>
        </Link>
        <div className="history-header-actions">
          {account?.address ? (
            <>
              <div className="history-wallet-badge">
                <span
                  className="of-status-dot"
                  style={{ width: 8, height: 8, background: "var(--healthy)", borderRadius: "50%" }}
                />
                {shortAddr(account.address)}
              </div>
              <button className="history-disconnect" onClick={() => disconnect()} aria-label="Disconnect wallet">
                Disconnect
              </button>
            </>
          ) : (
            <Link to="/" className="btn btn-ghost" style={{ fontSize: "0.85rem", padding: "6px 12px" }}>
              <ArrowLeft size={14} /> Back
            </Link>
          )}
        </div>
      </header>

      <div className="history-content">
        {walletAddress ? (
          // Deep-linked: require the connected wallet to match before revealing data.
          <WalletGate expected={walletAddress} label="this history">
            <HistoryFeed address={walletAddress} />
          </WalletGate>
        ) : !account?.address ? (
          <div className="history-empty-state">
            <div className="panel history-empty-panel">
              <h2>Connect Wallet</h2>
              <p>Connect your Sui wallet to view diagnostic history.</p>
              <button
                className="btn btn-primary"
                onClick={() => connect()}
                style={{ width: "100%", justifyContent: "center", height: "48px", fontSize: "1.1rem" }}
              >
                Connect Wallet
              </button>
              <div className="history-safety-note">
                <ShieldCheck size={14} />
                Signing in does not move funds.
              </div>
            </div>
          </div>
        ) : (
          <HistoryFeed address={account.address} />
        )}
      </div>
    </main>
  );
}

function HistoryFeed({ address }: { address: string }) {
  const [filter, setFilter] = useState<"portfolio" | "pool">("portfolio");
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    fetchHistory(address, filter)
      .then((data) => {
        if (mounted) {
          setHistoryItems((data.items as HistoryItem[]) || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [address, filter]);

  return (
    <>
      <div className="history-tabs">
        <button
          className={`history-tab ${filter === "portfolio" ? "active" : ""}`}
          onClick={() => setFilter("portfolio")}
        >
          Portfolio Level
        </button>
        <button className={`history-tab ${filter === "pool" ? "active" : ""}`} onClick={() => setFilter("pool")}>
          Pool Level
        </button>
      </div>

      {loading ? (
        <div className="history-no-data">Loading diagnostics...</div>
      ) : error ? (
        <div className="panel history-no-data" style={{ borderColor: "var(--bleed)", color: "var(--bleed)" }}>
          {error}
        </div>
      ) : historyItems.length === 0 ? (
        <div className="panel history-no-data">
          No diagnostic history yet. Run your first diagnosis from an MCP-compatible agent.
        </div>
      ) : (
        <div className="history-feed">
          {historyItems.map((item) => (
            <article key={item.id} className="panel history-card">
              <div className="history-card-top">
                <div className="history-card-meta">
                  <span className={`history-card-type ${item.type}`}>{item.type.replace("_", " ")}</span>
                  <span className="history-time">{new Date(item.timestamp).toLocaleString()}</span>
                </div>
                <div className="history-card-actions">
                  <button className="btn btn-ghost" style={{ padding: "6px 10px", fontSize: "12px" }}>
                    <FileText size={14} /> View Report
                  </button>
                </div>
              </div>

              <p className="history-summary">{item.summary}</p>

              {(item.moneySaved || item.txDigest) && (
                <div className="history-details">
                  {item.moneySaved && (
                    <div className="history-detail-item positive">Saved ${item.moneySaved.toLocaleString()}</div>
                  )}
                  {item.txDigest && (
                    <div className="history-detail-item">
                      Tx: {item.txDigest.slice(0, 10)}... <ExternalLink size={12} />
                    </div>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
