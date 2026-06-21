"""BE Data — FastAPI compute service for LP Guardian (Sui).

Pure-compute, zero Sui deps. Implements the §7.2 contract (BE Agent → BE Data).
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from compute.correlation import detect_cluster
from compute.risk import compute_risk
from compute.stress import stress_test
from compute.simulation import simulate_shock

app = FastAPI(title="LP Guardian — BE Data", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── request models ───────────────────────────────────────────────────────
class CorrelationReq(BaseModel):
    positions: list[dict]
    priceHistory: dict[str, list[float]]


class RiskReq(BaseModel):
    positions: list[dict]
    priceHistory: dict[str, list[float]]
    deepBookDepth: dict | None = None
    riskTolerance: str = "med"


class StressReq(BaseModel):
    positions: list[dict]
    priceHistory: dict[str, list[float]]
    asset: str
    pct: float = Field(ge=-100, le=100)


class ShockReq(StressReq):
    plan: dict | None = None


# ── routes ───────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"ok": True}


@app.post("/compute/correlation")
def correlation(req: CorrelationReq):
    return detect_cluster(req.positions, req.priceHistory)


@app.post("/compute/risk")
def risk(req: RiskReq):
    return compute_risk(req.positions, req.priceHistory, req.deepBookDepth, req.riskTolerance)


@app.post("/compute/stress")
def stress(req: StressReq):
    return stress_test(req.positions, req.priceHistory, req.asset, req.pct)


@app.post("/compute/simulate-shock")
def shock(req: ShockReq):
    return simulate_shock(req.positions, req.priceHistory, req.asset, req.pct, req.plan)


if __name__ == "__main__":
    import uvicorn

    from config import PORT

    uvicorn.run(app, host="0.0.0.0", port=PORT)
