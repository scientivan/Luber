# lp_guardian — Move package

The non-custody core. The whole trust story lives here: **the module has no
function that can move funds to anyone but the owner.**

## Objects

| Object | Ownership | Role |
|--------|-----------|------|
| `Portfolio` | shared object | holds positions; governed by capability |
| `Position` | child of Portfolio | one LP position |
| `StrategistCap` | owned by agent | scoped, expiring, **revocable** right to `rebalance` |
| `HealthReport` | immutable | on-chain audit trail of each analysis |
| `DeepBookPoolRef` | shared | reference to a whitelisted DeepBook pool |

## The non-custody invariant

The agent (via `StrategistCap`) can only:
- `rebalance(...)` — within a **whitelisted** pool set, bounded slippage.
- nothing else that moves value.

`withdraw(...)` always sends to `portfolio.owner` and requires no cap (owner-only).
There is **no** function that transfers assets to an arbitrary address. The
`test_agent_cannot_withdraw_to_self` unit test proves it.

## Function interface (frozen — for BE Agent PTBs)

```
create_portfolio(whitelist: vector<ID>, max_slippage_bps: u64, ctx) -> ID   // shares Portfolio
deposit(portfolio: &mut Portfolio, coin: Coin<SUI>, ctx)                     // owner-only
add_position(portfolio, protocol: u8, pool_id: ID, token_x: String, token_y: String,
             liquidity: u128, tick_lower: u32, tick_upper: u32, value_usd: u64, ctx) -> ID
authorize_strategist(portfolio, agent_address: address, expires_at_epoch: u64, ctx) -> StrategistCap
rebalance(portfolio, cap: &StrategistCap, target_pools: vector<ID>,
          new_value_usd: vector<u64>, slippage_bps: u64, ctx)                // whitelist + slippage; NO exfil
withdraw(portfolio, amount: u64, ctx)                                        // owner-only, recipient = owner
revoke_cap(portfolio, ctx)                                                   // owner-only; bumps cap_version
mint_health_report(portfolio, cap: &StrategistCap, score: u8, risk_level: u8,
                   insights: String, allocation: String, confidence: u8, ctx) -> ID  // freezes report
register_deepbook_pool(pool_id: ID, base: String, quote: String, ctx) -> ID
```

Notes for callers:
- `authorize_strategist` and `mint_health_report` are NON-`entry` public functions that return a value;
  invoke them via a **PTB** (`sui client ptb` / SDK Transaction), not a bare `sui client call`
  (the CLI rejects the returned value). See `scripts/seed_demo.js` for working examples.
- `risk_level`: 0 = green, 1 = amber, 2 = red.
- Revocation model: caps carry a `cap_version`; `revoke_cap` bumps the Portfolio's version so **all**
  outstanding caps stop validating at once (no need to touch the agent's cap object).

## Build / deploy

```bash
sui move build
sui move test
./scripts/deploy.sh          # switch testnet -> build -> test -> publish -> seed demos
```

## Deployed (testnet)

Current package id + the 3 demo portfolio / health-report object ids are written to
[`deployment.json`](./deployment.json) and [`deployment.md`](./deployment.md) — the Day-0 handoff for
BE Agent / FE.
