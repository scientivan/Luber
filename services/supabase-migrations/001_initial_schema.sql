-- LP Guardian Supabase Schema
-- Migration: 2026-06-21 - Initial schema for guarded wallets and history logs

-- Table 1: Guarded Wallets (stores baseline prices, thresholds, guard status)
CREATE TABLE IF NOT EXISTS guarded_wallets (
  wallet_address TEXT PRIMARY KEY,
  portfolio_id TEXT NOT NULL,
  baseline_prices JSONB NOT NULL DEFAULT '{}'::jsonb,
  risk_threshold_pct DECIMAL DEFAULT -10.0,
  guard_enabled BOOLEAN DEFAULT true,
  last_check_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 2: History Logs (stores all events: rebalances, breaches, etc.)
CREATE TABLE IF NOT EXISTS history_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  portfolio_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_guarded_wallets_portfolio ON guarded_wallets(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_history_logs_wallet ON history_logs(wallet_address);
CREATE INDEX IF NOT EXISTS idx_history_logs_created ON history_logs(created_at DESC);

-- Updated_at trigger for guarded_wallets
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_guarded_wallets_updated_at
  BEFORE UPDATE ON guarded_wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
