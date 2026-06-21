# BE Data — LP Guardian compute service

Pure-compute FastAPI service. **Zero Sui dependencies** — it only does portfolio
math (correlation, risk, stress, counterfactual). This is the unique "brain":
portfolio-level cross-position correlation that nobody else in the track does.

The correlation engine is adapted from the Mantle version (NumPy math is
chain-agnostic).

## Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /compute/correlation` | matrix + cluster + concentration |
| `POST /compute/risk` | healthScore, riskLevel, dust, insights, RASA allocation, confidence |
| `POST /compute/stress` | "$ at risk if asset X drops k%" + per-position breakdown |
| `POST /compute/simulate-shock` | counterfactual money-saved + post-rebalance state |
| `GET  /health` | liveness |

## Run

```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Design notes

- **RASA, not "optimal".** Output suggested weights + confidence interval +
  risk of worsening. "Optimal" is a red flag for judges.
- **Counterfactual money-saved is transparent.** `formula` is returned alongside
  the number and shown on hover in the UI. Never fabricate the number.
