alter table public.guarded_wallets enable row level security;
alter table public.history_logs enable row level security;

alter table public.history_logs
  add column if not exists level text not null default 'portfolio'
    check (level in ('portfolio', 'pool')),
  add column if not exists pool_id text,
  add column if not exists summary text,
  add column if not exists tx_digest text,
  add column if not exists money_saved numeric;

alter table public.guarded_wallets
  add column if not exists cap_id text,
  add column if not exists authorization_tx_digest text;

create table if not exists public.auth_challenges (
  id uuid primary key default gen_random_uuid(),
  nonce_hash text not null unique,
  wallet_address text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.auth_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  wallet_address text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.rebalance_intents (
  id uuid primary key,
  wallet_address text not null,
  portfolio_id text not null,
  session_id uuid not null references public.auth_sessions(id) on delete cascade,
  plan_hash text not null,
  plan jsonb not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_history_logs_wallet_level_created
  on public.history_logs(wallet_address, level, created_at desc);
create index if not exists idx_auth_sessions_token_hash on public.auth_sessions(token_hash);
create index if not exists idx_rebalance_intents_wallet on public.rebalance_intents(wallet_address, created_at desc);

alter table public.auth_challenges enable row level security;
alter table public.auth_sessions enable row level security;
alter table public.rebalance_intents enable row level security;

drop policy if exists "Public history is readable" on public.history_logs;
create policy "Public history is readable"
  on public.history_logs for select
  to anon, authenticated
  using (true);

revoke all on public.guarded_wallets from anon, authenticated;
revoke all on public.auth_challenges from anon, authenticated;
revoke all on public.auth_sessions from anon, authenticated;
revoke all on public.rebalance_intents from anon, authenticated;
grant select on public.history_logs to anon, authenticated;
