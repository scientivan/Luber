import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import type { SystemStatus } from "@lp-guardian/core";
import { ProductShell } from "../components/ProductShell.js";
import { fetchSystemStatus } from "../lib/api.js";
import { useRealtime } from "../lib/useRealtime.js";
import "../styles/product.css";
import "../styles/status.css";

export function StatusHub() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const realtime = useRealtime();

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
    <ProductShell title="Status hub" subtitle="Live readiness for APIs, data compute, Sui RPC, persistence, watcher, and MCP backing contracts.">
      <section className="panel section-head">
        <div>
          <p className="product-kicker">Overall state</p>
          <h2>{status?.overall ?? "Unknown"}</h2>
          <p>{status ? `Checked ${new Date(status.checkedAt).toLocaleTimeString()}` : "Waiting for backend status."}</p>
        </div>
        <button className="button primary" onClick={() => void refresh()}><RefreshCw size={16} /> Refresh</button>
      </section>
      {error && <div className="notice error">{error}</div>}
      <section className="metric-grid">
        {cards.map(([label, ok, detail]) => (
          <article className={`panel metric ${ok ? "" : "danger"}`} key={label}>
            <span>{label}</span>
            <strong>{ok ? "Operational" : "Degraded"}</strong>
            <small>{detail || "No detail"}</small>
          </article>
        ))}
      </section>
      {status && (
        <section className="panel">
          <h2>MCP readiness semantics</h2>
          <p>This checks backend endpoints used by MCP tools. It cannot inspect a user's local stdio process.</p>
          <div className="event-feed">{status.mcp.tools.map((tool) => <div key={tool}><b>{tool}</b><span>{status.mcp.ok ? "Backing endpoint ready" : "Dependency degraded"}</span></div>)}</div>
        </section>
      )}
      <section className="panel action-bar"><Link className="button" to="/docs#troubleshooting">Troubleshooting</Link><Link className="button" to="/atlas">Diagnostic history</Link></section>
    </ProductShell>
  );
}
