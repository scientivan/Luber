"""Single source of truth for the pitch deck's numbers.

Runs the real compute over each demo wallet and prints the hero figures
(health, risk level, dominant cluster, $ at-risk, $ saved). Every number here is
DERIVED by the service — nothing hardcoded — so the deck must match this output,
not the other way round. If the pitch says "87% / $1,800", it must be a number
that appears below; otherwise change the deck (or the fixture), never fake it.

Run:  python scripts/demo_numbers.py            # synthetic priceHistory (offline)
      python scripts/demo_numbers.py --real     # real Bybit priceHistory
"""
from __future__ import annotations

import os
import sys
import warnings

warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from compute.risk import compute_risk  # noqa: E402
from compute.simulation import simulate_shock  # noqa: E402
from compute.stress import stress_test  # noqa: E402
from data.mock import DEMO_WALLETS, demo_positions  # noqa: E402
from data.prices import load_price_history  # noqa: E402


def _price_history(positions, use_real):
    tokens = []
    for p in positions:
        for k in ("token", "tokenX", "tokenY"):
            if p.get(k) and p[k] not in tokens:
                tokens.append(p[k])
    src = "auto" if use_real else "synthetic"
    out = load_price_history(tokens, source=src)
    return out["priceHistory"], out["provenance"]


def main(use_real: bool) -> None:
    for wallet in DEMO_WALLETS:
        pos = demo_positions(wallet)
        ph, prov = _price_history(pos, use_real)
        r = compute_risk(pos, ph)
        cl = r["cluster"]
        total = sum(p["valueUSD"] for p in pos)

        print(f"\n══ {wallet} ══  ({len(pos)} positions, ${total:,.0f})  price={prov['label']}")
        print(f"  health        : {r['healthScore']}/100  ({r['riskLevel'].upper()})   confidence {r['confidence']}")
        print(f"  cluster       : {cl['exposurePct']}% is one {cl['token']} bet  (positions {cl['positions']})")
        print(f"  dust          : {len(r['dust'])}   insights: {[i['type'] for i in r['insights']]}")
        rng = r["suggestedAllocation"]["expectedHealthRange"]
        print(f"  if rebalanced : health → {rng[0]}–{rng[1]}")
        top = cl["token"]
        for pct in (-10, -20):
            s = stress_test(pos, ph, top, pct)
            sh = simulate_shock(pos, ph, top, pct)
            g = sh["guarded"]
            print(f"  {top} {pct:>4}%   : at-risk ${s['atRiskUSD']:,.0f}  →  Guard saves ${g['moneySaved']:,.0f} "
                  f"(post-loss ${g['postShockLossUSD']:,.0f}, post-health {g['postHealth']})")


if __name__ == "__main__":
    main("--real" in sys.argv)
