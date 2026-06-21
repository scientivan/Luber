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
