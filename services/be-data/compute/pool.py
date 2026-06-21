"""Deep-diagnose a single LP pool.

Goes one level below the portfolio view: for ONE pool it estimates impermanent
loss, how much it contributes to the dominant correlation cluster, and whether
there is enough exit liquidity (DeepBook depth) to actually unwind it.

Every number is derived from the inputs — no "optimal", no fabricated constants.
"""
from __future__ import annotations

import math

from .correlation import correlation_matrix, detect_cluster


def _il_pct(price_ratio_change: float) -> float:
    """Impermanent loss for a 50/50 CLMM-style position given the price-ratio
    change `r` (= new_ratio / old_ratio) of the two pool tokens.

    Standard constant-product IL: 2*sqrt(r)/(1+r) - 1 (≤ 0). Returned as a
    positive percentage magnitude (e.g. 5.7 means a 5.7% drag vs HODL).
    """
    r = max(price_ratio_change, 1e-9)
    il = (2.0 * math.sqrt(r)) / (1.0 + r) - 1.0
    return round(abs(il) * 100.0, 2)


def _ratio_change(price_history: dict[str, list[float]], tok_x: str, tok_y: str) -> float:
    """Estimate how the X/Y price ratio moved over the window. Falls back to a
    volatility-implied move when one leg is missing/flat (stablecoin pairs)."""
    sx = price_history.get(tok_x)
    sy = price_history.get(tok_y)
    if sx and len(sx) >= 2 and sy and len(sy) >= 2:
        n = min(len(sx), len(sy))
        start = (sx[-n] / sy[-n]) if sy[-n] else 1.0
        end = (sx[-1] / sy[-1]) if sy[-1] else 1.0
        return (end / start) if start else 1.0
    # Single volatile leg vs a stable: use its own start→end move as the ratio move.
    series = sx if (sx and len(sx) >= 2) else sy
    if series and len(series) >= 2 and series[0]:
        return series[-1] / series[0]
    return 1.0


def _exit_liquidity(value_usd: float, deepbook_depth: dict | None, exit_pct: float = 1.0) -> dict:
    """Assess whether exiting `exit_pct` of this position is feasible against the
    available DeepBook depth. Slippage scales with the fraction of depth consumed.
    """
    if not deepbook_depth:
        return {"depthUSD": None, "spreadBps": None, "slippageBps": None, "feasible": None}
    depth_usd = float(deepbook_depth.get("depthUSD") or 0.0)
    spread_bps = float(deepbook_depth.get("spreadBps") or 0.0)
    exit_usd = value_usd * exit_pct
    # Consumed fraction of available depth → linear price impact, plus half-spread.
    consumed = (exit_usd / depth_usd) if depth_usd > 0 else 1.0
    slippage_bps = round(spread_bps / 2.0 + consumed * 100.0, 1)
    feasible = bool(depth_usd > 0 and exit_usd <= depth_usd * 0.10)  # ≤10% of depth = safe
    return {
        "depthUSD": round(depth_usd, 2),
        "spreadBps": round(spread_bps, 1),
        "slippageBps": slippage_bps,
        "feasible": feasible,
    }


def deep_diagnose_pool(
    positions: list[dict],
    price_history: dict[str, list[float]],
    pool_id: str,
    deepbook_depth: dict | None = None,
) -> dict:
    """Deep-dive one pool flagged by the portfolio diagnosis.

    Returns IL estimate, the pool's contribution to the dominant cluster, and an
    exit-liquidity feasibility check.
    """
    pool = next((p for p in positions if p.get("poolId") == pool_id), None)
    if pool is None:
        return {"error": f"pool {pool_id} not found in positions", "poolId": pool_id}

    value_usd = float(pool.get("valueUSD", 0.0))
    tok_x = pool.get("token") or pool.get("tokenX") or ""
    tok_y = pool.get("tokenY") or ""

    # ── Impermanent loss ─────────────────────────────────────────────────────
    ratio = _ratio_change(price_history, tok_x, tok_y)
    il_pct = _il_pct(ratio)
    il_usd = round(value_usd * il_pct / 100.0, 2)

    # ── Cluster contribution ─────────────────────────────────────────────────
    cl = detect_cluster(positions, price_history)
    cluster = cl["cluster"]
    cluster_token = cluster["token"]
    member_idx = set(cluster.get("positions", []))
    cluster_value = sum(
        float(positions[i].get("valueUSD", 0.0)) for i in member_idx if i < len(positions)
    ) or 1.0
    # Is THIS pool part of the dominant cluster? Correlate its primary token with the anchor.
    tokens, corr = correlation_matrix(price_history)
    idx = {t: i for i, t in enumerate(tokens)}
    in_cluster = False
    if tok_x in idx and cluster_token in idx:
        in_cluster = bool(abs(corr[idx[cluster_token], idx[tok_x]]) >= 0.7)
    contribution_pct = round(100.0 * value_usd / cluster_value, 1) if in_cluster else 0.0

    # ── Exit liquidity ───────────────────────────────────────────────────────
    exit_liq = _exit_liquidity(value_usd, deepbook_depth)

    return {
        "poolId": pool_id,
        "protocol": pool.get("protocol"),
        "pair": pool.get("pair"),
        "valueUSD": round(value_usd, 2),
        "inRange": pool.get("inRange", True),
        "daysOutOfRange": pool.get("daysOutOfRange", 0),
        "isDust": pool.get("isDust", False),
        "ilEstimatePct": il_pct,
        "ilEstimateUSD": il_usd,
        "clusterToken": cluster_token,
        "inCluster": in_cluster,
        "clusterContributionPct": contribution_pct,
        "exitLiquidity": exit_liq,
    }
