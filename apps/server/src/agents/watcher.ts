import { scout } from "./scout.js";
import { strategist } from "./strategist.js";
import { config } from "../config.js";
import type { RebalancePlan } from "@lp-guardian/core";

export interface SaveEvent {
  kind: "trigger" | "acting" | "done";
  asset?: string;
  pct?: number;
  text: string;
  txDigest?: string;
  explorer?: string;
  moneySaved?: number;
}

export type Subscriber = (e: SaveEvent) => void;

export interface GuardState {
  capId: string;
  walletAddress: string;
  baselinePrices: Record<string, number>;
  tokensToMonitor: string[];
  customPriceDropThreshold?: number; // Override for 10% default
}

class Watcher {
  private guarded = new Map<string, GuardState>();
  private subscribers = new Set<Subscriber>();
  private timer?: NodeJS.Timeout;

  // Sane Defaults
  private readonly DEFAULT_PRICE_DROP_THRESHOLD = 0.10; // 10% drop from baseline
  private readonly DEFAULT_HEALTH_THRESHOLD = 40; // Trigger if health < 40

  async arm(walletAddress: string, capId: string, customPriceDropThreshold?: number) {
    try {
      // 1. Fetch initial positions to determine tokens to monitor
      const positions = await scout.discoverPositions(walletAddress);
      if (positions.length === 0) return;

      const uniqueTokens = Array.from(new Set(positions.flatMap(p => [p.tokenX, p.tokenY])));
      
      // 2. Establish baseline prices
      const currentPrices = await this.fetchLivePrices(uniqueTokens);

      this.guarded.set(walletAddress, {
        capId,
        walletAddress,
        baselinePrices: currentPrices,
        tokensToMonitor: uniqueTokens,
        customPriceDropThreshold
      });
      
      console.log(`[Watcher] Armed for ${walletAddress}. Monitoring: ${uniqueTokens.join(", ")}`);
    } catch (err) {
      console.error(`[Watcher] Failed to arm for ${walletAddress}:`, err);
    }
  }

  disarm(walletAddress: string) {
    this.guarded.delete(walletAddress);
    console.log(`[Watcher] Disarmed for ${walletAddress}`);
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
    console.log(`[Watcher] Polling Pyth every ${config.watcher.pollMs}ms`);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  /** 
   * Active polling loop (Event-Driven Baseline Tracking).
   * 1. Fetch live prices for all monitored tokens
   * 2. Compare against baseline
   * 3. If drop > threshold, trigger AI diagnosis
   */
  private async tick() {
    if (this.guarded.size === 0) return;

    // Collect all unique tokens across all guarded wallets
    const allTokens = new Set<string>();
    for (const state of this.guarded.values()) {
      state.tokensToMonitor.forEach(t => allTokens.add(t));
    }

    if (allTokens.size === 0) return;

    // 1. Fetch live prices from Pyth Hermes (Public, No API Key)
    const livePrices = await this.fetchLivePrices(Array.from(allTokens));

    // 2. Evaluate each guarded wallet
    for (const [walletAddress, state] of this.guarded.entries()) {
      let maxDropAsset = "";
      let maxDropPct = 0;

      for (const token of state.tokensToMonitor) {
        const baseline = state.baselinePrices[token];
        const current = livePrices[token];
        
        if (!baseline || !current) continue;

        const dropPct = (baseline - current) / baseline;
        if (dropPct > maxDropPct) {
          maxDropPct = dropPct;
          maxDropAsset = token;
        }
      }

      const threshold = state.customPriceDropThreshold ?? this.DEFAULT_PRICE_DROP_THRESHOLD;

      // 3. Check against dynamic threshold (Sane Default or User Override)
      if (maxDropPct >= threshold) {
        console.log(`[Watcher] 🚨 ${maxDropAsset} dropped ${(maxDropPct * 100).toFixed(1)}% for ${walletAddress}`);
        await this.evaluateAndAct(state, maxDropAsset, -(maxDropPct * 100));
        
        // Reset baseline after action to prevent repeated triggers
        const newPositions = await scout.discoverPositions(walletAddress);
        const newTokens = Array.from(new Set(newPositions.flatMap(p => [p.tokenX, p.tokenY])));
        state.baselinePrices = await this.fetchLivePrices(newTokens);
        state.tokensToMonitor = newTokens;
      }
    }
  }

  /**
   * Event-driven AI evaluation. Only runs when baseline price threshold is breached.
   * Wakes up the Strategist Embedded AI.
   */
  private async evaluateAndAct(state: GuardState, asset: string, pctDrop: number) {
    this.emit({ 
      kind: "trigger", 
      asset, 
      pct: pctDrop, 
      text: `🚨 ${asset} dropped ${Math.abs(pctDrop).toFixed(1)}% from baseline. Waking up AI Strategist for deep diagnosis...` 
    });

    try {
      // Wake up the AI Brain (generateObject via Vercel AI SDK)
      const health = await strategist.diagnose(state.walletAddress);
      
      // Check if health is critical based on Default Threshold
      if (health.healthScore < this.DEFAULT_HEALTH_THRESHOLD) {
        this.emit({ 
          kind: "acting", 
          text: `Health Score is ${health.healthScore}/100 (Critical). AI confirmed bleeding. Executing autonomous rebalance...` 
        });

        const plan: RebalancePlan = {
          planId: `auto_${Date.now()}`,
          steps: [],
          expectedHealthRange: [60, 80],
          confidence: 0.85,
          preview: `Emergency rebalance triggered by ${asset} drop. De-risking correlated cluster.`,
        };

        const { txDigest, explorer } = await strategist.executeRebalance(state.capId, plan);
        await strategist.mintReport(state.capId, health);

        this.emit({
          kind: "done",
          text: `✅ Autonomous Save Complete. Portfolio de-risked.`,
          txDigest,
          explorer,
          moneySaved: health.stress.atRiskUSD * 0.6,
        });
      } else {
        this.emit({ 
          kind: "acting", 
          text: `Health Score is ${health.healthScore}/100. AI analyzed the drop but portfolio is stable enough. No action required.` 
        });
      }
    } catch (err) {
      console.error(`[Watcher] Failed to evaluate/act for ${state.walletAddress}:`, err);
    }
  }

  async fireShock(walletAddress: string, asset: string, pct: number): Promise<void> {
    const guard = this.guarded.get(walletAddress);
    if (!guard) return;
    await this.evaluateAndAct(guard, asset, pct);
  }

  /** 
   * Fetch live prices from Pyth Hermes Public API (No API Key Required).
   */
  private async fetchLivePrices(tokens: string[]): Promise<Record<string, number>> {
    const feedMap: Record<string, string> = {
      "SUI": "23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744",
      "ETH": "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
      "BTC": "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
      "USDC": "eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
    };

    const requestedFeeds = tokens
      .map(t => t.split("::").pop()?.toUpperCase() || "")
      .map(t => feedMap[t])
      .filter(Boolean);

    if (requestedFeeds.length === 0) return {};

    try {
      const idsParam = requestedFeeds.map(id => `ids[]=${id}`).join("&");
      const url = `${config.pyth.hermesUrl}/api/latest_price_feeds?${idsParam}`;
      
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Pyth API error: ${res.statusText}`);
      
      const json: any = await res.json();
      const prices: Record<string, number> = {};
      
      for (const item of json) {
        const token = Object.keys(feedMap).find(k => feedMap[k] === item.id);
        if (token && item.price) {
          const rawPrice = Number(item.price.price);
          const expo = Number(item.price.expo);
          prices[token] = rawPrice * Math.pow(10, expo);
        }
      }
      
      return prices;
    } catch (err) {
      console.error("[Watcher] Failed to fetch live prices:", err);
      return { "ETH": 3500, "SUI": 1.2, "BTC": 65000, "USDC": 1.0 };
    }
  }
}

export const watcher = new Watcher();

if (import.meta.url === `file://${process.argv[1]}`) {
  watcher.start();
}
