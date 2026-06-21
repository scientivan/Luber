"""Mock fixtures — Day-0 deliverable so every role can work against mocks.

Three canonical demo wallets (mirroring the 3 testnet wallets the team sets up).
``positions`` stay fixtures here by design: BE Data is pure-compute and never
reads the chain — real positions arrive from the BE Agent (Scout) at integration.
Only ``priceHistory`` can be real (see ``data/prices.py``); here it defaults to
the deterministic synthetic generator so fixtures are byte-stable for tests/demo.

The numbers each wallet actually produces are printed by ``scripts/demo_numbers.py``
— that script, not this file, is the single source of truth for the pitch deck.
"""
from __future__ import annotations

from data.prices import synthetic_price_history

# ── demo-1: amber, 5 positions, looks diversified but is secretly one ETH bet ──
def _demo1() -> list[dict]:
    return [
        {"poolId": "0xd1a", "protocol": "cetus", "pair": "ETH-USDC", "token": "ETH", "tokenX": "ETH", "tokenY": "USDC", "valueUSD": 3800, "inRange": True},
        {"poolId": "0xd1b", "protocol": "cetus", "pair": "ETH-USDT", "token": "ETH", "tokenX": "ETH", "tokenY": "USDT", "valueUSD": 2600, "inRange": True},
        {"poolId": "0xd1c", "protocol": "turbos", "pair": "WETH-SUI", "token": "ETH", "tokenX": "ETH", "tokenY": "SUI", "valueUSD": 1500, "inRange": False, "daysOutOfRange": 14},
        {"poolId": "0xd1d", "protocol": "cetus", "pair": "stETH-ETH", "token": "ETH", "tokenX": "ETH", "tokenY": "ETH", "valueUSD": 800, "inRange": True},
        {"poolId": "0xd1e", "protocol": "cetus", "pair": "BTC-USDC", "token": "BTC", "tokenX": "BTC", "tokenY": "USDC", "valueUSD": 1300, "inRange": True},
    ]  # ETH family = 8700 / 10000 = 87% cluster


# ── demo-2: red, 8 positions, dust traps + a heavy correlated cluster ─────────
def _demo2() -> list[dict]:
    return [
        {"poolId": "0xd2a", "protocol": "cetus", "pair": "ETH-USDC", "token": "ETH", "tokenX": "ETH", "tokenY": "USDC", "valueUSD": 4200, "inRange": True},
        {"poolId": "0xd2b", "protocol": "cetus", "pair": "WETH-USDT", "token": "ETH", "tokenX": "ETH", "tokenY": "USDT", "valueUSD": 3100, "inRange": False, "daysOutOfRange": 21},
        {"poolId": "0xd2c", "protocol": "turbos", "pair": "stETH-ETH", "token": "ETH", "tokenX": "ETH", "tokenY": "ETH", "valueUSD": 2400, "inRange": True},
        {"poolId": "0xd2d", "protocol": "cetus", "pair": "WETH-SUI", "token": "ETH", "tokenX": "ETH", "tokenY": "SUI", "valueUSD": 1800, "inRange": False, "daysOutOfRange": 9},
        {"poolId": "0xd2e", "protocol": "cetus", "pair": "SUI-USDC", "token": "SUI", "tokenX": "SUI", "tokenY": "USDC", "valueUSD": 600, "inRange": True},
        {"poolId": "0xd2f", "protocol": "cetus", "pair": "ETH-USDC", "token": "ETH", "tokenX": "ETH", "tokenY": "USDC", "valueUSD": 14, "inRange": True},
        {"poolId": "0xd2g", "protocol": "turbos", "pair": "WETH-USDT", "token": "ETH", "tokenX": "ETH", "tokenY": "USDT", "valueUSD": 9, "inRange": True},
        {"poolId": "0xd2h", "protocol": "cetus", "pair": "BTC-USDC", "token": "BTC", "tokenX": "BTC", "tokenY": "USDC", "valueUSD": 6, "inRange": True},
    ]  # heavy ETH cluster + 3 dust (<$20) + 2 out-of-range → red


# ── demo-3: green, 3 positions, genuinely diversified ─────────────────────────
def _demo3() -> list[dict]:
    return [
        {"poolId": "0xd3a", "protocol": "cetus", "pair": "ETH-USDC", "token": "ETH", "tokenX": "ETH", "tokenY": "USDC", "valueUSD": 4000, "inRange": True},
        {"poolId": "0xd3b", "protocol": "cetus", "pair": "BTC-USDC", "token": "BTC", "tokenX": "BTC", "tokenY": "USDC", "valueUSD": 3500, "inRange": True},
        {"poolId": "0xd3c", "protocol": "turbos", "pair": "SUI-USDC", "token": "SUI", "tokenX": "SUI", "tokenY": "USDC", "valueUSD": 2500, "inRange": True},
    ]  # no single cluster dominates, no dust, all in range → green


DEMO_WALLETS: dict[str, list[dict]] = {
    "demo-1": _demo1(),
    "demo-2": _demo2(),
    "demo-3": _demo3(),
}


def demo_positions(wallet: str = "demo-1") -> list[dict]:
    """Positions for a demo wallet (default demo-1)."""
    return [dict(p) for p in DEMO_WALLETS[wallet]]


def _tokens_for(positions: list[dict]) -> list[str]:
    toks: list[str] = []
    for p in positions:
        for key in ("token", "tokenX", "tokenY"):
            t = p.get(key)
            if t and t not in toks:
                toks.append(t)
    return toks


def demo_price_history(n: int = 120, seed: int = 7, wallet: str | None = None) -> dict[str, list[float]]:
    """Deterministic synthetic priceHistory covering the demo token universe.

    Pass ``wallet`` to scope tokens to one wallet; default covers all wallets so a
    single price set serves every fixture. Swap for ``data.prices.load_price_history``
    when you want real Bybit data.
    """
    if wallet is not None:
        tokens = _tokens_for(DEMO_WALLETS[wallet])
    else:
        tokens = []
        for positions in DEMO_WALLETS.values():
            for t in _tokens_for(positions):
                if t not in tokens:
                    tokens.append(t)
    return synthetic_price_history(tokens, n, seed)
