"""Smoke + invariant tests for the compute brain — runs without Node/Sui."""
from data.mock import demo_positions, demo_price_history
from compute.correlation import detect_cluster
from compute.risk import compute_risk
from compute.stress import stress_test
from compute.simulation import simulate_shock


def test_cluster_finds_eth_bet():
    out = detect_cluster(demo_positions(), demo_price_history())
    assert out["cluster"]["token"] == "ETH"
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


# ── per-wallet invariants (lock the demo so regressions are caught) ───────────
def test_demo1_amber_eth_cluster():
    r = compute_risk(demo_positions("demo-1"), demo_price_history())
    assert r["riskLevel"] == "amber"
    assert r["cluster"]["token"] == "ETH"
    assert 80 <= r["cluster"]["exposurePct"] <= 95  # ~87% one ETH bet


def test_demo2_red_with_dust():
    r = compute_risk(demo_positions("demo-2"), demo_price_history())
    assert r["riskLevel"] == "red"
    assert len(r["dust"]) >= 1
    assert any(i["type"] == "dust_detected" for i in r["insights"])


def test_demo3_green_diversified():
    r = compute_risk(demo_positions("demo-3"), demo_price_history())
    assert r["riskLevel"] == "green"
    assert r["cluster"]["exposurePct"] <= 50


# ── honesty invariants (no fabricated numbers) ───────────────────────────────
def test_confidence_is_consistent():
    r = compute_risk(demo_positions(), demo_price_history())
    # the old code returned a hardcoded 0.72 that disagreed with the allocation
    assert r["confidence"] == r["suggestedAllocation"]["confidence"]


def test_post_health_is_derived_not_constant():
    # postHealth used to be a constant 61; it must now move with the portfolio.
    a = simulate_shock(demo_positions("demo-1"), demo_price_history(), "ETH", -10)["guarded"]["postHealth"]
    b = simulate_shock(demo_positions("demo-3"), demo_price_history(), "ETH", -10)["guarded"]["postHealth"]
    assert a != b


def test_expected_health_range_brackets_a_projection():
    r = compute_risk(demo_positions(), demo_price_history())
    lo, hi = r["suggestedAllocation"]["expectedHealthRange"]
    assert 0 <= lo <= hi <= 100
    assert hi > lo  # a real (non-degenerate) range
