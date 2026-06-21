/**
 * Autonomous Watcher — a separate 24/7 service (NOT the MCP server; MCP is
 * request/response and an LLM host is not a daemon). It holds the StrategistCap
 * (logically), polls price (Pyth live / simulate), and executes the
 * correlation-aware rebalance autonomously when a threshold trips.
 *
 * This is what powers the demo's climax: the autonomous SAVE with no click.
 */
import { config, resolvePortfolio } from "../config.js";
import { strategist, buildPlanFromAllocation } from "./strategist.js";

export type SaveEvent =
  | { kind: "trigger"; asset: string; pct: number; text: string }
  | { kind: "acting"; text: string }
  | { kind: "done"; text: string; txDigest: string; explorer: string; moneySaved: number };

type Subscriber = (e: SaveEvent) => void;

class Watcher {
  private guarded = new Map<string, { capId: string; portfolioId: string }>();
  private subscribers = new Set<Subscriber>();
  private timer?: NodeJS.Timeout;

  /** Arm Guard for a wallet. capId/portfolioId fall back to the resolved demo cap. */
  arm(walletAddress: string, capId?: string) {
    const resolved = resolvePortfolio(walletAddress);
    this.guarded.set(walletAddress, {
      capId: capId && capId !== "0x0" ? capId : resolved.capId,
      portfolioId: resolved.portfolioId,
    });
  }
  disarm(walletAddress: string) {
    this.guarded.delete(walletAddress);
  }
  subscribe(fn: Subscriber) {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }
  private emit(e: SaveEvent) {
    for (const fn of this.subscribers) fn(e);
  }

  start() {
    if (!config.watcher.enabled || this.timer) return;
    this.timer = setInterval(() => this.tick().catch(console.error), config.watcher.pollMs);
    console.log(`[watcher] polling every ${config.watcher.pollMs}ms`);
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  /** One poll. Live mode would read Pyth here; simulate mode is triggered manually. */
  private async tick() {
    // Live Pyth threshold check goes here (stretch). Spine = simulate trigger.
  }

  /**
   * The SAME autonomous code path used by both the live trigger and the
   * "simulate shock" toggle. Drives beat 3 of the demo.
   */
  async fireShock(walletAddress: string, asset: string, pct: number): Promise<void> {
    const guard = this.guarded.get(walletAddress);
    if (!guard) return;

    this.emit({ kind: "trigger", asset, pct, text: `⚠️ ${asset} just dropped ${Math.abs(pct)}%. Your cluster is bleeding. Acting now.` });

    // Diagnose now to get the REAL cluster + allocation, then build a real plan.
    const health = await strategist.diagnose(walletAddress);
    const sim = await strategist.simulate(walletAddress, asset, pct);
    this.emit({ kind: "acting", text: "Rebalancing the correlated cluster via DeepBook…" });

    const plan = buildPlanFromAllocation(health);
    const { txDigest, explorer } = await strategist.executeRebalance(guard.capId, guard.portfolioId, plan);
    await strategist.mintReport(guard.capId, guard.portfolioId, { ...health, txDigest });

    const targetPct = health.suggestedAllocation?.allocations.find((a) => a.token === health.cluster.token)?.targetPct ?? 40;
    this.emit({
      kind: "done",
      text: `✅ I cut your ${health.cluster.token} exposure from ${Math.round(health.cluster.exposurePct)}% to ${Math.round(targetPct)}% — into uncorrelated assets via DeepBook. I just saved you about $${Math.round(sim.guarded.moneySaved)} of that drop.`,
      txDigest,
      explorer,
      moneySaved: sim.guarded.moneySaved,
    });
  }
}

export const watcher = new Watcher();

// Allow running as a standalone process: `pnpm --filter @lp-guardian/server watcher`
if (import.meta.url === `file://${process.argv[1]}`) {
  watcher.start();
}
