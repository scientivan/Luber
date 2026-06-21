import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ShieldCheck, ExternalLink, Loader2 } from "lucide-react";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { WalletGate } from "../components/WalletGate.js";
import { fetchGuardStatus, registerGuard } from "../lib/api.js";
import { buildArmGuardTx, guardConfig, guardConfigReady } from "../lib/guardTx.js";
import "../styles/history.css";

const EXPLORER = "https://suiscan.xyz/testnet/tx";

export function GuardView() {
  const { walletAddress } = useParams();
  return (
    <main className="history-theme history-grid-paper">
      <header className="history-header">
        <Link className="history-brand" to="/">
          <img src="/luber-logo.webp" alt="Luber logo" />
          <span>
            <b>Luber</b>
            <small>Autopilot Guard</small>
          </span>
        </Link>
        <Link to="/" className="btn btn-ghost" style={{ fontSize: "0.85rem", padding: "6px 12px" }}>
          <ArrowLeft size={14} /> Back
        </Link>
      </header>
      <div className="history-content">
        <WalletGate expected={walletAddress} label="arming Guard">
          <GuardBody walletAddress={walletAddress!} />
        </WalletGate>
      </div>
    </main>
  );
}

function GuardBody({ walletAddress }: { walletAddress: string }) {
  const dAppKit = useDAppKit();
  const [status, setStatus] = useState<any>(null);
  const [signing, setSigning] = useState(false);
  const [txDigest, setTxDigest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const s = await fetchGuardStatus(walletAddress).catch(() => null);
    setStatus(s);
  }
  useEffect(() => {
    refresh();
  }, [walletAddress]);

  async function armGuard() {
    setError(null);
    if (!guardConfigReady()) {
      setError("Guard contract is not configured in this build (missing VITE_LPG_* env).");
      return;
    }
    setSigning(true);
    try {
      const tx = buildArmGuardTx();
      const result: any = await dAppKit.signAndExecuteTransaction({
        transaction: tx,
        network: guardConfig.network as any,
      });
      if (result?.FailedTransaction) {
        throw new Error(result.FailedTransaction?.status?.error?.message || "Transaction failed.");
      }
      const digest: string | undefined = result?.Transaction?.digest;
      setTxDigest(digest || null);
      await registerGuard({ walletAddress, txDigest: digest, portfolioId: guardConfig.portfolioId });
      await refresh();
    } catch (e: any) {
      setError(e?.message || "Failed to arm Guard.");
    } finally {
      setSigning(false);
    }
  }

  const isOn = status?.guardEnabled || status?.watching || Boolean(txDigest);

  return (
    <div className="history-feed">
      <article className="panel history-card">
        <div className="history-card-meta">
          <span
            className="history-card-type"
            style={{ background: isOn ? "var(--healthy)" : "var(--border-strong)", color: "#000" }}
          >
            {isOn ? "GUARD ON" : "GUARD OFF"}
          </span>
        </div>
        <p className="history-summary">
          {isOn ? (
            <>
              Autopilot is watching your{" "}
              <b>{status?.clusterToken || "correlation"}</b> cluster. If it drops{" "}
              {Math.abs(status?.thresholdPct ?? 5)}%, I rebalance autonomously — no click needed.
            </>
          ) : (
            <>
              Arming Guard mints a <b>revocable StrategistCap</b>. I can rebalance within whitelisted pools
              but <b>physically cannot withdraw your funds</b> — enforced by Move, not by my promise.
            </>
          )}
        </p>

        {!isOn && (
          <button
            className="btn btn-primary"
            onClick={armGuard}
            disabled={signing}
            style={{ width: "100%", justifyContent: "center", height: "48px", fontSize: "1.05rem" }}
          >
            {signing ? <Loader2 size={18} className="spin" /> : <ShieldCheck size={18} />}
            {signing ? "Waiting for signature…" : "Arm Guard — sign once"}
          </button>
        )}

        <div className="history-safety-note">
          <ShieldCheck size={14} />
          One signature mints the capability. Revoke any time.
        </div>
      </article>

      {txDigest && (
        <article className="panel history-card">
          <p className="history-summary positive">✅ Guard armed.</p>
          <a className="history-detail-item" href={`${EXPLORER}/${txDigest}`} target="_blank" rel="noreferrer">
            View tx {txDigest.slice(0, 10)}… <ExternalLink size={12} />
          </a>
        </article>
      )}

      {error && (
        <div className="panel history-no-data" style={{ borderColor: "var(--bleed)", color: "var(--bleed)" }}>
          {error}
        </div>
      )}

      {status?.recentActivity?.length > 0 && (
        <article className="panel history-card">
          <h3 style={{ margin: "0 0 8px" }}>Recent guard activity</h3>
          {status.recentActivity.map((a: any, i: number) => (
            <p key={i} className="history-summary" style={{ margin: "4px 0" }}>
              [{a.type}] {a.summary}
              {a.moneySaved ? ` — saved ~$${Math.round(a.moneySaved).toLocaleString()}` : ""}
            </p>
          ))}
        </article>
      )}
    </div>
  );
}
