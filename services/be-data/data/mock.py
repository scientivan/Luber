"""Mock data generator — Day-0 deliverable so every role can work on mocks.

Produces the canonical demo-1 wallet: 5 positions, secretly one 87% ETH bet.
"""
from __future__ import annotations

import numpy as np


def demo_positions() -> list[dict]:
    return [
        {"poolId": "0xdemo1", "protocol": "cetus", "pair": "ETH-USDC", "token": "ETH", "tokenX": "ETH", "tokenY": "USDC", "valueUSD": 3800, "inRange": True},
        {"poolId": "0xdemo2", "protocol": "cetus", "pair": "ETH-USDT", "token": "ETH", "tokenX": "ETH", "tokenY": "USDT", "valueUSD": 2600, "inRange": True},
        {"poolId": "0xdemo3", "protocol": "turbos", "pair": "WETH-SUI", "token": "ETH", "tokenX": "ETH", "tokenY": "SUI", "valueUSD": 2300, "inRange": False, "daysOutOfRange": 14},
        {"poolId": "0xdemo4", "protocol": "cetus", "pair": "stETH-ETH", "token": "ETH", "tokenX": "ETH", "tokenY": "ETH", "valueUSD": 1500, "inRange": True},
        {"poolId": "0xdemo5", "protocol": "cetus", "pair": "BTC-USDC", "token": "BTC", "tokenX": "BTC", "tokenY": "USDC", "valueUSD": 50, "inRange": True},
    ]


def demo_price_history(n: int = 120, seed: int = 7) -> dict[str, list[float]]:
    """Correlated ETH-family series + a less-correlated BTC + stable USDC/USDT/SUI."""
    rng = np.random.default_rng(seed)
    base = np.cumsum(rng.normal(0, 1, n))  # shared ETH factor

    def walk(factor_w, noise, start):
        series = start * np.exp(0.01 * (factor_w * base + noise * np.cumsum(rng.normal(0, 1, n))))
        return series.tolist()

    return {
        "ETH": walk(1.0, 0.2, 3000),
        "BTC": walk(0.3, 0.8, 60000),
        "SUI": walk(0.5, 0.6, 1.2),
        "USDC": [1.0] * n,
        "USDT": [1.0] * n,
    }
