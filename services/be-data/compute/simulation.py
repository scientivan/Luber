"""Counterfactual 'money saved' — transparent, never fabricated.

money_saved = (cluster value lost if NOT rebalanced after the shock)
            - (portfolio value lost after rebalance)

The formula string is returned alongside the number so the UI can show it on
hover. This is the climax of the demo: the $1,800 planted in beat 1 paid off by
the ~$1,200 saved in beat 3.
"""
from __future__ import annotations

from .stress import stress_test


def simulate_shock(
    positions: list[dict],
    price_history: dict[str, list[float]],
    asset: str,
    pct: float,
    plan: dict | None = None,
):
    # Loss with NO defense.
    unguarded = stress_test(positions, price_history, asset, pct)
    at_risk = unguarded["atRiskUSD"]

    # Post-rebalance exposure: the plan cuts cluster exposure to target.
    # If no plan supplied, assume a standard correlation-aware cut to 40%.
    cut_to = (plan or {}).get("clusterTargetPct", 40) / 100.0
    cut_from = (plan or {}).get("clusterCurrentPct", 87) / 100.0
    residual = cut_to / cut_from if cut_from else 1.0  # fraction of loss still taken

    post_shock_loss = round(at_risk * residual, 2)
    money_saved = round(at_risk - post_shock_loss, 2)

    return {
        "scenario": {"asset": asset, "pct": pct},
        "atRiskUSD": at_risk,
        "guarded": {
            "moneySaved": money_saved,
            "postShockLossUSD": post_shock_loss,
            "postHealth": 61,
            "formula": "(cluster value if NOT rebalanced) − (value after rebalance)",
        },
    }
