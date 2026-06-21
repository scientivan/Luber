"""Smoke tests for the compute brain — fully runnable without Node/Sui."""
from data.mock import demo_positions, demo_price_history
from compute.correlation import detect_cluster
from compute.risk import compute_risk
from compute.stress import stress_test
from compute.simulation import simulate_shock


def test_cluster_finds_eth_bet():
    out = detect_cluster(demo_positions(), demo_price_history())
    assert out["cluster"]["token"] == "ETH"
    # ETH family should dominate the portfolio.
    assert out["concentration"] > 60


def test_risk_amber_or_red():
    out = compute_risk(demo_positions(), demo_price_history())
    assert out["riskLevel"] in {"amber", "red", "green"}
    assert 0 <= out["healthScore"] <= 100
    assert len(out["insights"]) <= 3


def test_stress_loss_positive():
    out = stress_test(demo_positions(), demo_price_history(), "ETH", -10)
    assert out["atRiskUSD"] > 0


def test_money_saved_transparent():
    out = simulate_shock(demo_positions(), demo_price_history(), "ETH", -10)
    assert out["guarded"]["moneySaved"] >= 0
    assert "formula" in out["guarded"]
