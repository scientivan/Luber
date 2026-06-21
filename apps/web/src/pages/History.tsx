import { useEffect, useState, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, ExternalLink, ShieldCheck, WalletCards } from "lucide-react";
import { useCurrentAccount, useDAppKit, useWallets } from "@mysten/dapp-kit-react";
import { fetchHistory } from "../lib/api.js";
import type { HistoryItem } from "@lp-guardian/core";
import { HoverGridBackground } from "../components/HoverGridBackground.js";
import "../styles/history.css";

const typeLabel: Record<HistoryItem["type"], string> = {
  diagnosis: "Diagnosis",
  fix: "Rebalance",
  autonomous_save: "Guard Save",
};

export function History() {
  const { walletAddress } = useParams();
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  const wallets = useWallets();
  const connectedAddress = account?.address;
  const viewAddress = walletAddress || connectedAddress;
  const isWalletConnected = !!connectedAddress;
  const isRouteBound = !!walletAddress;
  const isWalletMatch = !walletAddress || !connectedAddress || walletAddress.toLowerCase() === connectedAddress.toLowerCase();
  const heroRef = useRef<HTMLElement>(null);

  async function connect() {
    const wallet = wallets[0];
    if (!wallet) return;
    await dAppKit.connectWallet({ wallet });
  }

  async function disconnect() {
    await dAppKit.disconnectWallet();
  }

  const [filter, setFilter] = useState<"portfolio" | "pool">("portfolio");
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!viewAddress || !isWalletMatch) return;
    let mounted = true;
    setLoading(true);
    setError(null);

    fetchHistory(viewAddress, filter)
      .then((data) => {
        if (!mounted) return;
        setHistoryItems(data.items || []);
        setLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.message);
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [viewAddress, filter, isWalletMatch]);

  const shortAddress = viewAddress ? `${viewAddress.slice(0, 6)}...${viewAddress.slice(-4)}` : "";
  const connectedShortAddress = connectedAddress ? `${connectedAddress.slice(0, 6)}...${connectedAddress.slice(-4)}` : "";
  const lastTimestamp = historyItems[0]?.timestamp;
  const savedTotal = historyItems.reduce((sum, item) => sum + (item.moneySaved ?? 0), 0);
  const riskyCount = historyItems.filter((item) => item.type !== "diagnosis").length;

  return (
    <main className="history-theme">
      <header className="history-header">
        <Link className="history-brand" to="/">
          <img src="/luber-logo.webp" alt="Luber logo" />
          <span>
            <b>Luber</b>
            <small>Diagnostic History</small>
          </span>
        </Link>
        <div className="history-header-actions">
          {isWalletConnected ? (
            <>
              <div className="history-wallet-badge">
                <span className="history-dot" aria-hidden="true" />
                <span>Wallet</span>
                <strong>{connectedShortAddress}</strong>
              </div>
              <button className="history-disconnect" type="button" onClick={() => disconnect()}>
                Disconnect
              </button>
            </>
          ) : (
            <Link className="history-back" to="/">
              <ArrowLeft size={15} /> Overview
            </Link>
          )}
        </div>
      </header>

      {!isWalletConnected ? (
        <section className="history-auth history-grid-paper">
          <div className="history-auth-panel">
            <span className="history-kicker">Web3 Authentication</span>
            <h1>{isRouteBound ? "Connect The Linked Wallet To Continue." : "Connect Wallet To Unlock Diagnosis Memory."}</h1>
            <p>
              {isRouteBound
                ? `This history link is bound to ${shortAddress}. Connect that exact wallet address to review its stored diagnosis history.`
                : "View portfolio history, compare pool-level reports, and return to wallet-approved execution only when you choose to act."}
            </p>
            <button className="history-primary" type="button" onClick={() => connect()}>
              <WalletCards size={18} /> Connect Wallet
            </button>
            <div className="history-auth-note"><ShieldCheck size={15} /> Signing in verifies wallet ownership. It does not move funds.</div>
          </div>
        </section>
      ) : !isWalletMatch ? (
        <section className="history-auth history-grid-paper">
          <div className="history-auth-panel mismatch">
            <span className="history-kicker">Wallet Mismatch</span>
            <h2>Connected Wallet Does Not Match This History Link.</h2>
            <p>Linked wallet: {shortAddress}. Connected wallet: {connectedShortAddress}. Disconnect and reconnect with the wallet from the link to continue.</p>
            <div className="history-state-actions">
              <button className="history-primary" type="button" onClick={() => disconnect()}>Disconnect Wallet</button>
              <Link className="history-outline" to="/history">Open my connected history</Link>
            </div>
          </div>
        </section>
      ) : (
        <>
          <section className="history-hero" ref={heroRef} style={{ position: "relative" }}>
            <HoverGridBackground
              className="hover-grid-background"
              gridClassName="hover-grid-background-canvas"
              squareSize={56}
              borderColor="var(--history-grid)"
              trailLength={8}
              targetRef={heroRef}
            />
            <div className="history-section-top">
              <span>Diagnostic History</span>
              <span>&lt;history&gt; portfolio memory / pool review / explicit execution &lt;/history&gt;</span>
            </div>
            <div className="history-hero-copy">
              <div>
                <h1>Review Stored LP Diagnosis Before Capital Moves.</h1>
                <p>Persistent portfolio-level and pool-level records, structured for fast review, human approval, and safer next actions.</p>
              </div>
              <div className="history-hero-actions">
                <Link className="history-outline" to="/docs#prompts">
                  Agent prompts <ArrowUpRight size={17} />
                </Link>
                <Link className="history-outline dark" to="/status">
                  MCP Hub
                </Link>
              </div>
            </div>
            <div className="history-metrics">
              <article><span>Network</span><strong>Sui Mainnet</strong><p>Public diagnosis, explicit wallet boundary.</p></article>
              <article><span>Last diagnosis</span><strong>{lastTimestamp ? new Date(lastTimestamp).toLocaleString() : "No records"}</strong><p>Newest report stored for this wallet.</p></article>
              <article><span>Saved events</span><strong>{historyItems.length}</strong><p>Portfolio and pool-level diagnosis records.</p></article>
              <article><span>Capital preserved</span><strong>${savedTotal.toLocaleString()}</strong><p>Estimated savings from fix or guard events.</p></article>
            </div>
          </section>

          <section className="history-shell">
            <div className="history-toolbar">
              <div className="history-tabs" role="tablist" aria-label="History level filter">
                <button className={`history-tab ${filter === "portfolio" ? "active" : ""}`} type="button" onClick={() => setFilter("portfolio")}>Portfolio Level</button>
                <button className={`history-tab ${filter === "pool" ? "active" : ""}`} type="button" onClick={() => setFilter("pool")}>Pool Level</button>
              </div>
              <div className="history-toolbar-meta">
                <span>{riskyCount} action-ready events</span>
                <span>{shortAddress}</span>
              </div>
            </div>

            {loading ? (
              <div className="history-state">Loading diagnostic history...</div>
            ) : error ? (
              <div className="history-state error">Diagnostic history could not be loaded. {error}</div>
            ) : historyItems.length === 0 ? (
              <div className="history-state empty">
                <h2>No diagnostic history yet.</h2>
                <p>Run your first diagnosis from an MCP-compatible agent or start from Atlas.</p>
                <div className="history-state-actions">
                  <Link className="history-outline" to="/docs#installation">Install MCP</Link>
                  <Link className="history-outline dark" to="/atlas">Run Diagnosis</Link>
                </div>
              </div>
            ) : (
              <div className="history-feed">
                {historyItems.map((item) => (
                  <article key={item.id} className={`history-card type-${item.type}`}>
                    <div className="history-card-top">
                      <div className="history-card-tags">
                        <span className="history-card-type">{typeLabel[item.type]}</span>
                        <span className="history-card-level">{item.level === "pool" ? "Pool Level" : "Portfolio Level"}</span>
                        <span className="history-card-time">{new Date(item.timestamp).toLocaleString()}</span>
                      </div>
                      <Link className="history-card-link" to="/status">
                        View route <ArrowUpRight size={16} />
                      </Link>
                    </div>
                    <p className="history-summary">{item.summary}</p>
                    <div className="history-card-meta">
                      <div><span>Risk log</span><strong>{item.type === "diagnosis" ? "Review" : "Action taken"}</strong></div>
                      <div><span>Scope</span><strong>{item.level === "pool" ? "Single pool" : "Wallet-wide"}</strong></div>
                      <div><span>Money saved</span><strong>{item.moneySaved ? `$${item.moneySaved.toLocaleString()}` : "—"}</strong></div>
                      <div><span>Tx digest</span><strong>{item.txDigest ? `${item.txDigest.slice(0, 10)}…` : "—"}</strong></div>
                    </div>
                    <div className="history-card-actions">
                      <button className="history-inline" type="button"><span>View Report</span><ArrowUpRight size={16} /></button>
                      {item.txDigest ? (
                        <a className="history-inline" href={`https://suiscan.xyz/testnet/tx/${item.txDigest}`} target="_blank" rel="noreferrer">
                          <span>Open Tx</span><ExternalLink size={15} />
                        </a>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
