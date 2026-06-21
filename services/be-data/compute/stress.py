"""Plain-English stress-test: '$ at risk if asset X moves k%'.

Talk money, not math. Drives F2 (Plain-English Stress-Test) and the demo's
planted RWA number ("you lose ~$1,800 across all of them at once").
"""
from __future__ import annotations

import numpy as np

from .correlation import correlation_matrix


def stress_test(
    positions: list[dict],
    price_history: dict[str, list[float]],
    asset: str,
    pct: float,
):
    """Estimate portfolio $ loss if `asset` moves `pct`%.

    Each position bleeds in proportion to how correlated its token is to the
    shocked asset (beta proxy via correlation). This is *why* "5 positions" are
    really "1 bet": a shock to one asset propagates through the cluster.
    """
    tokens, corr = correlation_matrix(price_history)
    idx = {t: i for i, t in enumerate(tokens)}
    move = pct / 100.0

    per_position = []
    total_loss = 0.0
    for pi, pos in enumerate(positions):
        tok = pos.get("token") or pos.get("tokenX")
        beta = float(abs(corr[idx[asset], idx[tok]])) if (asset in idx and tok in idx) else 0.0
        loss = pos.get("valueUSD", 0.0) * move * beta
        per_position.append({"positionIndex": pi, "lossUSD": round(loss, 2)})
        total_loss += loss

    return {
        "asset": asset,
        "pct": pct,
        "atRiskUSD": round(abs(total_loss), 2),
        "perPosition": per_position,
    }
