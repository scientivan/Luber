"""BE Data — FastAPI compute service for LP Guardian (Sui).

Pure-compute, zero Sui deps. Implements the §7.2 contract (BE Agent → BE Data).
"""
from __future__ import annotations

from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from compute.correlation import detect_cluster
from compute.risk import compute_risk
from compute.stress import stress_test
from compute.simulation import simulate_shock
from data.prices import resolve_price_history

app = FastAPI(title="LP Guardian — BE Data", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── request models ───────────────────────────────────────────────────────
# priceHistory is OPTIONAL: callers (Scout/Pyth) normally supply it and we use it
# as-is; when absent we fetch it ourselves (Bybit → snapshot → synthetic).
class CorrelationReq(BaseModel):
    positions: list[dict]
    priceHistory: dict[str, list[float]] | None = None


class RiskReq(BaseModel):
    positions: list[dict]
    priceHistory: dict[str, list[float]] | None = None
    deepBookDepth: dict | None = None
    riskTolerance: Literal["low", "med", "high"] = "med"


class StressReq(BaseModel):
    positions: list[dict]
    priceHistory: dict[str, list[float]] | None = None
    asset: str = Field(min_length=1)
    pct: float = Field(ge=-100, le=100)


class ShockReq(StressReq):
    plan: dict | None = None


# ── routes ───────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"ok": True}


@app.post("/compute/correlation")
def correlation(req: CorrelationReq):
    ph, _ = resolve_price_history(req.positions, req.priceHistory)
    return detect_cluster(req.positions, ph)


@app.post("/compute/risk")
def risk(req: RiskReq):
    ph, prov = resolve_price_history(req.positions, req.priceHistory)
    out = compute_risk(req.positions, ph, req.deepBookDepth, req.riskTolerance)
    out["priceProvenance"] = prov  # honest label of where the prices came from
    return out


@app.post("/compute/stress")
def stress(req: StressReq):
    ph, _ = resolve_price_history(req.positions, req.priceHistory)
    return stress_test(req.positions, ph, req.asset, req.pct)


@app.post("/compute/simulate-shock")
def shock(req: ShockReq):
    ph, prov = resolve_price_history(req.positions, req.priceHistory)
    out = simulate_shock(req.positions, ph, req.asset, req.pct, req.plan)
    out["priceProvenance"] = prov
    return out


if __name__ == "__main__":
    import uvicorn

    from config import PORT

    uvicorn.run(app, host="0.0.0.0", port=PORT)
