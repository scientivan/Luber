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
import * as supabaseService from "../services/supabaseService.js";
import { wsHandler } from "../websocket/wsHandler.js";

export type SaveEvent =
  | { kind: "trigger"; asset: string; pct: number; text: string }
  | { kind: "acting"; text: string }
  | { kind: "done"; text: string; txDigest: string; explorer: string; moneySaved: number };

type Subscriber = (e: SaveEvent) => void;

class Watcher {
  private guarded = new Map<string, { capId: string; portfolioId: string; clusterToken?: string }>();
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

      for (const [wallet, guard] of this.guarded) {
        if (!guard.clusterToken) continue;
        
        // Load config and baselines from Supabase
        const guardConfig = await supabaseService.getGuardConfig(wallet).catch(() => null);
        if (guardConfig && !guardConfig.guardEnabled) continue; // Skip if guard disabled by user
        
        const threshold = guardConfig?.thresholdPct ?? config.watcher.thresholdPct;
        const baselines = await supabaseService.getBaselinePrices(wallet).catch(() => ({} as Record<string, number>));
        const baseline = baselines[guard.clusterToken];
        
        const currentPrice = currentPrices[guard.clusterToken];
        
        if (baseline && currentPrice) {
          const pctChange = ((currentPrice - baseline) / baseline) * 100;

          if (pctChange <= threshold) {
            console.log(`[watcher] WARN: ${guard.clusterToken} dropped ${pctChange.toFixed(2)}% vs baseline (threshold: ${threshold}%)`);
            console.log(`[watcher] Autonomous save -> ${wallet.slice(0, 10)}...`);
            
            // Log the breach event
            await supabaseService.logEvent(wallet, guard.portfolioId, "threshold_breach", {
              asset: guard.clusterToken,
              dropPct: pctChange,
              baseline,
              currentPrice
            }).catch(console.error);
            
            this.fireShock(wallet, guard.clusterToken, pctChange).catch(console.error);
          }
        }
        
        // Update last check timestamp
        await supabaseService.updateLastCheck(wallet).catch(() => {});
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

    const triggerEvent = { kind: "trigger" as const, asset, pct, text: `⚠️ ${asset} just dropped ${Math.abs(pct)}%. Your cluster is bleeding. Acting now.` };
    this.emit(triggerEvent);
    wsHandler.broadcast("threshold_breach", { walletAddress, ...triggerEvent });

    // Diagnose now to get the REAL cluster + allocation, then build a real plan.
    const health = await strategist.diagnose(walletAddress);
    const sim = await strategist.simulate(walletAddress, asset, pct);
    const actingEvent = { kind: "acting" as const, text: "Rebalancing the correlated cluster via DeepBook…" };
    this.emit(actingEvent);
    wsHandler.broadcast("rebalance_start", { walletAddress, ...actingEvent });

    const plan = buildPlanFromAllocation(health);
    const { txDigest, explorer } = await strategist.executeRebalance(guard.capId, guard.portfolioId, plan);
    await strategist.mintReport(guard.capId, guard.portfolioId, { ...health, txDigest });
    
    // Log rebalance event to Supabase
    await supabaseService.logEvent(walletAddress, guard.portfolioId, "rebalance", {
      asset,
      dropPct: pct,
      txDigest,
      moneySaved: sim.guarded.moneySaved
    }).catch(console.error);
    
    // Auto-refresh baseline prices after successful rebalance
    const uniqueTokens = Array.from(new Set((health.positions || []).map(p => p.token).filter(Boolean)));
    if (uniqueTokens.length > 0) {
      const newPrices = await pythClient.getCurrentPrices(uniqueTokens as string[]).catch(() => ({}));
      await supabaseService.setBaselinePrices(walletAddress, guard.portfolioId, newPrices).catch(console.error);
    }

    const targetPct = health.suggestedAllocation?.allocations.find((a) => a.token === health.cluster.token)?.targetPct ?? 40;
    const doneEvent = {
      kind: "done" as const,
      text: `✅ I cut your ${health.cluster.token} exposure from ${Math.round(health.cluster.exposurePct)}% to ${Math.round(targetPct)}% — into uncorrelated assets via DeepBook. I just saved you about $${Math.round(sim.guarded.moneySaved)} of that drop.`,
      txDigest,
      explorer,
      moneySaved: sim.guarded.moneySaved,
    };
    this.emit(doneEvent);
    wsHandler.broadcast("rebalance_complete", { walletAddress, ...doneEvent });
  }
}

export const watcher = new Watcher();

// Allow running as a standalone process: `pnpm --filter @lp-guardian/server watcher`
if (import.meta.url === `file://${process.argv[1]}`) {
  watcher.start();
}
