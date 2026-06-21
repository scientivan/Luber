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

    # Health score: penalize concentration, dust, and out-of-range positions.
    score = 100.0
    score -= max(0.0, concentration - 30) * 0.7  # concentration above 30% hurts
    score -= len(dust) * 4
    score -= len(out_of_range) * 5
    score = max(0.0, min(100.0, round(score)))

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

    return {
        "healthScore": score,
        "riskLevel": _risk_level(score),
        "cluster": corr["cluster"],
        "dust": dust,
        "insights": insights[:3],
        "suggestedAllocation": suggest_allocation(positions, price_history, risk_tolerance),
        "confidence": 0.72,
    }
