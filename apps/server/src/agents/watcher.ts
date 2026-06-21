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
import { pythClient } from "../services/pythClient.js";

export type SaveEvent =
  | { kind: "trigger"; asset: string; pct: number; text: string }
  | { kind: "acting"; text: string }
  | { kind: "done"; text: string; txDigest: string; explorer: string; moneySaved: number };

type Subscriber = (e: SaveEvent) => void;

class Watcher {
  private guarded = new Map<string, { capId: string; portfolioId: string; clusterToken?: string }>();
  private subscribers = new Set<Subscriber>();
  private priceCache = new Map<string, number>();
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

  /** One poll. Checks Pyth for price drops and triggers autonomous saves. */
  private async tick() {
    if (this.guarded.size === 0) return;

    try {
      // Lazily discover cluster tokens for newly armed wallets
      for (const [wallet, guard] of this.guarded) {
        if (!guard.clusterToken) {
          const health = await strategist.diagnose(wallet).catch(() => null);
          if (health?.cluster.token) {
            guard.clusterToken = health.cluster.token;
            console.log(`[watcher] Cached cluster token "${guard.clusterToken}" for ${wallet.slice(0, 10)}…`);
          }
        }
      }

      // Collect unique tokens to price-check
      const tokens = new Set<string>();
      for (const guard of this.guarded.values()) {
        if (guard.clusterToken) tokens.add(guard.clusterToken);
      }
      if (tokens.size === 0) return;

      const currentPrices = await pythClient.getCurrentPrices(Array.from(tokens));

      for (const [token, currentPrice] of Object.entries(currentPrices)) {
        const previousPrice = this.priceCache.get(token);

        if (previousPrice) {
          const pctChange = ((currentPrice - previousPrice) / previousPrice) * 100;

          if (pctChange <= config.watcher.thresholdPct) {
            console.log(`[watcher] ⚠ ${token} dropped ${pctChange.toFixed(2)}% (threshold: ${config.watcher.thresholdPct}%)`);

            for (const [wallet, guard] of this.guarded) {
              if (guard.clusterToken === token) {
                console.log(`[watcher] Autonomous save → ${wallet.slice(0, 10)}…`);
                this.fireShock(wallet, token, pctChange).catch(console.error);
              }
            }
          }
        }

        this.priceCache.set(token, currentPrice);
      }
    } catch (err) {
      console.error("[watcher] tick error:", err);
    }
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
