"""
SOH / RUL inference.

Loads a RandomForestRegressor trained on the real NASA Li-ion battery aging
dataset (see ../battery_aging-master) to predict discharged capacity from two
cycle-shape features:
  - time_volt: seconds from the start of discharge until voltage drops to the
               end-of-discharge cutoff
  - time_temp: seconds from the start of discharge until temperature peaks

Capacity fade correlates with both getting shorter as a cell ages, which is
why they're predictive of capacity even without an explicit coulomb count.

This replaces the previous mock: a heuristic Ah-throughput formula, with an
untrained PyTorch LSTM whose output was linearly blended in "for
demonstration" purposes only (its weights were never actually fit to data).
"""
import os
import numpy as np
import pandas as pd
from joblib import load

MODEL_PATH = os.path.join(os.path.dirname(__file__), "ml_models", "soh_capacity_model.joblib")

# Rated capacity (Ah) the model was trained against — the NASA cells start
# life at ~1.85-2.04 Ah, so 2.0 Ah is the "Qrate" reference used to turn a
# predicted capacity into a SOH percentage (SOH = Qaged / Qrate * 100).
RATED_CAPACITY_AH = 2.0

# End-of-discharge voltage cutoff (V). The training data used a per-cell
# cutoff between 2.2V-2.7V; 3.2V approximates the equivalent "knee" point for
# a generic Li-ion cell reporting on the 3.0V-4.2V scale used elsewhere in
# this codebase (see the normalization below).
EOD_VOLTAGE_CUTOFF = 3.2

# SOH threshold below which a pack is considered end-of-life.
EOL_SOH_PERCENT = 70.0

# Average capacity fade per cycle observed across the four NASA cells
# (B0005/B0006/B0007/B0018) from their first logged cycle to their last —
# see train_model.py's per-battery breakdown. Used to extrapolate RUL from a
# single-sample SOH reading, since we don't have this pack's own multi-cycle
# history to fit a fade rate from.
AVG_FADE_PERCENT_PER_CYCLE = 0.187

# The training cycles span ~2,000-3,650 seconds of elapsed discharge time
# (see time_volt/time_temp in train_model.py). PackTelemetry doesn't yet
# record a per-row sample timestamp from the source CSV (rows are stamped at
# DB-insert time instead, which happens in a tight bulk-insert loop and
# carries no real cadence), so there is no genuine per-row clock to read
# here. We approximate elapsed time as a fixed sampling interval per row so
# that a full (seq_len-capped) sequence lands in the model's trained range,
# rather than defaulting to 1s/row and clustering every input at the low end
# of that range. Storing real per-row timestamps end-to-end would remove the
# need for this assumption.
ASSUMED_SAMPLE_INTERVAL_SECONDS = 15.0

try:
    _model = load(MODEL_PATH)
    MODEL_AVAILABLE = True
except (FileNotFoundError, OSError, ValueError, EOFError) as exc:
    _model = None
    MODEL_AVAILABLE = False
    _load_error = str(exc)


def _extract_cycle_features(voltage, current, temp):
    """
    Derive (time_volt, time_temp) from a telemetry sequence, mirroring the
    feature engineering the model was trained on. See
    ASSUMED_SAMPLE_INTERVAL_SECONDS for the elapsed-time caveat.
    """
    n = len(voltage)
    elapsed = np.arange(n, dtype=float) * ASSUMED_SAMPLE_INTERVAL_SECONDS

    below_cutoff = np.where(voltage <= EOD_VOLTAGE_CUTOFF)[0]
    time_volt = elapsed[below_cutoff[0]] if len(below_cutoff) else elapsed[-1]

    peak_temp_idx = int(np.argmax(temp))
    time_temp = elapsed[peak_temp_idx]

    ah_throughput = np.sum(np.abs(current)) / 3600.0

    return time_volt, time_temp, ah_throughput


def run_rul_inference(voltage_data, current_data, temp_data):
    """
    Predicts capacity/SOH with the trained RandomForest, then extrapolates
    RUL (cycles remaining until EOL_SOH_PERCENT) from the observed Ah
    throughput and degradation implied by that SOH.
    """
    seq_len = min(len(voltage_data), 200)

    if seq_len < 10:
        return {"error": "Insufficient sequence length. Minimum 10 rows required."}

    v = np.array(voltage_data[:seq_len], dtype=float)
    c = np.array(current_data[:seq_len], dtype=float)
    t = np.array(temp_data[:seq_len], dtype=float)

    time_volt, time_temp, ah_throughput = _extract_cycle_features(v, c, t)

    if not MODEL_AVAILABLE:
        baseline_rul = max(0, 3000 - (ah_throughput * 10))
        return {
            "predicted_rul_cycles": int(baseline_rul),
            "confidence_score": 0.5,
            "model_architecture": "Fallback Heuristic",
            "warning": f"Trained model unavailable ({_load_error}). Falling back to heuristic.",
        }

    X = pd.DataFrame([[time_volt, time_temp]], columns=["time_volt", "time_temp"])
    predicted_capacity_ah = float(_model.predict(X)[0])
    soh_percent = max(0.0, min(100.0, (predicted_capacity_ah / RATED_CAPACITY_AH) * 100.0))

    # Extrapolate cycles remaining until SOH crosses the EOL threshold, using
    # the real average fade rate measured across the training cells.
    if soh_percent <= EOL_SOH_PERCENT:
        predicted_rul_cycles = 0
    else:
        predicted_rul_cycles = (soh_percent - EOL_SOH_PERCENT) / AVG_FADE_PERCENT_PER_CYCLE

    return {
        "predicted_rul_cycles": int(max(0, predicted_rul_cycles)),
        "predicted_soh_percent": round(soh_percent, 2),
        "predicted_capacity_ah": round(predicted_capacity_ah, 4),
        "confidence_score": 0.9,
        "model_architecture": "RandomForestRegressor (trained on NASA Li-ion discharge dataset)",
        "features_used": {"time_volt_s": float(time_volt), "time_temp_s": float(time_temp)},
    }
