"""Portfolio correlation engine — the unique brain.

Detects the largest *correlation cluster* across positions: the answer to
"87% of your portfolio is one ETH bet". No competitor in the track does this.
"""
from __future__ import annotations

import numpy as np

from config import CLUSTER_CORR_THRESHOLD
from .returns import to_return_matrix


def correlation_matrix(price_history: dict[str, list[float]]):
    """Return (tokens, NxN Pearson correlation matrix)."""
    tokens, rets = to_return_matrix(price_history)
    if rets.shape[0] < 2 or len(tokens) < 2:
        n = len(tokens)
        return tokens, np.eye(n)
    # np.corrcoef expects variables in rows. Flat series (e.g. stablecoins) have
    # zero variance → corrcoef divides by 0 → NaN; we silence that and treat an
    # undefined correlation as 0 (uncorrelated), with a 1.0 self-correlation.
    with np.errstate(invalid="ignore", divide="ignore"):
        corr = np.corrcoef(rets.T)
    corr = np.nan_to_num(corr, nan=0.0)
    np.fill_diagonal(corr, 1.0)
    return tokens, corr


def detect_cluster(
    positions: list[dict],
    price_history: dict[str, list[float]],
    threshold: float = CLUSTER_CORR_THRESHOLD,
):
    """Find the dominant correlation cluster and its $ / % exposure.

    Greedy: for each token, sum the value of every position whose primary token
    correlates with it above `threshold`. The token with the highest clustered
    exposure wins. Returns the hero payload used across the whole product.
    """
    tokens, corr = correlation_matrix(price_history)
    idx = {t: i for i, t in enumerate(tokens)}

    total_value = sum(p.get("valueUSD", 0.0) for p in positions) or 1.0

    best = {"token": tokens[0] if tokens else "", "exposurePct": 0.0, "positions": []}

    for anchor in tokens:
        ai = idx[anchor]
        clustered_value = 0.0
        member_positions: list[int] = []
        for pi, pos in enumerate(positions):
            tok = pos.get("token") or pos.get("tokenX")
            if tok not in idx:
                continue
            c = abs(corr[ai, idx[tok]])
            if c >= threshold:
                clustered_value += pos.get("valueUSD", 0.0)
                member_positions.append(pi)
        exposure_pct = round(100.0 * clustered_value / total_value, 1)
        if exposure_pct > best["exposurePct"]:
            best = {
                "token": anchor,
                "exposurePct": exposure_pct,
                "positions": member_positions,
            }

    concentration = best["exposurePct"]
    return {
        "matrix": corr.tolist(),
        "tokens": tokens,
        "cluster": best,
        "concentration": concentration,
    }
