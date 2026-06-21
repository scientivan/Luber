"""Configuration for the BE Data compute service."""
import json
import os

PORT = int(os.getenv("PORT", "8000"))

# ── price history (priceHistory) source ──────────────────────────────────────
# Bybit public market data (no API key needed) is the real source for
# correlation/stress. Tokens map to a spot symbol; stablecoins are held flat.
BYBIT_API_BASE = os.getenv("BYBIT_API_BASE", "https://api.bybit.com")
PRICE_HISTORY_DAYS = int(os.getenv("PRICE_HISTORY_DAYS", "120"))

# token symbol → Bybit spot symbol. Overridable via BYBIT_SYMBOL_MAP (JSON).
_DEFAULT_SYMBOL_MAP = {
    "ETH": "ETHUSDT", "WETH": "ETHUSDT", "stETH": "ETHUSDT",
    "BTC": "BTCUSDT", "WBTC": "BTCUSDT",
    "SUI": "SUIUSDT", "SOL": "SOLUSDT",
}
try:
    BYBIT_SYMBOL_MAP = {**_DEFAULT_SYMBOL_MAP, **json.loads(os.getenv("BYBIT_SYMBOL_MAP", "{}"))}
except (json.JSONDecodeError, TypeError):
    BYBIT_SYMBOL_MAP = dict(_DEFAULT_SYMBOL_MAP)

# Tokens pinned to 1.0 (no price risk) — excluded from real fetches.
STABLES = {s.strip().upper() for s in os.getenv("STABLES", "USDC,USDT,DAI,USDY,BUCK").split(",") if s.strip()}

# RASA single-token exposure caps by risk tolerance.
RASA_MAX_EXPOSURE = {
    "low": float(os.getenv("RASA_MAX_EXPOSURE_LOW", "0.30")),
    "med": float(os.getenv("RASA_MAX_EXPOSURE_MED", "0.40")),
    "high": float(os.getenv("RASA_MAX_EXPOSURE_HIGH", "0.50")),
}

# A position whose value is below this is treated as dust (gas > value).
DUST_THRESHOLD_USD = float(os.getenv("DUST_THRESHOLD_USD", "20"))

# Correlation coefficient above which two assets are considered "one bet".
CLUSTER_CORR_THRESHOLD = float(os.getenv("CLUSTER_CORR_THRESHOLD", "0.7"))
