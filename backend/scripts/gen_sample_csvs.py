"""
One-off generator for the three bundled sample BMS CSVs shipped under
bms-portal/public/. Not part of the running app - just how the fixtures
were produced, kept here so they can be regenerated/tweaked later.

Column convention matches what DataIngestion.jsx documents and what
backend/routers/telemetry.py's CSV-import column-sniffing expects:
  Timestamp, Pack_Voltage, Pack_Current, SOC, SOH,
  Cell<N>_Voltage (V), Cell<N>_Temp (C)
Current sign convention: positive = charging, negative = discharging
(matches DeviceRealtime.jsx's "Mode: Charging/Discharging" display).
"""
import csv
import datetime
import math
import os
import random

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "bms-portal", "public")
CELL_COUNT = 16


def ocv_from_soc(soc):
    # Same 4-point piecewise-linear Li-ion approximation as backend/simulator.py
    curve = [(0, 3.00), (20, 3.50), (80, 3.90), (100, 4.15)]
    for (s0, v0), (s1, v1) in zip(curve, curve[1:]):
        if s0 <= soc <= s1:
            t = (soc - s0) / (s1 - s0)
            return v0 + t * (v1 - v0)
    return curve[-1][1] if soc >= 100 else curve[0][1]


def write_csv(path, fieldnames, rows):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            w.writerow(r)
    print(f"wrote {path} ({len(rows)} rows)")


def gen_ev_pack(filename, anomaly=False):
    """~300 rows, 1-min cadence, ~2.5h discharge (drive) then ~2.5h charge."""
    rng = random.Random(42 if not anomaly else 43)
    t0 = datetime.datetime(2026, 6, 1, 8, 0, 0)
    rows = []
    soc = 92.0
    weak_cell = 7 if anomaly else None
    # Anomaly dataset runs the discharge phase down further and only
    # partially recharges (backend alerting - see check_telemetry_thresholds
    # in ingestion.py - only evaluates a CSV import's *most recent* row,
    # same as a live device's current state; a dataset that fully recharges
    # by its last row would show no low-SOC condition "right now" even
    # though it dipped low mid-drive). Ending below the 15% threshold makes
    # a real low_soc Alert row genuinely demonstrable end to end, not just a
    # client-side chart annotation.
    soc_floor = 8.0 if anomaly else 18.0
    soc_charge_cap = 13.0 if anomaly else 97.0
    fieldnames = (
        ["Timestamp", "Pack_Voltage", "Pack_Current", "SOC", "SOH"]
        + [f"Cell{i}_Voltage" for i in range(1, CELL_COUNT + 1)]
        + [f"Cell{i}_Temp" for i in range(1, CELL_COUNT + 1)]
    )
    n_minutes = 300
    for m in range(n_minutes):
        ts = t0 + datetime.timedelta(minutes=m)
        discharging = m < 150
        # Current profile: noisy drive-cycle discharge, then a steady charge taper.
        if discharging:
            current = -(40 + 25 * abs(math.sin(m / 12)) + rng.uniform(-4, 4))
            soc = max(soc_floor, soc - 0.5 - rng.uniform(0, 0.15))
        else:
            current = 22 * (1 - (soc / 100) * 0.4) + rng.uniform(-1.5, 1.5)
            soc = min(soc_charge_cap, soc + 0.55 + rng.uniform(0, 0.1))

        ocv_cell = ocv_from_soc(soc)
        pack_voltage = ocv_cell * CELL_COUNT - current * 0.02 + rng.gauss(0, 0.3)
        ambient = 24.0
        joule_heat = 0.0009 * current * current

        row = {
            "Timestamp": ts.isoformat(),
            "Pack_Voltage": round(pack_voltage, 2),
            "Pack_Current": round(current, 2),
            "SOC": round(soc, 1),
            "SOH": round(98.6 - (0.6 if anomaly else 0.0), 1),
        }

        thermal_event = anomaly and 150 <= m <= 175

        for i in range(1, CELL_COUNT + 1):
            bias = rng.uniform(-0.004, 0.004)
            if anomaly and i == weak_cell:
                bias -= 0.16  # persistently weak/imbalanced cell (~160mV low)
            cell_v = ocv_cell + bias + rng.uniform(-0.002, 0.002)
            row[f"Cell{i}_Voltage"] = round(cell_v, 3)

            cell_t = ambient + joule_heat + rng.uniform(-0.6, 0.6)
            if anomaly and i == weak_cell and thermal_event:
                # Thermal runaway-adjacent event on the weak cell only.
                progress = (m - 150) / 25
                cell_t += 22 * math.sin(min(1.0, progress) * math.pi)
            row[f"Cell{i}_Temp"] = round(cell_t, 1)

        rows.append(row)

    write_csv(os.path.join(OUT_DIR, filename), fieldnames, rows)


def gen_lab_cycling(filename, n_cycles=60):
    """One row per cycle (end-of-discharge snapshot) showing real capacity fade."""
    rng = random.Random(7)
    t0 = datetime.datetime(2026, 1, 1, 0, 0, 0)
    rated_capacity_ah = 50.0
    fade_per_cycle_pct = 0.22  # -> ~13% fade by cycle 60, realistic Li-ion aging
    fieldnames = (
        ["Timestamp", "Cycle_Number", "Pack_Voltage", "Pack_Current", "SOC", "SOH", "Capacity_Ah"]
        + [f"Cell{i}_Voltage" for i in range(1, CELL_COUNT + 1)]
        + [f"Cell{i}_Temp" for i in range(1, CELL_COUNT + 1)]
    )
    rows = []
    for cyc in range(1, n_cycles + 1):
        ts = t0 + datetime.timedelta(hours=6 * cyc)  # ~1 cycle per 6h test-bench slot
        soh = max(0, 100 - fade_per_cycle_pct * cyc + rng.uniform(-0.3, 0.3))
        capacity = rated_capacity_ah * (soh / 100)
        soc_end_of_discharge = 18 + rng.uniform(-1, 1)
        ocv_cell = ocv_from_soc(soc_end_of_discharge)
        current = -(48 + rng.uniform(-2, 2))
        pack_voltage = ocv_cell * CELL_COUNT - current * 0.02

        # Cell-to-cell spread widens slowly as the pack ages - realistic aging behavior.
        spread = 0.01 + 0.0025 * cyc

        row = {
            "Timestamp": ts.isoformat(),
            "Cycle_Number": cyc,
            "Pack_Voltage": round(pack_voltage, 2),
            "Pack_Current": round(current, 2),
            "SOC": round(soc_end_of_discharge, 1),
            "SOH": round(soh, 2),
            "Capacity_Ah": round(capacity, 2),
        }
        for i in range(1, CELL_COUNT + 1):
            cell_v = ocv_cell + rng.uniform(-spread / 2, spread / 2)
            row[f"Cell{i}_Voltage"] = round(cell_v, 3)
            row[f"Cell{i}_Temp"] = round(26 + rng.uniform(-1.5, 3.5), 1)
        rows.append(row)

    write_csv(os.path.join(OUT_DIR, filename), fieldnames, rows)


if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    gen_ev_pack("sample_ev_pack_healthy.csv", anomaly=False)
    gen_ev_pack("sample_ev_pack_anomaly.csv", anomaly=True)
    gen_lab_cycling("sample_lab_cycling_degradation.csv")
