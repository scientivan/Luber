#!/usr/bin/env bash
# Live verification for the BE Agent ↔ BE Data integration (real data path).
#
#   1) start BE Data  : (cd services/be-data && uvicorn main:app --port 8000)
#   2) start BE Agent : (cd apps/server && set -a; . ../../.env; set +a; pnpm exec tsx src/index.ts)
#   3) run this       : bash scripts/verify_live.sh           # read+compute (safe, read-only)
#                       bash scripts/verify_live.sh --sign    # also signs a rebalance ON-CHAIN
#
# Read+compute needs NO private key. Signing needs STRATEGIST_PRIVATE_KEY (the
# cap-holding owner key) and LPG_WHITELIST set in .env.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env 2>/dev/null || true; set +a

API="${API:-http://localhost:8787}"
BE_DATA="${BE_DATA_URL:-http://localhost:8000}"
AMBER="${LPG_DEMO_AMBER_PORTFOLIO:?set LPG_DEMO_AMBER_PORTFOLIO in .env}"
RED="${LPG_DEMO_RED_PORTFOLIO:-}"
GREEN="${LPG_DEMO_GREEN_PORTFOLIO:-}"

j() { python3 -c "import json,sys;d=json.load(sys.stdin);print($1)"; }

echo "── preflight ─────────────────────────────────────────"
curl -sf -m 5 "$BE_DATA/health" >/dev/null && echo "✓ BE Data up ($BE_DATA)" || { echo "✗ BE Data down — start uvicorn :8000"; exit 1; }
MM=$(curl -sf -m 5 "$API/health" | j "d['mockMode']") || { echo "✗ BE Agent down — start it :8787"; exit 1; }
echo "✓ BE Agent up ($API) | mockMode=$MM"
[ "$MM" = "False" ] && echo "✓ real mode (mockMode off)" || echo "⚠ mockMode is ON — set LPG_PACKAGE_ID / run with .env sourced"

echo "── diagnose (real on-chain positions) ────────────────"
for P in "$AMBER" "$RED" "$GREEN"; do
  [ -z "$P" ] && continue
  curl -sf -m 60 -X POST "$API/portfolio/health" -H 'content-type: application/json' -d "{\"walletAddress\":\"$P\"}" \
    | j "f\"  {d['positionCount']} pos | \${d['totalValueUSD']} | health {d['healthScore']} {d['riskLevel']} | cluster {d['cluster']['exposurePct']}% {d['cluster']['token']}\""
done

echo "── simulate shock (Amber, ETH -20%) ──────────────────"
curl -sf -m 60 -X POST "$API/simulate/shock" -H 'content-type: application/json' -d "{\"walletAddress\":\"$AMBER\",\"asset\":\"ETH\",\"pct\":-20}" \
  | j "f\"  atRisk \${d['atRiskUSD']} | Guard saves \${d['guarded']['moneySaved']} | postHealth {d['guarded']['postHealth']}\""

if [ "${1:-}" = "--sign" ]; then
  echo "── signing (ON-CHAIN — Amber rebalance) ──────────────"
  [ -z "${STRATEGIST_PRIVATE_KEY:-}" ] && { echo "✗ STRATEGIST_PRIVATE_KEY not set"; exit 1; }
  [ -z "${LPG_WHITELIST:-}" ] && echo "⚠ LPG_WHITELIST empty — Move rebalance may reject (EPoolNotWhitelisted)"
  curl -sf -m 90 -X POST "$API/portfolio/rebalance" -H 'content-type: application/json' -d "{\"walletAddress\":\"$AMBER\"}" \
    | j "f\"  ✓ rebalance tx: {d['txDigest']}\n  ✓ report tx  : {d['reportTxDigest']}\n  money saved  : \${d['moneySaved']}\n  explorer     : {d['explorer']}\""
fi
echo "── done ──────────────────────────────────────────────"
