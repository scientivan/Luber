import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ShieldCheck, ChevronRight } from "lucide-react";
import { WalletGate } from "../components/WalletGate.js";
import { fetchHealth, fetchPositions, simulateShock } from "../lib/api.js";
import "../styles/history.css";

function riskColor(level: string) {
  return level === "green" ? "var(--healthy)" : level === "amber" ? "var(--toxic)" : "var(--bleed)";
}

export function DiagnoseView() {
  const { walletAddress } = useParams();
  return (
    <main className="history-theme history-grid-paper">
      <header className="history-header">
        <Link className="history-brand" to="/">
          <img src="/luber-logo.webp" alt="Luber logo" />
          <span>
            <b>Luber</b>
            <small>Portfolio Diagnosis</small>
          </span>
        </Link>
        <Link to="/" className="btn btn-ghost" style={{ fontSize: "0.85rem", padding: "6px 12px" }}>
          <ArrowLeft size={14} /> Back
        </Link>
      </header>
      <div className="history-content">
        <WalletGate expected={walletAddress} label="this diagnosis">
          <DiagnoseBody walletAddress={walletAddress!} />
        </WalletGate>
      </div>
    </main>
  );
}

function DiagnoseBody({ walletAddress }: { walletAddress: string }) {
  const [params] = useSearchParams();
  const mode = params.get("s") || "preview";
  const sim = params.get("sim"); // "ETH:-10"

  const [health, setHealth] = useState<any>(null);
  const [positions, setPositions] = useState<any[] | null>(null);
  const [shock, setShock] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    const jobs: Promise<void>[] = [
      fetchHealth(walletAddress, { source: "wallet" }).then((h) => {
        if (mounted) setHealth(h);
      }),
    ];
    if (mode === "discover") {
      jobs.push(
        fetchPositions(walletAddress).then((p) => {
          if (mounted) setPositions(p.positions || []);
        })
      );
    }
    if (sim) {
      const [asset, pctStr] = sim.split(":");
      const pct = Number(pctStr);
      if (asset && !Number.isNaN(pct)) {
        jobs.push(
          simulateShock(walletAddress, asset, pct).then((s) => {
            if (mounted) setShock(s);
          })
        );
      }
    }

    Promise.all(jobs)
      .catch((e) => mounted && setError(e.message))
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
    };
  }, [walletAddress, mode, sim]);

  if (loading) return <div className="history-no-data">Analyzing portfolio…</div>;
  if (error)
    return (
      <div className="panel history-no-data" style={{ borderColor: "var(--bleed)", color: "var(--bleed)" }}>
        {error}
      </div>
    );
  if (!health) return <div className="history-no-data">No data.</div>;

  return (
    <div className="history-feed">
      {/* Health headline */}
      <article className="panel history-card">
        <div className="history-card-top">
          <div className="history-card-meta">
            <span className="history-card-type" style={{ background: riskColor(health.riskLevel), color: "#000" }}>
              {health.riskLevel}
            </span>
            <span className="history-time">
              {health.positionCount} positions · ~${Math.round(health.totalValueUSD).toLocaleString()}
            </span>
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "2rem" }}>{health.healthScore}/100</div>
        </div>
        {health.cluster && (
          <p className="history-summary">
            <b>{health.cluster.exposurePct}%</b> of your portfolio is really one{" "}
            <b>{health.cluster.token}</b> bet.
            {health.stress && (
              <>
                {" "}If {health.cluster.token} drops {Math.abs(health.stress.pct ?? 10)}%, you lose ~$
                {Math.round(health.stress.atRiskUSD || 0).toLocaleString()} across all of them at once.
              </>
            )}
          </p>
        )}
        <Link to={`/guard/${walletAddress}`} className="btn btn-primary" style={{ marginTop: 8 }}>
          <ShieldCheck size={16} /> Guard this portfolio
        </Link>
      </article>

      {/* Shock simulation */}
      {shock && (
        <article className="panel history-card">
          <h3 style={{ margin: "0 0 8px" }}>
            Shock: {shock.scenario?.asset} {shock.scenario?.pct}%
          </h3>
          <div className="history-details">
            <div className="history-detail-item">💸 At risk: ${Math.round(shock.atRiskUSD).toLocaleString()}</div>
            <div className="history-detail-item positive">
              🛡️ Guard saves ~${Math.round(shock.guarded?.moneySaved || 0).toLocaleString()}
            </div>
            <div className="history-detail-item">📊 Post-guard health: {shock.guarded?.postHealth}/100</div>
          </div>
          {shock.guarded?.formula && (
            <p className="history-time" style={{ marginTop: 8 }}>
              {shock.guarded.formula}
            </p>
          )}
        </article>
      )}

      {/* Insights */}
      {(health.insights || []).map((i: any) => (
        <article key={i.id} className="panel history-card">
          <div className="history-card-meta">
            <span className={`history-card-type ${i.severity === "critical" ? "fix" : "diagnosis"}`}>
              {i.severity}
            </span>
          </div>
          <p className="history-summary">
            <b>{i.title}</b> — {i.description}
          </p>
        </article>
      ))}

      {/* Bleeding pools → deep diagnose */}
      {(health.bleedingPools?.length ? health.bleedingPools : health.positions || []).map((p: any) => (
        <Link
          key={p.poolId}
          to={`/d/${walletAddress}/pool/${p.poolId}?s=preview`}
          className="panel history-card"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", textDecoration: "none" }}
        >
          <span className="history-summary" style={{ margin: 0 }}>
            {p.pair} {p.status ? `· ${p.status}` : p.inRange === false ? "· out of range" : ""}
          </span>
          <ChevronRight size={18} />
        </Link>
      ))}

      {/* Discovered positions list (discover mode) */}
      {positions && (
        <article className="panel history-card">
          <h3 style={{ margin: "0 0 8px" }}>Discovered positions</h3>
          {positions.map((p, i) => (
            <p key={p.objectId} className="history-summary" style={{ margin: "4px 0" }}>
              {i + 1}. {p.pair} — ~${Math.round(p.valueUSD).toLocaleString()}{" "}
              {p.inRange ? "(in range)" : "⚠ out of range"}
              {p.isDust ? " · dust" : ""}
            </p>
          ))}
        </article>
      )}
    </div>
  );
}
