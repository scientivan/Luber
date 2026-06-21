"""Counterfactual 'money saved' — transparent, never fabricated.

money_saved = (cluster value lost if NOT rebalanced after the shock)
            - (portfolio value lost after rebalance)

The formula string is returned alongside the number so the UI can show it on
hover. This is the climax of the demo: the $1,800 planted in beat 1 paid off by
the ~$1,200 saved in beat 3.
"""
from __future__ import annotations

from config import RASA_MAX_EXPOSURE
from .correlation import detect_cluster
from .risk import health_after_concentration
from .stress import stress_test


def simulate_shock(
    positions: list[dict],
    price_history: dict[str, list[float]],
    asset: str,
    pct: float,
    plan: dict | None = None,
    risk_tolerance: str = "med",
):
    plan = plan or {}

    # Loss with NO defense.
    unguarded = stress_test(positions, price_history, asset, pct)
    at_risk = unguarded["atRiskUSD"]

    # cut_from = the portfolio's ACTUAL dominant-cluster concentration (not a magic
    # number). cut_to = the plan's target, else the RASA cap for this risk profile.
    actual_concentration = detect_cluster(positions, price_history)["concentration"]
    cut_from = plan.get("clusterCurrentPct", actual_concentration) / 100.0
    default_target = RASA_MAX_EXPOSURE.get(risk_tolerance, RASA_MAX_EXPOSURE["med"]) * 100.0
    cut_to = plan.get("clusterTargetPct", default_target) / 100.0
    cut_to = min(cut_to, cut_from)  # a rebalance reduces exposure, never increases it

    residual = cut_to / cut_from if cut_from else 1.0  # fraction of the loss still taken
    post_shock_loss = round(at_risk * residual, 2)
    money_saved = round(at_risk - post_shock_loss, 2)

    # Post-rebalance health = health with the cluster cut to cut_to (derived).
    post_health = health_after_concentration(positions, price_history, cut_to * 100.0)

    return {
        "scenario": {"asset": asset, "pct": pct},
        "atRiskUSD": at_risk,
        "guarded": {
            "moneySaved": money_saved,
            "postShockLossUSD": post_shock_loss,
            "postHealth": post_health,
            "formula": "(cluster value if NOT rebalanced) − (value after rebalance)",
        },
    }
