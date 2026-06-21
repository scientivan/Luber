"""Portfolio health score, risk level, dust detection, insights."""
from __future__ import annotations

from config import DUST_THRESHOLD_USD
from .correlation import detect_cluster
from .optimization import suggest_allocation


def _risk_level(score: float) -> str:
    if score >= 60:
        return "green"
    if score >= 40:
        return "amber"
    return "red"


def health_score(concentration: float, n_dust: int, n_out_of_range: int) -> float:
    """Transparent health formula (single source of truth).

    Penalizes correlation concentration above 30%, dust positions, and
    out-of-range positions. Used both for the current score and for projecting
    post-rebalance health (so projections stay consistent with the headline).
    """
    score = 100.0
    score -= max(0.0, concentration - 30) * 0.7  # concentration above 30% hurts
    score -= n_dust * 4
    score -= n_out_of_range * 5
    return max(0.0, min(100.0, score))


def health_after_concentration(
    positions: list[dict],
    price_history: dict[str, list[float]],
    new_concentration_pct: float,
) -> int:
    """Project health if the dominant cluster were cut to ``new_concentration_pct``.

    Dust/out-of-range penalties are held constant (a rebalance does not assume it
    fixes them), so the only thing that moves is the concentration term.
    """
    dust = [i for i, p in enumerate(positions) if p.get("valueUSD", 0.0) < DUST_THRESHOLD_USD]
    out_of_range = [i for i, p in enumerate(positions) if not p.get("inRange", True)]
    return round(health_score(new_concentration_pct, len(dust), len(out_of_range)))


def compute_risk(
    positions: list[dict],
    price_history: dict[str, list[float]],
    deep_book_depth: dict | None = None,
    risk_tolerance: str = "med",
):
    corr = detect_cluster(positions, price_history)
    concentration = corr["concentration"]  # % in the biggest cluster

    dust = [i for i, p in enumerate(positions) if p.get("valueUSD", 0.0) < DUST_THRESHOLD_USD]
    out_of_range = [i for i, p in enumerate(positions) if not p.get("inRange", True)]

    score = round(health_score(concentration, len(dust), len(out_of_range)))

    insights = []
    if concentration >= 50:
        insights.append({
            "id": "ins_corr",
            "type": "correlation_risk",
            "severity": "critical",
            "title": f"{int(concentration)}% is one {corr['cluster']['token']} bet",
            "description": (
                f"You think you have {len(positions)} positions. You really have one bet — "
                f"{int(concentration)}% correlated to {corr['cluster']['token']}. "
                "If it drops, all of them bleed at once."
            ),
            "affectedPositions": corr["cluster"]["positions"],
        })
    if dust:
        insights.append({
            "id": "ins_dust",
            "type": "dust_detected",
            "severity": "warning",
            "title": f"{len(dust)} dust positions",
            "description": "These are too small to be worth closing (gas > value) but still carry IL exposure.",
            "affectedPositions": dust,
        })
    if out_of_range:
        insights.append({
            "id": "ins_oor",
            "type": "out_of_range",
            "severity": "warning",
            "title": f"{len(out_of_range)} positions out of range",
            "description": "Earning zero fees while out of range.",
            "affectedPositions": out_of_range,
        })

    alloc = suggest_allocation(positions, price_history, risk_tolerance)

    # Project post-rebalance health from the suggested target weights, using the
    # SAME concentration definition as the headline (detect_cluster on pseudo
    # positions synthesized from the target allocation). No hardcoded range.
    total = sum(p.get("valueUSD", 0.0) for p in positions) or 1.0
    pseudo = [
        {"token": a["token"], "valueUSD": a["targetPct"] / 100.0 * total}
        for a in alloc["allocations"]
    ]
    proj_concentration = detect_cluster(pseudo, price_history)["concentration"] if pseudo else concentration
    proj_health = health_after_concentration(positions, price_history, proj_concentration)
    # Band widens as confidence drops (less certain → wider range).
    band = max(3, round((1.0 - alloc["confidence"]) * 20))
    alloc["expectedHealthRange"] = [
        max(0, proj_health - band),
        min(100, proj_health + band),
    ]

    return {
        "healthScore": score,
        "riskLevel": _risk_level(score),
        "cluster": corr["cluster"],
        "dust": dust,
        "insights": insights[:3],
        "suggestedAllocation": alloc,
        "confidence": alloc["confidence"],
    }
