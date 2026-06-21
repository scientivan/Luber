#!/usr/bin/env bash
# Deploy the lp_guardian Move package to Sui testnet, then seed 3 demo portfolios.
#
#   ./scripts/deploy.sh
#
# Requires: sui CLI, node. Run from the package root (contracts/lp_guardian).
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> switch to testnet"
sui client switch --env testnet

echo "==> ensure gas (faucet is web-only now; top up if needed):"
echo "    https://faucet.sui.io/?address=$(sui client active-address)"
sui client gas || true

echo "==> build + test (gate before publish)"
sui move build
sui move test

echo "==> publish"
RAW=$(sui client publish --gas-budget 200000000 --json)
PKG=$(node -e 'let r=process.argv[1];let o=JSON.parse(r.slice(r.indexOf("{")));console.log(o.objectChanges.find(c=>c.type==="published").packageId)' "$RAW")
echo "Published package: $PKG"

echo "==> seed demo portfolios"
PKG="$PKG" node scripts/seed_demo.js

echo "==> done. See deployment.json / deployment.md"
