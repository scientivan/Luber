import type { SystemStatus } from "@lp-guardian/core";
import { config } from "../config.js";
import { suiClient } from "../chain/suiClient.js";
import { watcher } from "../agents/watcher.js";
import { checkSupabase } from "./supabaseService.js";

async function timed<T>(fn: () => Promise<T>, timeoutMs = 3000) {
  const started = Date.now();
  try {
    const value = await Promise.race([
      fn(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs)),
    ]);
    return { ok: true as const, value, latencyMs: Date.now() - started };
  } catch (error) {
    return {
      ok: false as const,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : "unknown error",
    };
  }
}

export async function getSystemStatus(): Promise<SystemStatus> {
  const [beData, rpc, database] = await Promise.all([
    timed(async () => {
      const response = await fetch(`${config.beDataUrl}/health`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    }),
    timed(() => suiClient.getLatestCheckpointSequenceNumber()),
    timed(checkSupabase),
  ]);
  const overall = beData.ok && rpc.ok && database.ok ? "operational" : "degraded";
  return {
    overall,
    checkedAt: new Date().toISOString(),
    api: { ok: true, uptimeSeconds: Math.round(process.uptime()) },
    beData: beData.ok
      ? { ok: true, latencyMs: beData.latencyMs }
      : { ok: false, latencyMs: beData.latencyMs, error: beData.error },
    rpc: rpc.ok
      ? {
          ok: true,
          latencyMs: rpc.latencyMs,
          checkpoint: String(rpc.value),
          network: config.sui.network,
        }
      : {
          ok: false,
          latencyMs: rpc.latencyMs,
          network: config.sui.network,
          error: rpc.error,
        },
    supabase: database.ok
      ? { ok: true, latencyMs: database.latencyMs }
      : { ok: false, latencyMs: database.latencyMs, error: database.error },
    watcher: watcher.status(),
    mcp: {
      ok: beData.ok && rpc.ok,
      mode: "backing_endpoints",
      tools: ["check_lp_position", "discover_positions", "diagnose_portfolio", "deep_diagnose_pool", "simulate_shock", "migrate_pool", "get_history", "arm_guard"],
    },
  };
}
