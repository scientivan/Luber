import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { WalletGate } from "../components/WalletGate.js";
import { fetchPoolDiagnose } from "../lib/api.js";
import "../styles/history.css";

export function PoolView() {
  const { walletAddress, poolId } = useParams();
  return (
    <main className="history-theme history-grid-paper">
      <header className="history-header">
        <Link className="history-brand" to="/">
          <img src="/luber-logo.webp" alt="Luber logo" />
          <span>
            <b>Luber</b>
            <small>Pool Deep-Dive</small>
          </span>
        </Link>
        <Link
          to={`/d/${walletAddress}?s=preview`}
          className="btn btn-ghost"
          style={{ fontSize: "0.85rem", padding: "6px 12px" }}
        >
          <ArrowLeft size={14} /> Portfolio
        </Link>
      </header>
      <div className="history-content">
        <WalletGate expected={walletAddress} label="this pool diagnosis">
          <PoolBody walletAddress={walletAddress!} poolId={poolId!} />
        </WalletGate>
      </div>
    </main>
  );
}

function PoolBody({ walletAddress, poolId }: { walletAddress: string; poolId: string }) {
  const [pool, setPool] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    fetchPoolDiagnose(walletAddress, poolId)
      .then((p) => mounted && setPool(p))
      .catch((e) => mounted && setError(e.message))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [walletAddress, poolId]);

  if (loading) return <div className="history-no-data">Deep-diagnosing pool…</div>;
  if (error)
    return (
      <div className="panel history-no-data" style={{ borderColor: "var(--bleed)", color: "var(--bleed)" }}>
        {error}
      </div>
    );
  if (!pool || pool.error) return <div className="history-no-data">{pool?.error || "No data."}</div>;

  const ex = pool.exitLiquidity || {};
  return (
    <div className="history-feed">
      <article className="panel history-card">
        <div className="history-card-top">
          <div className="history-card-meta">
            <span className="history-card-type diagnosis">{pool.protocol}</span>
            <span className="history-time">{pool.inRange ? "In range" : "Out of range"}</span>
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem" }}>{pool.pair}</div>
        </div>
        <p className="history-summary">Value: ${Math.round(pool.valueUSD).toLocaleString()}</p>
      </article>

      <article className="panel history-card">
        <h3 style={{ margin: "0 0 8px" }}>Impermanent loss</h3>
        <p className="history-summary">
          ~<b>{pool.ilEstimatePct}%</b> drag vs HODL (≈${Math.round(pool.ilEstimateUSD).toLocaleString()}).
        </p>
      </article>

      <article className="panel history-card">
        <h3 style={{ margin: "0 0 8px" }}>Cluster contribution</h3>
        <p className="history-summary">
          {pool.inCluster ? (
            <>
              Contributes <b>{pool.clusterContributionPct}%</b> of your <b>{pool.clusterToken}</b> correlation
              cluster.
            </>
          ) : (
            <>Not part of the dominant {pool.clusterToken} cluster.</>
          )}
        </p>
      </article>

      <article className="panel history-card">
        <h3 style={{ margin: "0 0 8px" }}>Exit liquidity (DeepBook)</h3>
        {ex.depthUSD != null ? (
          <div className="history-details">
            <div className="history-detail-item">Depth: ${Math.round(ex.depthUSD).toLocaleString()}</div>
            <div className="history-detail-item">Spread: {ex.spreadBps} bps</div>
            <div className="history-detail-item">Est. slippage: {ex.slippageBps} bps</div>
            <div className={`history-detail-item ${ex.feasible ? "positive" : ""}`}>
              {ex.feasible ? "✅ Exit feasible" : "⚠ Thin — exit may slip"}
            </div>
          </div>
        ) : (
          <p className="history-summary">No DeepBook depth available for this pool.</p>
        )}
      </article>
    </div>
  );
}
