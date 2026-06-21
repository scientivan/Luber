"""Configuration for the BE Data compute service."""
import os

PORT = int(os.getenv("PORT", "8000"))

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
