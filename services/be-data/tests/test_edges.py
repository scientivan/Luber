"""Edge cases — the compute layer must degrade gracefully, never crash."""
from compute.correlation import detect_cluster
from compute.risk import compute_risk
from compute.stress import stress_test
from compute.simulation import simulate_shock


def test_empty_portfolio():
    assert detect_cluster([], {})["concentration"] == 0.0
    r = compute_risk([], {})
    assert r["healthScore"] == 100 and r["insights"] == []
    assert stress_test([], {}, "ETH", -10)["atRiskUSD"] == 0.0
    assert simulate_shock([], {}, "ETH", -10)["guarded"]["moneySaved"] == 0.0


def test_asset_not_in_portfolio():
    pos = [{"token": "ETH", "valueUSD": 100, "inRange": True}]
    ph = {"ETH": [1.0, 1.1, 1.05, 1.2]}
    # No exposure to DOGE → zero at-risk, no crash.
    assert stress_test(pos, ph, "DOGE", -10)["atRiskUSD"] == 0.0
    assert simulate_shock(pos, ph, "DOGE", -10)["atRiskUSD"] == 0.0


def test_single_token():
    pos = [{"token": "ETH", "valueUSD": 1000, "inRange": True}]
    ph = {"ETH": [1.0, 1.1, 1.05, 1.2, 1.15]}
    r = compute_risk(pos, ph)
    assert r["cluster"]["token"] == "ETH"
    assert 0 <= r["healthScore"] <= 100


def test_flat_stable_prices_no_nan():
    # A flat series has zero variance → correlation is undefined; must become 0,
    # never NaN, and must not raise.
    pos = [{"token": "USDC", "valueUSD": 500, "inRange": True}]
    out = detect_cluster(pos, {"USDC": [1.0, 1.0, 1.0, 1.0]})
    flat = out["matrix"]
    assert all(all(v == v for v in row) for row in flat)  # no NaN (NaN != NaN)


def test_position_token_missing_from_price_history():
    pos = [{"token": "XYZ", "valueUSD": 100, "inRange": True}]
    # token absent from priceHistory → treated as uncorrelated, zero at-risk.
    assert stress_test(pos, {"ETH": [1.0, 1.1, 1.2]}, "ETH", -10)["atRiskUSD"] == 0.0
