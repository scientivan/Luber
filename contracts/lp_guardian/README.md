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

## Build / deploy

```bash
sui move build
sui move test
sui client publish --gas-budget 200000000
```
