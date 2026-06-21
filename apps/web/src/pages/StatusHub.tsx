import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, ArrowLeft, ArrowUpRight } from "lucide-react";
import type { SystemStatus } from "@lp-guardian/core";
import { fetchSystemStatus } from "../lib/api.js";
import { useRealtime } from "../lib/useRealtime.js";
import { HoverGridBackground } from "../components/HoverGridBackground.js";
import "../styles/history.css";
import "../styles/status.css";

export function StatusHub() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const realtime = useRealtime();
  const heroRef = useRef<HTMLElement>(null);

  async function refresh() {
    setError(null);
    try {
      setStatus(await fetchSystemStatus());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status unavailable");
    }
  }

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const event = realtime.events.find((item) => item.type === "status_update");
    if (event) setStatus(event.data as unknown as SystemStatus);
  }, [realtime.events]);

  const cards = status ? [
    ["API", status.api.ok, `${status.api.uptimeSeconds}s uptime`],
    ["Sui RPC", status.rpc.ok, status.rpc.ok ? `${status.rpc.latencyMs}ms · checkpoint ${status.rpc.checkpoint}` : status.rpc.error],
    ["BE Data", status.beData.ok, status.beData.ok ? `${status.beData.latencyMs}ms` : status.beData.error],
    ["Supabase", status.supabase.ok, status.supabase.ok ? `${status.supabase.latencyMs}ms` : status.supabase.error],
    ["Watcher", status.watcher.running, `${status.watcher.guardedWallets} guarded wallets`],
    ["MCP backing APIs", status.mcp.ok, `${status.mcp.tools.length} tool contracts`],
  ] as const : [];

  return (
    <main className="history-theme">
      <header className="history-header">
        <Link className="history-brand" to="/">
          <img src="/luber-logo.webp" alt="Luber logo" />
          <span>
            <b>Luber</b>
            <small>System Status</small>
          </span>
        </Link>
        <div className="history-header-actions">
          <Link className="history-back" to="/">
            <ArrowLeft size={15} /> Overview
          </Link>
        </div>
      </header>

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
          <span>{status?.overall ?? "Unknown"}</span>
          <span>{status ? `Checked ${new Date(status.checkedAt).toLocaleTimeString()}` : "Waiting for backend status"}</span>
        </div>
        <div className="history-hero-copy">
          <div>
            <h1>System Readiness &amp; Uptime.</h1>
            <p>Live readiness for APIs, data compute, Sui RPC, persistence, watcher, and MCP backing contracts.</p>
            <div className="history-hero-actions">
              <button className="history-primary" type="button" onClick={() => void refresh()}>
                <RefreshCw size={16} /> Refresh Status
              </button>
              <Link className="history-outline dark" to="/docs#troubleshooting">
                Troubleshooting
              </Link>
            </div>
            {error && <div className="history-auth-note" style={{ color: "var(--history-orange)" }}>{error}</div>}
          </div>
        </div>
      </section>

      {status && (
        <section className="history-shell">
          <div className="history-toolbar">
            <div className="history-tabs">
              <button className="history-tab is-active" type="button">Core Services</button>
            </div>
          </div>
          <div className="history-metrics">
            {cards.map(([label, ok, detail]) => (
              <article key={label}>
                <span>{label}</span>
                <strong style={{ color: ok ? "var(--history-mint)" : "var(--history-orange)" }}>
                  {ok ? "Operational" : "Degraded"}
                </strong>
                <p>{detail || "No detail"}</p>
              </article>
            ))}
          </div>

          <div className="history-toolbar" style={{ marginTop: "48px" }}>
            <div className="history-tabs">
              <button className="history-tab is-active" type="button">MCP Readiness Semantics</button>
            </div>
          </div>
          <div className="history-state" style={{ padding: "0" }}>
            <div style={{ padding: "32px" }}>
              <h2 style={{ margin: "0", fontSize: "1.5rem" }}>Tool Backing Endpoints</h2>
              <p style={{ marginTop: "12px", maxWidth: "60ch" }}>This checks backend endpoints used by MCP tools. It cannot inspect a user's local stdio process.</p>
            </div>
            <div className="status-tool-list">
              {status.mcp.tools.map((tool) => (
                <div key={tool} className="status-tool-item">
                  <b>{tool}</b>
                  <span style={{ color: status.mcp.ok ? "var(--history-mint)" : "var(--history-orange)", fontWeight: 800 }}>
                    {status.mcp.ok ? "Endpoint ready" : "Dependency degraded"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
