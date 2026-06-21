import { ArrowRight, ExternalLink, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { OverflowHeader } from "../components/OverflowHeader";
import "../styles/landing.css";
import "../styles/status.css";

const toolRows = [
  ["diagnose_portfolio", "Operational", "14s ago", "Analyze wallet-wide LP risk and aggregate position status."],
  ["diagnose_pool", "Operational", "16s ago", "Inspect a specific Cetus pool or LP position in detail."],
  ["get_diagnostic_history", "Degraded", "21s ago", "Return stored diagnosis records for comparison and review."],
  ["get_mcp_status", "Operational", "11s ago", "Report RPC, MCP server, and protocol data health."],
  ["open_rebalance_link", "Operational", "18s ago", "Open web execution flow when wallet approval is required."],
] as const;

const troubleshootingLinks = [
  ["Install", "MCP Installation Guide", "/docs#installation"],
  ["RPC", "RPC Configuration", "/docs#configuration"],
  ["Wallet", "Wallet Safety Model", "/docs#security"],
  ["History", "Diagnostic History", "/history"],
  ["Prompts", "Example Agent Prompts", "/docs#prompts"],
] as const;

export function StatusHub() {
  return (
    <main className="overflow-theme of-status-main">
      <OverflowHeader mobileMenuOpen={false} />

      <div className="of-status-shell of-grid-paper">
        <section className="of-status-hero">
          <div className="of-status-hero-copy">
            <p className="of-status-kicker">Network & MCP Hub</p>
            <h1>Check system health before diagnosis starts.</h1>
            <p>
              Check whether Luber infrastructure is ready before running diagnosis. MCP tools can diagnose positions,
              but transaction execution happens through the web app.
            </p>
            <div className="of-status-hero-actions">
              <button className="of-status-action dark" type="button" onClick={() => window.location.reload()}>
                <RefreshCw size={16} /> Refresh Status
              </button>
              <Link className="of-status-action" to="/docs#troubleshooting">
                View Troubleshooting
              </Link>
              <Link className="of-status-action violet" to="/docs#intro">
                Open Docs
              </Link>
            </div>
          </div>

          <div className="of-status-hero-meta" aria-label="System route metadata">
            <div className="of-status-meta-cell">
              <span>Route</span>
              <strong><code>/status</code></strong>
            </div>
            <div className="of-status-meta-cell">
              <span>Network</span>
              <strong>Sui Mainnet</strong>
            </div>
            <div className="of-status-meta-cell">
              <span>Wallet Session</span>
              <strong>Not required for diagnosis</strong>
            </div>
            <div className="of-status-meta-cell">
              <span>Last checked</span>
              <strong>14 seconds ago</strong>
            </div>
          </div>
        </section>

        <div className="of-status-content">
          <section className="of-section-top dark">
            <span>System Summary</span>
            <span>&lt;status&gt; rpc / protocol / mcp / tool schema &lt;/status&gt;</span>
          </section>

          <section className="of-status-summary" aria-label="System summary">
            <div className="of-status-summary-main">
              <span className="of-status-summary-label">Overall State</span>
              <h2 className="of-status-summary-value">
                <i className="of-status-indicator of-status-tone-mint" aria-hidden="true" />
                Operational
              </h2>
              <p>Diagnosis endpoints are reachable. One history tool path is slower than baseline, but execution boundaries remain intact.</p>
            </div>
            <div className="of-status-summary-stat">
              <span className="of-status-summary-label">RPC latency</span>
              <strong>182ms</strong>
              <p>Sui mainnet primary node responding within target range.</p>
            </div>
            <div className="of-status-summary-stat">
              <span className="of-status-summary-label">Active tools</span>
              <strong>5 / 5</strong>
              <p>All public MCP tool surfaces are reachable.</p>
            </div>
            <div className="of-status-summary-stat">
              <span className="of-status-summary-label">Schema sync</span>
              <strong>Current</strong>
              <p>Zod-backed tool definitions match current MCP surface.</p>
            </div>
          </section>

          <section className="of-status-panels" aria-label="Health panels">
            <article className="of-status-panel">
              <div className="of-status-panel-head">
                <h2>RPC Health</h2>
                <code>sui.mainnet</code>
              </div>
              <div className="of-status-panel-body">
                <div className="of-status-row">
                  <span className="of-status-row-label">Primary node</span>
                  <span className="of-status-row-value"><i className="of-status-indicator of-status-tone-mint" aria-hidden="true" /> Healthy</span>
                </div>
                <div className="of-status-row">
                  <span className="of-status-row-label">Fallback provider</span>
                  <span className="of-status-row-value"><i className="of-status-indicator of-status-tone-mint" aria-hidden="true" /> Ready</span>
                </div>
                <div className="of-status-row">
                  <span className="of-status-row-label">Latency</span>
                  <span className="of-status-row-value"><code>182ms</code></span>
                </div>
                <div className="of-status-row">
                  <span className="of-status-row-label">Latest checkpoint</span>
                  <span className="of-status-row-value"><code>128,442,110</code></span>
                </div>
                <div className="of-status-row">
                  <span className="of-status-row-label">Network</span>
                  <span className="of-status-row-value">Mainnet</span>
                </div>
              </div>
            </article>

            <article className="of-status-panel">
              <div className="of-status-panel-head">
                <h2>DeFi Protocol Data</h2>
                <code>cetus</code>
              </div>
              <div className="of-status-panel-body">
                <div className="of-status-row">
                  <span className="of-status-row-label">Pool data</span>
                  <span className="of-status-row-value"><i className="of-status-indicator of-status-tone-mint" aria-hidden="true" /> Healthy</span>
                </div>
                <div className="of-status-row">
                  <span className="of-status-row-label">Position fetch</span>
                  <span className="of-status-row-value"><i className="of-status-indicator of-status-tone-mint" aria-hidden="true" /> Healthy</span>
                </div>
                <div className="of-status-row">
                  <span className="of-status-row-label">Price & range feed</span>
                  <span className="of-status-row-value"><i className="of-status-indicator of-status-tone-yellow" aria-hidden="true" /> Slow</span>
                </div>
                <div className="of-status-row">
                  <span className="of-status-row-label">Last sync</span>
                  <span className="of-status-row-value">1 minute ago</span>
                </div>
                <div className="of-status-row">
                  <span className="of-status-row-label">Coverage</span>
                  <span className="of-status-row-value">Pools, positions, range state</span>
                </div>
              </div>
            </article>

            <article className="of-status-panel">
              <div className="of-status-panel-head">
                <h2>MCP Server Status</h2>
                <code>Luber-mcp</code>
              </div>
              <div className="of-status-panel-body">
                <div className="of-status-row">
                  <span className="of-status-row-label">Reachability</span>
                  <span className="of-status-row-value"><i className="of-status-indicator of-status-tone-mint" aria-hidden="true" /> Operational</span>
                </div>
                <div className="of-status-row">
                  <span className="of-status-row-label">Ping</span>
                  <span className="of-status-row-value"><code>34ms</code></span>
                </div>
                <div className="of-status-row">
                  <span className="of-status-row-label">Version</span>
                  <span className="of-status-row-value"><code>0.1.0</code></span>
                </div>
                <div className="of-status-row">
                  <span className="of-status-row-label">Uptime</span>
                  <span className="of-status-row-value">18h 24m</span>
                </div>
                <div className="of-status-row">
                  <span className="of-status-row-label">Last tool call</span>
                  <span className="of-status-row-value"><code>diagnose_portfolio</code></span>
                </div>
                <div className="of-status-row">
                  <span className="of-status-row-label">Schema status</span>
                  <span className="of-status-row-value">Current</span>
                </div>
              </div>
            </article>
          </section>

          <section className="of-section-top">
            <span>Tool Availability</span>
            <span>&lt;tools&gt; diagnosis stays in mcp, execution stays in web &lt;/tools&gt;</span>
          </section>

          <section className="of-status-table-wrap" aria-label="Tool availability table">
            <table className="of-status-table">
              <thead>
                <tr>
                  <th>Tool</th>
                  <th>Status</th>
                  <th>Last Checked</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {toolRows.map(([tool, status, lastChecked, description]) => (
                  <tr key={tool}>
                    <td><code>{tool}</code></td>
                    <td>
                      <span className={`of-status-pill ${status === "Degraded" ? "yellow" : "mint"}`}>
                        {status}
                      </span>
                    </td>
                    <td>{lastChecked}</td>
                    <td>{description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="of-section-top dark">
            <span>Troubleshooting</span>
            <span>&lt;support&gt; inspect install / rpc / auth / history &lt;/support&gt;</span>
          </section>

          <section className="of-status-links" aria-label="Troubleshooting links">
            {troubleshootingLinks.map(([label, title, href]) => (
              <Link key={title} className="of-status-link-card" to={href}>
                <span>{label}</span>
                <strong>{title}</strong>
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            ))}
          </section>

          <section className="of-status-note" aria-label="Safety note">
            <p>Luber provides risk analysis, not financial advice.</p>
            <p>Transactions require explicit wallet approval before execution.</p>
            <p>Signing in verifies wallet ownership. It does not move funds.</p>
          </section>
        </div>
      </div>

      <footer className="of-follow">
        <div className="of-follow-inner">
          <div>
            <p className="of-kicker">Need deeper context?</p>
            <h2>Inspect docs, then return to diagnosis.</h2>
          </div>
          <div className="of-follow-actions">
            <Link className="of-status-action dark" to="/docs">
              Open documentation <ExternalLink size={18} />
            </Link>
            <Link className="of-status-action" to="/#overview">
              Back to overview
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
