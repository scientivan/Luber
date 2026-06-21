"""priceHistory source — real (Bybit) with a deterministic synthetic fallback.

BE Data is pure-compute: it never reads the chain. ``positions`` arrive from the
BE Agent (Scout); only ``priceHistory`` is sourced here so correlation/stress are
grounded in real market moves when possible.

Resolution order (``source="auto"``):
  1. real Bybit daily closes (credible numbers for judges), else
  2. a frozen on-disk snapshot (demo-safe, offline), else
  3. a deterministic synthetic generator (always works, seeded).

Every result carries ``provenance`` so the UI can label where the numbers came
from — never a fabricated "real". Output shape is ``{token: [closes...]}`` keyed
by token symbol, exactly what ``compute/returns.py`` consumes.
"""
from __future__ import annotations

import json
import os

import numpy as np

from config import BYBIT_API_BASE, BYBIT_SYMBOL_MAP, PRICE_HISTORY_DAYS, STABLES

_SNAPSHOT_PATH = os.path.join(os.path.dirname(__file__), "snapshots", "prices.json")

# Synthetic price profiles: (shared-factor weight, idiosyncratic noise, start).
# A high factor weight makes a token track the shared "market" factor, so tokens
# in the same family (ETH/WETH/stETH) come out correlated on purpose.
_PROFILE: dict[str, tuple[float, float, float]] = {
    "ETH": (1.0, 0.20, 3000.0), "WETH": (1.0, 0.20, 3000.0), "stETH": (0.98, 0.15, 3000.0),
    "BTC": (0.30, 0.80, 60000.0), "WBTC": (0.30, 0.80, 60000.0),
    "SUI": (0.50, 0.60, 1.20), "SOL": (0.60, 0.70, 150.0),
}
_DEFAULT_PROFILE = (0.4, 0.7, 100.0)


def _is_stable(token: str) -> bool:
    return token.upper() in STABLES


# ── synthetic (deterministic) ────────────────────────────────────────────────
def synthetic_price_history(tokens: list[str], n: int = PRICE_HISTORY_DAYS, seed: int = 7) -> dict[str, list[float]]:
    """Correlated random-walk series, seeded so the demo is byte-identical."""
    rng = np.random.default_rng(seed)
    base = np.cumsum(rng.normal(0, 1, n))  # shared market factor

    out: dict[str, list[float]] = {}
    for token in tokens:
        if _is_stable(token):
            out[token] = [1.0] * n
            continue
        factor_w, noise, start = _PROFILE.get(token, _DEFAULT_PROFILE)
        idio = noise * np.cumsum(rng.normal(0, 1, n))
        out[token] = (start * np.exp(0.01 * (factor_w * base + idio))).tolist()
    return out


# ── real (Bybit) ─────────────────────────────────────────────────────────────
def _fetch_closes(symbol: str, days: int) -> list[float]:
    """Daily closes for a Bybit spot symbol, oldest-first."""
    import httpx

    url = BYBIT_API_BASE.rstrip("/") + "/v5/market/kline"
    params = {"category": "spot", "symbol": symbol, "interval": "D", "limit": str(max(2, min(days, 1000)))}
    resp = httpx.get(url, params=params, timeout=10.0)
    resp.raise_for_status()
    body = resp.json()
    if body.get("retCode") not in (0, "0", None):
        raise RuntimeError(f"Bybit retCode={body.get('retCode')} {body.get('retMsg')}")
    rows = ((body.get("result") or {}).get("list")) or []
    closes = []
    for row in reversed(rows):  # API returns newest-first
        try:
            closes.append(float(row[4]))
        except (IndexError, TypeError, ValueError):
            continue
    return closes


def real_price_history(tokens: list[str], days: int = PRICE_HISTORY_DAYS) -> tuple[dict[str, list[float]], list[str]]:
    """Fetch real closes per token. Returns (priceHistory, warnings).

    Stables are pinned flat. A token with no symbol or a failed fetch is omitted
    (the caller fills it from synthetic) rather than fabricated.
    """
    out: dict[str, list[float]] = {}
    warnings: list[str] = []
    for token in tokens:
        if _is_stable(token):
            out[token] = [1.0] * days
            continue
        symbol = BYBIT_SYMBOL_MAP.get(token) or BYBIT_SYMBOL_MAP.get(token.upper())
        if not symbol:
            warnings.append(f"no Bybit symbol mapped for {token}")
            continue
        try:
            closes = _fetch_closes(symbol, days)
        except Exception as exc:  # degrade gracefully
            warnings.append(f"{token} ({symbol}) fetch failed: {exc}")
            continue
        if len(closes) >= 2:
            out[token] = closes
        else:
            warnings.append(f"insufficient history for {symbol}")
    return out, warnings


# ── loader (real → snapshot → synthetic) ─────────────────────────────────────
def load_price_history(
    tokens: list[str],
    days: int = PRICE_HISTORY_DAYS,
    source: str = "auto",
    seed: int = 7,
) -> dict:
    """Return ``{"priceHistory": {token: [...]}, "provenance": {...}}``.

    source: ``auto`` (real → snapshot → synthetic), ``real``, ``snapshot``,
    or ``synthetic``. Any token the real/snapshot source misses is back-filled
    from synthetic so the matrix is never ragged.
    """
    tokens = list(dict.fromkeys(tokens))  # de-dup, preserve order
    syn = synthetic_price_history(tokens, days, seed)

    if source == "synthetic":
        return {"priceHistory": syn, "provenance": _prov("synthetic", "seeded random walk", [])}

    if source == "snapshot":
        snap, warn = _read_snapshot(tokens)
        if snap:
            return {"priceHistory": _backfill(snap, syn, tokens), "provenance": _prov("snapshot", _SNAPSHOT_PATH, warn)}
        return {"priceHistory": syn, "provenance": _prov("synthetic", "snapshot missing → seeded walk", warn)}

    # Stablecoins always "succeed" (flat 1.0), so only NON-stable tokens count
    # when deciding whether we actually got real market data.
    risky = [t for t in tokens if not _is_stable(t)]

    if source == "real":
        real, warn = real_price_history(tokens, days)
        got = [t for t in risky if t in real]
        label = "real" if got and len(got) == len(risky) else ("mixed" if got else "synthetic")
        merged = _backfill(real, syn, tokens) if real else syn
        return {"priceHistory": merged, "provenance": _prov(label, "Bybit v5 market/kline", warn)}

    # auto: real → snapshot → synthetic
    real, warn = real_price_history(tokens, days)
    got = [t for t in risky if t in real]
    if got and len(got) == len(risky):
        return {"priceHistory": _backfill(real, syn, tokens), "provenance": _prov("real", "Bybit v5 market/kline", warn)}
    snap, swarn = _read_snapshot(tokens)
    if got:  # partial real — fill the gaps from snapshot then synthetic
        merged = _backfill(real, {**syn, **snap}, tokens)
        return {"priceHistory": merged, "provenance": _prov("mixed", "Bybit + fallback", warn + swarn)}
    if snap and all(t in snap for t in risky):
        return {"priceHistory": _backfill(snap, syn, tokens), "provenance": _prov("snapshot", _SNAPSHOT_PATH, warn + swarn)}
    return {"priceHistory": syn, "provenance": _prov("synthetic", "Bybit unreachable → seeded walk", warn)}


def resolve_price_history(positions: list[dict], price_history: dict | None) -> tuple[dict[str, list[float]], dict]:
    """Prefer the caller's priceHistory; only fetch when it's absent/empty.

    BE Agent (Scout) normally supplies real Pyth closes — we use them as-is. When
    nothing usable is provided, we derive the token set from ``positions`` and fall
    back to ``load_price_history`` (Bybit → snapshot → synthetic). Returns
    ``(priceHistory, provenance)``.
    """
    if price_history and any(len(v) >= 2 for v in price_history.values()):
        return price_history, _prov("provided", "caller priceHistory (e.g. Scout/Pyth)", [])

    tokens: list[str] = []
    for p in positions or []:
        # primary = canonical `token` if present (else raw tokenX), plus the quote
        # leg. Avoid adding BOTH token and tokenX or ETH-family wrappers (WETH/stETH)
        # would show up as separate, unpriced assets.
        for t in (p.get("token") or p.get("tokenX"), p.get("tokenY")):
            if t and t not in tokens:
                tokens.append(t)
    if not tokens:
        return {}, _prov("synthetic", "no positions/tokens to price", [])

    out = load_price_history(tokens, source="auto")
    return out["priceHistory"], out["provenance"]


def _backfill(primary: dict, fallback: dict, tokens: list[str]) -> dict[str, list[float]]:
    return {t: primary.get(t) or fallback[t] for t in tokens}


def _prov(label: str, source: str, warnings: list[str]) -> dict:
    return {"label": label, "source": source, "degraded": label not in ("real", "snapshot"), "warnings": warnings}


# ── snapshot (offline demo cache) ────────────────────────────────────────────
def _read_snapshot(tokens: list[str]) -> tuple[dict[str, list[float]], list[str]]:
    if not os.path.exists(_SNAPSHOT_PATH):
        return {}, []
    try:
        with open(_SNAPSHOT_PATH) as fh:
            data = json.load(fh)
    except (OSError, json.JSONDecodeError) as exc:
        return {}, [f"snapshot unreadable: {exc}"]
    ph = data.get("priceHistory", data)
    return {t: ph[t] for t in tokens if t in ph}, []


def write_snapshot(tokens: list[str], days: int = PRICE_HISTORY_DAYS) -> dict:
    """Fetch real closes once and freeze them to disk for offline demos."""
    real, warn = real_price_history(tokens, days)
    if not real:
        raise RuntimeError(f"refusing to write empty snapshot; warnings={warn}")
    os.makedirs(os.path.dirname(_SNAPSHOT_PATH), exist_ok=True)
    payload = {"source": "Bybit v5 market/kline", "days": days, "priceHistory": real, "warnings": warn}
    with open(_SNAPSHOT_PATH, "w") as fh:
        json.dump(payload, fh, indent=2)
    return {"path": _SNAPSHOT_PATH, "tokens": list(real.keys()), "warnings": warn}


if __name__ == "__main__":  # python -m data.prices  → write a snapshot from real Bybit
    import sys

    toks = sys.argv[1:] or ["ETH", "BTC", "SUI"]
    print(write_snapshot(toks))
