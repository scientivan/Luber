"""HTTP contract tests — lock the §7.2 / §15.4 response shapes via TestClient."""
from fastapi.testclient import TestClient

from main import app
from data.mock import demo_positions, demo_price_history

client = TestClient(app)


def _body():
    return {"positions": demo_positions(), "priceHistory": demo_price_history()}


def test_health_ok():
    r = client.get("/health")
    assert r.status_code == 200 and r.json() == {"ok": True}


def test_correlation_contract():
    r = client.post("/compute/correlation", json=_body())
    assert r.status_code == 200
    assert set(r.json()) >= {"matrix", "tokens", "cluster", "concentration"}


def test_risk_contract():
    r = client.post("/compute/risk", json=_body())
    assert r.status_code == 200
    j = r.json()
    assert set(j) >= {"healthScore", "riskLevel", "cluster", "dust", "insights", "suggestedAllocation", "confidence"}
    assert set(j["suggestedAllocation"]) >= {"allocations", "expectedHealthRange", "confidence", "riskOfWorsening", "assumptions"}
    # honesty: the headline confidence must equal the allocation's computed confidence
    assert j["confidence"] == j["suggestedAllocation"]["confidence"]


def test_stress_contract():
    r = client.post("/compute/stress", json={**_body(), "asset": "ETH", "pct": -10})
    assert r.status_code == 200
    j = r.json()
    assert set(j) >= {"asset", "pct", "atRiskUSD", "perPosition"}
    assert len(j["perPosition"]) == len(demo_positions())


def test_simulate_shock_contract():
    r = client.post("/compute/simulate-shock", json={**_body(), "asset": "ETH", "pct": -10})
    assert r.status_code == 200
    g = r.json()["guarded"]
    assert set(g) >= {"moneySaved", "postShockLossUSD", "postHealth", "formula"}


def test_validation_pct_out_of_range():
    assert client.post("/compute/stress", json={**_body(), "asset": "ETH", "pct": -999}).status_code == 422


def test_validation_bad_risk_tolerance():
    assert client.post("/compute/risk", json={**_body(), "riskTolerance": "yolo"}).status_code == 422


def test_validation_empty_asset():
    assert client.post("/compute/stress", json={**_body(), "asset": "", "pct": -10}).status_code == 422
