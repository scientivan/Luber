"""Price-history → return-series helpers (chain-agnostic, reused from Mantle)."""
from __future__ import annotations

import numpy as np


def to_return_matrix(price_history: dict[str, list[float]]) -> tuple[list[str], np.ndarray]:
    """Convert {token: [prices...]} into (tokens, returns matrix [T-1, N]).

    Aligns to the shortest series so all tokens share the same time axis.
    """
    tokens = list(price_history.keys())
    if not tokens:
        return [], np.empty((0, 0))

    min_len = min(len(price_history[t]) for t in tokens)
    if min_len < 2:
        return tokens, np.empty((0, len(tokens)))

    prices = np.array([price_history[t][-min_len:] for t in tokens], dtype=float)  # [N, T]
    # simple returns r_t = p_t / p_{t-1} - 1
    rets = prices[:, 1:] / prices[:, :-1] - 1.0  # [N, T-1]
    return tokens, rets.T  # [T-1, N]
