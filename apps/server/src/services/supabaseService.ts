import { supabase } from "./supabaseClient.js";

/**
 * Supabase CRUD Service for LP Guardian state management
 * Handles baseline prices, guard configuration, and event history
 */

// --- Baseline Price Management -----------------------------------------------

export async function getBaselinePrices(walletAddress: string): Promise<Record<string, number>> {
  const { data, error } = await supabase.admin
    .from("guarded_wallets")
    .select("baseline_prices")
    .eq("wallet_address", walletAddress)
    .single();

  if (error) {
    if (error.code === "PGRST116") return {}; // Not found - return empty
    throw new Error(`Failed to get baseline prices: ${error.message}`);
  }
  return (data?.baseline_prices as Record<string, number>) || {};
}

export async function setBaselinePrices(
  walletAddress: string,
  portfolioId: string,
  prices: Record<string, number>
): Promise<void> {
  const { error } = await supabase.admin
    .from("guarded_wallets")
    .upsert({
      wallet_address: walletAddress,
      portfolio_id: portfolioId,
      baseline_prices: prices,
      updated_at: new Date().toISOString(),
    });

  if (error) throw new Error(`Failed to set baseline prices: ${error.message}`);
}

export async function updateBaselinePrice(
  walletAddress: string,
  asset: string,
  price: number
): Promise<void> {
  const current = await getBaselinePrices(walletAddress);
  current[asset] = price;
  
  const { error } = await supabase.admin
    .from("guarded_wallets")
    .update({
      baseline_prices: current,
      updated_at: new Date().toISOString(),
    })
    .eq("wallet_address", walletAddress);

  if (error) throw new Error(`Failed to update baseline price: ${error.message}`);
}

// --- Guard Configuration Management ------------------------------------------

export interface GuardConfig {
  portfolioId: string;
  thresholdPct: number;
  guardEnabled: boolean;
  lastCheckAt: string | null;
}

export async function getGuardConfig(walletAddress: string): Promise<GuardConfig | null> {
  const { data, error } = await supabase.admin
    .from("guarded_wallets")
    .select("portfolio_id, risk_threshold_pct, guard_enabled, last_check_at")
    .eq("wallet_address", walletAddress)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    throw new Error(`Failed to get guard config: ${error.message}`);
  }

  return {
    portfolioId: data.portfolio_id,
    thresholdPct: Number(data.risk_threshold_pct),
    guardEnabled: data.guard_enabled,
    lastCheckAt: data.last_check_at,
  };
}

export async function setThreshold(walletAddress: string, thresholdPct: number): Promise<void> {
  const { error } = await supabase.admin
    .from("guarded_wallets")
    .update({
      risk_threshold_pct: thresholdPct,
      updated_at: new Date().toISOString(),
    })
    .eq("wallet_address", walletAddress);

  if (error) throw new Error(`Failed to set threshold: ${error.message}`);
}

export async function toggleGuard(walletAddress: string, enabled: boolean): Promise<void> {
  const { error } = await supabase.admin
    .from("guarded_wallets")
    .update({
      guard_enabled: enabled,
      updated_at: new Date().toISOString(),
    })
    .eq("wallet_address", walletAddress);

  if (error) throw new Error(`Failed to toggle guard: ${error.message}`);
}

export async function updateLastCheck(walletAddress: string): Promise<void> {
  const { error } = await supabase.admin
    .from("guarded_wallets")
    .update({
      last_check_at: new Date().toISOString(),
    })
    .eq("wallet_address", walletAddress);

  if (error) console.error(`Failed to update last_check_at: ${error.message}`);
}

// --- History & Event Logging -------------------------------------------------

export async function logEvent(
  walletAddress: string,
  portfolioId: string,
  eventType: string,
  details?: Record<string, any>,
  metadata?: {
    level?: "portfolio" | "pool";
    poolId?: string;
    summary?: string;
    txDigest?: string;
    moneySaved?: number;
  }
): Promise<void> {
  const { error } = await supabase.admin
    .from("history_logs")
    .insert({
      wallet_address: walletAddress,
      portfolio_id: portfolioId,
      event_type: eventType,
      details: details || {},
      level: metadata?.level ?? "portfolio",
      pool_id: metadata?.poolId,
      summary: metadata?.summary,
      tx_digest: metadata?.txDigest,
      money_saved: metadata?.moneySaved,
    });

  if (error) console.error(`Failed to log event: ${error.message}`);
}

export async function getHistory(
  walletAddress: string,
  limit: number = 50,
  filter: "portfolio" | "pool" | "all" = "all"
): Promise<any[]> {
  let query = supabase.admin
    .from("history_logs")
    .select("*")
    .eq("wallet_address", walletAddress)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (filter !== "all") query = query.eq("level", filter);
  const { data, error } = await query;

  if (error) {
    console.error(`Failed to get history: ${error.message}`);
    return [];
  }
  return data || [];
}

export async function confirmGuard(
  walletAddress: string,
  portfolioId: string,
  capId: string,
  txDigest: string
): Promise<void> {
  const { error } = await supabase.admin.from("guarded_wallets").upsert({
    wallet_address: walletAddress,
    portfolio_id: portfolioId,
    cap_id: capId,
    guard_enabled: true,
    authorization_tx_digest: txDigest,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Failed to confirm Guard: ${error.message}`);
}

export async function checkSupabase(): Promise<void> {
  const { error } = await supabase.admin.from("history_logs").select("id").limit(1);
  if (error) throw new Error(error.message);
}
