import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useCurrentAccount, useDAppKit, useWallets } from "@mysten/dapp-kit-react";
import { Transaction } from "@mysten/sui/transactions";
import type { PoolDeepDive, PortfolioHealth, RebalanceIntent, ShockResult } from "@lp-guardian/core";
import { ProductShell } from "../components/ProductShell.js";
import {
  confirmGuard,
  executeRebalance,
  fetchGuardStatus,
  fetchPoolHealth,
  fetchPortfolioHealth,
  migratePool,
  prepareGuard,
  prepareRebalance,
  simulateShock,
  triggerWatcherShock,
  type GuardStatus,
} from "../lib/api.js";
import { WalletGate } from "../components/WalletGate.js";
import { useWalletAuth } from "../lib/session.js";
import { useRealtime } from "../lib/useRealtime.js";
import "../styles/product.css";

function ConnectButton() {
  const account = useCurrentAccount();
  const wallets = useWallets();
  const dAppKit = useDAppKit();
  if (account) return <span className="wallet-chip">{short(account.address)}</span>;
  return (
    <button className="button primary" onClick={() => wallets[0] && dAppKit.connectWallet({ wallet: wallets[0] })}>
      Connect wallet
    </button>
  );
}

function short(value: string) {
  return `${value.slice(0, 7)}…${value.slice(-5)}`;
}

function ErrorBox({ error }: { error: string | null }) {
  return error ? <div className="notice error">{error}</div> : null;
}

export function PortfolioDiagnosis() {
  const params = useParams();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const [wallet, setWallet] = useState(params.walletAddress ?? "");
  const [health, setHealth] = useState<PortfolioHealth | null>(null);
  const [shock, setShock] = useState<ShockResult | null>(null);
  const [asset, setAsset] = useState("ETH");
  const [pct, setPct] = useState(-10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function diagnose(target = wallet) {
    if (!target) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchPortfolioHealth(target);
      setHealth(result);
      setAsset(result.cluster.token || "ETH");
      if (!params.walletAddress) navigate(`/d/${target}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Diagnosis failed");
    } finally {
      setLoading(false);
    }
  }

  async function runShock() {
    if (!wallet) return;
    setLoading(true);
    setError(null);
    try {
      setShock(await simulateShock(wallet, asset, pct));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!params.walletAddress) return;
    setWallet(params.walletAddress);
    void diagnose(params.walletAddress);
  }, [params.walletAddress]);

  useEffect(() => {
    const sim = search.get("sim");
    if (!sim || !params.walletAddress) return;
    const [nextAsset, rawPct] = sim.split(":");
    const nextPct = Number(rawPct);
    if (nextAsset && Number.isFinite(nextPct)) {
      setAsset(nextAsset);
      setPct(nextPct);
      void simulateShock(params.walletAddress, nextAsset, nextPct).then(setShock).catch(() => {});
    }
  }, [search, params.walletAddress]);

  const diagnosisContent = (
    <>
      <section className="panel form-row">
        <input value={wallet} onChange={(event) => setWallet(event.target.value)} placeholder="Sui wallet address" />
        <button className="button primary" onClick={() => void diagnose()} disabled={loading || !wallet}>
          {loading ? "Analyzing…" : "Diagnose portfolio"}
        </button>
      </section>
      <ErrorBox error={error} />
      {health && (
        <>
          {health.source === "demo" && <div className="notice demo-label">Demo data · local fixture, no chain or indexer read.</div>}
          <section className="metric-grid">
            <article className="panel metric"><span>Health</span><strong>{health.healthScore}/100</strong><small>{health.riskLevel}</small></article>
            <article className="panel metric"><span>Portfolio</span><strong>${health.totalValueUSD.toLocaleString()}</strong><small>{health.positionCount} positions</small></article>
            <article className="panel metric danger"><span>Hidden cluster</span><strong>{Math.round(health.cluster.exposurePct)}% {health.cluster.token}</strong><small>one correlated bet</small></article>
            <article className="panel metric"><span>10% shock</span><strong>-${health.stress.atRiskUSD.toLocaleString()}</strong><small>estimated portfolio impact</small></article>
          </section>

          <section className="panel">
            <div className="section-head"><div><p className="product-kicker">Positions</p><h2>Portfolio map</h2></div><Link className="button" to={`/rebalance/${wallet}`}>Open rebalance</Link></div>
            <div className="position-list">
              {health.positions.map((position) => (
                <Link key={position.objectId} className="position-row" to={`/d/${wallet}/pool/${position.poolId}?s=preview`}>
                  <span><b>{position.pair}</b><small>{position.protocol}</small></span>
                  <span>${position.valueUSD.toLocaleString()}</span>
                  <span className={position.inRange ? "tone-good" : "tone-bad"}>{position.inRange ? "In range" : "Out of range"}</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="section-head"><div><p className="product-kicker">Scenario lab</p><h2>Shock simulation</h2></div></div>
            <div className="form-row">
              <input value={asset} onChange={(event) => setAsset(event.target.value.toUpperCase())} aria-label="Asset" />
              <input type="number" min="-100" max="100" value={pct} onChange={(event) => setPct(Number(event.target.value))} aria-label="Percent move" />
              <button className="button primary" onClick={() => void runShock()} disabled={loading}>Run scenario</button>
            </div>
            {shock && <div className="result-callout">At risk <b>${shock.atRiskUSD.toLocaleString()}</b>. Guard could save <b>${shock.guarded.moneySaved.toLocaleString()}</b>. Post-health: <b>{shock.guarded.postHealth}/100</b>.</div>}
          </section>
        </>
      )}
    </>
  );

  return (
    <ProductShell title="Portfolio diagnosis" subtitle="See the correlated bet hidden across every liquidity position.">
      {params.walletAddress ? <WalletGate expected={params.walletAddress}>{diagnosisContent}</WalletGate> : diagnosisContent}
    </ProductShell>
  );
}

export function PoolDiagnosis() {
  const { walletAddress = "", poolId = "" } = useParams();
  const [data, setData] = useState<PoolDeepDive | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [migration, setMigration] = useState<string | null>(null);
  const [migrating, setMigrating] = useState(false);
  useEffect(() => {
    void fetchPoolHealth(walletAddress, poolId).then(setData).catch((err) => setError(err.message));
  }, [walletAddress, poolId]);

  async function migrate() {
    if (!data?.positionId) return;
    setMigrating(true);
    setError(null);
    try {
      const result = await migratePool(walletAddress, data.positionId);
      setMigration(`${result.summary} ${result.txDigest}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Migration failed");
    } finally {
      setMigrating(false);
    }
  }
  return (
    <ProductShell title="Pool diagnosis" subtitle="Inspect range health, loss estimate, cluster contribution, and exit depth.">
      <WalletGate expected={walletAddress}>
        <ErrorBox error={error} />
        {!data ? <div className="panel">Loading pool diagnosis…</div> : (
          <>
            {data.source === "demo" && <div className="notice demo-label">Demo data · migration is simulated and never broadcast.</div>}
            <section className="metric-grid">
              <article className="panel metric"><span>Pool</span><strong>{data.pair}</strong><small>{data.protocol}</small></article>
              <article className="panel metric"><span>Range</span><strong>{data.inRange ? "Active" : "Inactive"}</strong><small>{data.daysOutOfRange} days out</small></article>
              <article className="panel metric danger"><span>Estimated IL</span><strong>${data.estImpermanentLossUSD.toLocaleString()}</strong><small>model estimate</small></article>
              <article className="panel metric"><span>Cluster share</span><strong>{data.contributionToClusterPct}%</strong><small>dominant correlated cluster</small></article>
            </section>
            <section className="panel">
              <h2>Exit liquidity</h2>
              <p>Depth: ${data.exitLiquidity.depthUSD.toLocaleString()} · Estimated slippage at 30% exit: {data.exitLiquidity.slippageBpsAt30pct} bps.</p>
              <div className={`notice ${data.exitLiquidity.feasible ? "success" : "error"}`}>{data.exitLiquidity.feasible ? "Exit appears feasible at modeled size." : "Modeled exit exceeds available depth."}</div>
              {data.recommendation === "migrate" && (
                <div className="result-callout">
                  <b>Migration recommended.</b> {data.migrationReason}
                  <div style={{ marginTop: 14 }}>
                    <button className="button primary" disabled={migrating} onClick={() => void migrate()}>
                      {migrating ? "Simulating…" : "Simulate migration"}
                    </button>
                  </div>
                </div>
              )}
              {migration && <div className="notice success">{migration}</div>}
            </section>
          </>
        )}
      </WalletGate>
    </ProductShell>
  );
}

export function RebalanceTerminal() {
  const { walletAddress } = useParams();
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  const { authenticate } = useWalletAuth();
  const wallet = walletAddress || account?.address || "";
  const [intent, setIntent] = useState<RebalanceIntent | null>(null);
  const [result, setResult] = useState<{ txDigest: string; explorer: string; moneySaved: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const realtime = useRealtime(wallet || undefined);

  const latestProgress = useMemo(
    () => realtime.events.find((event) => ["threshold_breach", "rebalance_start", "rebalance_complete"].includes(event.type)),
    [realtime.events],
  );

  function assertWallet() {
    if (!account) throw new Error("Connect the wallet that owns this demo portfolio");
    if (wallet.toLowerCase() !== account.address.toLowerCase()) throw new Error("Connected wallet does not match route wallet");
    return account.address;
  }

  async function prepare() {
    setBusy(true);
    setError(null);
    try {
      const address = assertWallet();
      const token = await authenticate(address);
      setIntent(await prepareRebalance(address, token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not prepare rebalance");
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!intent) return;
    setBusy(true);
    setError(null);
    try {
      const address = assertWallet();
      const token = await authenticate(address);
      const signed = await dAppKit.signPersonalMessage({ message: new TextEncoder().encode(intent.approvalMessage) });
      setResult(await executeRebalance({
        walletAddress: address,
        planId: intent.planId,
        signature: signed.signature,
      }, token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rebalance failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ProductShell title="Rebalance terminal" subtitle="Review an exact plan, approve its signed intent, then let the capability-bound agent execute once.">
      <section className="panel action-bar"><ConnectButton /><span className={realtime.connected ? "tone-good" : "tone-bad"}>{realtime.connected ? "Realtime connected" : "Realtime reconnecting"}</span></section>
      <ErrorBox error={error} />
      {!intent && <section className="panel"><h2>Build current plan</h2><p>Diagnosis runs again before approval so stale allocation cannot be signed.</p><button className="button primary" disabled={busy || !wallet} onClick={() => void prepare()}>{busy ? "Preparing…" : "Prepare rebalance"}</button></section>}
      {intent && !result && (
        <section className="panel">
          <p className="product-kicker">One-time signed intent</p>
          <h2>{intent.preview}</h2>
          <p>Expected health: {intent.expectedHealthRange[0]}–{intent.expectedHealthRange[1]}. Expires {new Date(intent.expiresAt).toLocaleTimeString()}.</p>
          <ol className="steps">{intent.steps.map((step) => <li key={step.stepNumber}><b>{step.action}</b> · {step.protocol} · {String(step.parameters.token ?? step.parameters.poolId ?? "")}</li>)}</ol>
          <button className="button primary" disabled={busy} onClick={() => void approve()}>{busy ? "Executing…" : "Sign intent and execute"}</button>
        </section>
      )}
      {latestProgress && <div className="notice">{String(latestProgress.data.text ?? latestProgress.type)}</div>}
      {result && <section className="panel result-callout"><h2>Rebalance complete</h2><p>Estimated saved: <b>${result.moneySaved.toLocaleString()}</b></p><a className="button primary" href={result.explorer} target="_blank" rel="noreferrer">View transaction</a></section>}
    </ProductShell>
  );
}

export function GuardSetup() {
  const { walletAddress = "" } = useParams();
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  const { authenticate } = useWalletAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState<{ capId: string; txDigest: string } | null>(null);
  const [guardStatus, setGuardStatus] = useState<GuardStatus | null>(null);
  const [asset, setAsset] = useState("ETH");
  const [pct, setPct] = useState(-4);
  const realtime = useRealtime(walletAddress);

  useEffect(() => {
    if (!walletAddress) return;
    void fetchGuardStatus(walletAddress).then((status) => {
      setGuardStatus(status);
      if (status.guardEnabled) setActive({ capId: "existing", txDigest: "" });
    }).catch(() => {});
  }, [walletAddress]);

  async function arm() {
    setBusy(true);
    setError(null);
    try {
      const wallet = account!.address;
      const token = await authenticate(wallet);
      const preparation = await prepareGuard(wallet, token);
      const tx = new Transaction();
      const cap = tx.moveCall({
        target: `${preparation.packageId}::lp_guardian::authorize_strategist`,
        arguments: [
          tx.object(preparation.portfolioId),
          tx.pure.address(preparation.agentAddress),
          tx.pure.u64(preparation.expiresAtEpoch),
        ],
      });
      tx.transferObjects([cap], tx.pure.address(preparation.agentAddress));
      const executed = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      const finalized = await dAppKit.getClient().core.waitForTransaction({
        result: executed,
        include: { effects: true, objectTypes: true },
      });
      const transactionResult = finalized.Transaction ?? finalized.FailedTransaction;
      if (!transactionResult) throw new Error("Wallet returned no transaction result");
      const created = transactionResult.effects?.changedObjects.find((change) =>
        change.idOperation === "Created" &&
        transactionResult.objectTypes?.[change.objectId]?.endsWith("::lp_guardian::StrategistCap")
      );
      if (!created) throw new Error("StrategistCap was not created");
      const confirmed = await confirmGuard({
        walletAddress: wallet,
        txDigest: transactionResult.digest,
        capId: created.objectId,
      }, token);
      setActive(confirmed);
      void fetchGuardStatus(walletAddress).then(setGuardStatus).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Guard setup failed");
    } finally {
      setBusy(false);
    }
  }

  async function trigger() {
    setBusy(true);
    setError(null);
    try {
      const wallet = account!.address;
      const token = await authenticate(wallet);
      await triggerWatcherShock({ walletAddress: wallet, asset, pct }, token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Watcher trigger failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ProductShell title="Guard setup" subtitle="Mint a revocable capability to the agent, then observe autonomous defense in realtime.">
      <WalletGate expected={walletAddress}>
        <section className="panel action-bar"><ConnectButton /><span className={realtime.connected ? "tone-good" : "tone-bad"}>{realtime.connected ? "Realtime connected" : "Realtime reconnecting"}</span></section>
        <ErrorBox error={error} />

        {guardStatus && (
          <section className="panel">
            <p className="product-kicker">Current status</p>
            <h2>Guard is {guardStatus.guardEnabled ? "ON" : "OFF"}{guardStatus.watching ? " · watching live" : ""}</h2>
            {guardStatus.clusterToken && <p>Protecting <b>{guardStatus.clusterToken}</b> cluster. Threshold: <b>{Math.abs(guardStatus.thresholdPct)}%</b> drop.</p>}
            {guardStatus.lastCheckAt && <p style={{ color: "#777" }}>Last checked: {new Date(guardStatus.lastCheckAt).toLocaleString()}</p>}
            {guardStatus.recentActivity.length > 0 && (
              <div className="event-feed">
                {guardStatus.recentActivity.map((a, i) => (
                  <div key={`${a.timestamp}-${i}`}>
                    <b>{a.type.replace("_", " ")}</b>
                    <span>{a.summary}{a.moneySaved ? ` (saved ~$${Math.round(a.moneySaved)})` : ""}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="panel">
          <h2>{active ? "Guard is active" : "Authorize strategist"}</h2>
          <p>The capability can rebalance only the configured portfolio. It cannot withdraw funds — enforced by Move, not by a promise.</p>
          {!active ? <button className="button primary" disabled={busy} onClick={() => void arm()}>{busy ? "Waiting for wallet…" : "Sign and arm Guard"}</button> : <div className="notice success">Guard is armed and watching your portfolio.</div>}
        </section>
        {active && (
          <section className="panel">
            <h2>Demo watcher trigger</h2>
            <div className="form-row">
              <input value={asset} onChange={(event) => setAsset(event.target.value.toUpperCase())} />
              <input type="number" value={pct} min="-100" max="100" onChange={(event) => setPct(Number(event.target.value))} />
              <button className="button primary" disabled={busy} onClick={() => void trigger()}>Trigger shock</button>
            </div>
            <div className="event-feed">{realtime.events.filter((event) => event.type !== "connected" && event.type !== "history_load").map((event, index) => <div key={`${event.timestamp}-${index}`}><b>{event.type}</b><span>{String(event.data.text ?? event.timestamp)}</span></div>)}</div>
          </section>
        )}
      </WalletGate>
    </ProductShell>
  );
}
