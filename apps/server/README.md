# BE Agent — LP Guardian (Sui)

The glue + the only on-chain *signer*. Hosts:

- **Scout** — reads Portfolio/Position objects via RPC; fetches Cetus/Turbos +
  DeepBook depth.
- **Strategist** — calls BE Data, builds the rebalance PTB, **signs via
  `StrategistCap`**, returns tx digest + report id.
- **Intent Router** — maps chat/MCP intents → handlers.
- **Watcher** — a separate 24/7 service (NOT the MCP server) that polls price
  (Pyth/simulate) and executes the autonomous save when a threshold trips.
- **REST + WS API** — the §7.1 contract consumed by the web app and wrapped
  (read-only) by the MCP server.

The MCP server is a thin adapter on top of these endpoints — it never holds keys
and never signs.

## Run

```bash
pnpm --filter @lp-guardian/server dev          # API on :8787
pnpm --filter @lp-guardian/server watcher      # autonomous watcher loop
```

Set `MOCK_MODE=true` (default when no `LPG_PACKAGE_ID`) to run entirely on mock
data — Day-0 deliverable so FE/MCP can develop without a deployed package.

## Real-data integration (mock → real)

The diagnose/simulate pipeline runs on **real** data when `MOCK_MODE` is off
(automatic once `LPG_PACKAGE_ID` is set):

1. **Scout** reads real Position objects from the resolved portfolio
   (`resolvePortfolio`) and fetches real prices from Pyth, keyed by **canonical**
   symbol (`WETH`/`stETH` → `ETH`) so the ETH family forms one cluster.
2. **BE Data** (Python, `:8000`) computes correlation/risk/stress. It is the
   single source of compute and of synthetic fallback prices — `beDataClient`
   never fabricates numbers; on failure it throws so the error surfaces.
3. Prices follow a layered source, labeled by `priceProvenance` in the response:
   caller-`provided` (Scout/Pyth) → `real`/`snapshot`/`synthetic` (BE Data fetches
   only when Scout sends none).

### Run real end-to-end

```bash
# 1) BE Data (compute)
cd services/be-data && uvicorn main:app --port 8000
# 2) BE Agent (.env must have LPG_PACKAGE_ID / LPG_PORTFOLIO_ID / demo ids)
pnpm install && pnpm --filter @lp-guardian/server dev      # :8787
# 3) diagnose a demo portfolio (pass its portfolioId as walletAddress)
curl -XPOST localhost:8787/portfolio/health -H 'content-type: application/json' \
  -d '{"walletAddress":"<LPG_DEMO_AMBER_PORTFOLIO>"}'
```

### Signing (Fix / autonomous Guard)

`POST /portfolio/rebalance {walletAddress}` and `/watcher/trigger-shock` sign via
the `StrategistCap`. Requirements:

- `STRATEGIST_PRIVATE_KEY` = the cap-holding agent key (owner during seeding).
- `LPG_WHITELIST` = comma-separated whitelisted pool ids (the Move `rebalance`
  gate; from `deployment.json`).
- The Move `rebalance` applies `new_value_usd` **by position index**, so Scout
  sorts positions by their on-chain dynamic-field key — keep that ordering.

Note: `moveCalls.buildRebalanceTx` passes `target_pools` as `vector<address>`;
the Move signature is `vector<ID>` (BCS-identical). Verify on first live call.
