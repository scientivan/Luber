# BE Data — LP Guardian compute service

Pure-compute FastAPI service. **Zero Sui dependencies** — it only does portfolio
math (correlation, risk, stress, counterfactual). This is the unique "brain":
portfolio-level cross-position correlation that nobody else in the track does.

The correlation engine is adapted from the Mantle version (NumPy math is
chain-agnostic).

## Role boundary

BE Data **never reads the chain**. It receives `positions` and (optionally)
`priceHistory` from the BE Agent (Scout, §6.3) and computes. During development
`positions` come from fixtures (`data/mock.py`); real positions are swapped in at
integration. Only `priceHistory` may be sourced live here — see [Price history](#price-history).

## Endpoints (contract frozen — brief §7.2 / §15.4)

| Endpoint | Request | Response |
|----------|---------|----------|
| `POST /compute/correlation` | `{positions, priceHistory}` | `{matrix, tokens, cluster, concentration}` |
| `POST /compute/risk` | `{positions, priceHistory, deepBookDepth?, riskTolerance?}` | `{healthScore, riskLevel, cluster, dust, insights, suggestedAllocation, confidence}` |
| `POST /compute/stress` | `{positions, priceHistory, asset, pct}` | `{asset, pct, atRiskUSD, perPosition[]}` |
| `POST /compute/simulate-shock` | `{positions, priceHistory, asset, pct, plan?}` | `{scenario, atRiskUSD, guarded:{moneySaved, postShockLossUSD, postHealth, formula}}` |
| `GET  /health` | — | `{ok:true}` |

`riskTolerance ∈ {low, med, high}` (default `med`); `pct ∈ [-100, 100]`; `asset`
non-empty. Invalid input → `422`.

## Run

```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
python -m pytest -q          # 23 tests, no network/Sui needed
```

## Demo numbers (single source of truth for the pitch)

```bash
python scripts/demo_numbers.py          # synthetic priceHistory (offline)
python scripts/demo_numbers.py --real    # real Bybit priceHistory
```

Prints the **derived** hero figures for all three demo wallets. The deck must
match this output — never hardcode a number the service doesn't produce. With the
current fixtures: demo-1 = 87% ETH cluster / amber; an ETH **−20%** shock is the
honest source of the "~$1,800 at risk" headline (a −10% shock is ~$920). demo-2 =
red + dust; demo-3 = green.

## Price history (real + fallback)

`data/prices.py` resolves `priceHistory` (`load_price_history`, `source="auto"`):

1. **real** — Bybit v5 daily closes (no API key), the credible source;
2. **snapshot** — a frozen `data/snapshots/prices.json` (offline demo-safe);
3. **synthetic** — a seeded, deterministic correlated random walk (always works).

Every result carries `provenance` (`{label, source, degraded, warnings}`) so the
UI can honestly say where the numbers came from. Stablecoins are pinned to `1.0`.
Freeze a snapshot for offline demos:

```bash
python -m data.prices ETH BTC SUI        # writes data/snapshots/prices.json
```

### Config (env vars)

| Var | Default | Meaning |
|-----|---------|---------|
| `PORT` | `8000` | server port |
| `BYBIT_API_BASE` | `https://api.bybit.com` | price source base |
| `BYBIT_SYMBOL_MAP` | (built-in) | JSON override `{"ETH":"ETHUSDT",...}` |
| `PRICE_HISTORY_DAYS` | `120` | days of closes to fetch/generate |
| `STABLES` | `USDC,USDT,DAI,USDY,BUCK` | tokens pinned to 1.0 |
| `RASA_MAX_EXPOSURE_{LOW,MED,HIGH}` | `0.30/0.40/0.50` | single-token caps |
| `DUST_THRESHOLD_USD` | `20` | below this = dust |
| `CLUSTER_CORR_THRESHOLD` | `0.7` | corr ≥ this = "one bet" |

## Design notes

- **No hardcoded result numbers.** `confidence`, `expectedHealthRange`, and
  `postHealth` are all derived from the input (the headline `confidence` equals the
  allocation's computed confidence). Health uses one transparent formula
  (`compute.risk.health_score`) for both current and projected scores.
- **RASA, not "optimal".** Suggested weights + confidence interval + risk of
  worsening + assumptions. "Optimal" is a red flag for judges.
- **Counterfactual money-saved is transparent.** `cut_from` is the portfolio's
  actual dominant-cluster concentration (not a magic 87); `formula` is returned
  alongside the number and shown on hover. Never fabricate the number.
- **Degrades, never crashes.** Empty portfolio, foreign asset, single token, and
  flat/stable (zero-variance) prices are all handled.
