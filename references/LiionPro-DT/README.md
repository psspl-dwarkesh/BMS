# LiionPro-DT-Lithium-Ion-Prognostics-Digital-Twin-Dataset-5-Year-EV-Pack-Simulation-
LiionPro-DT is a high-fidelity synthetic lithium-ion battery digital twin dataset simulating five years of 1-minute resolution telemetry. It integrates physics-informed degradation, temperature-accelerated aging, and dynamic voltage modeling to support research in predictive maintenance, state-of-health estimation, remaining useful life prediction,

---
Simulates 5 years of 1-minute resolution battery telemetry for academic research.

Features:
- Electrochemical degradation model (calendar + cycle + thermal aging)
- Realistic State of Charge (SoC) and State of Health (SoH) evolution
- Fault flags for over-voltage, under-voltage, and over-temperature
- Rolling statistics and gradient features for ML/anomaly detection
- Normalized Remaining Useful Life (RUL) target variable

Typical Use Cases:
- Battery Management System (BMS) modelling
- Predictive maintenance & RUL estimation
- Anomaly / fault detection
- Time-series classification and regression benchmarks

Output CSV columns (26 total):
  timestamp, ambient_temp_C, battery_temp_C, current_A, voltage_V,
  soc_%, soh_%, capacity_Ah, internal_resistance_ohm, cycle_count,
  calendar_aging_%, cycle_aging_%, temperature_stress_%, RUL_normalized,
  over_voltage_flag, under_voltage_flag, over_temperature_flag,
  voltage_roll_mean, voltage_roll_std, current_roll_mean, current_roll_std,
  temp_roll_mean, temp_roll_std, dV_dt, dT_dt, dSoC_dt,
  power_W, energy_Wh_cumulative

Author : (Darshan Kumar Govindaraju)
License: MIT
"""
##  Table of Contents

- [Overview](#overview)
- [Dataset Description](#dataset-description)
- [Column Reference](#column-reference)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration Parameters](#configuration-parameters)
- [Simulation Models](#simulation-models)
- [Suggested Research Tasks](#suggested-research-tasks)
- [Limitations & Assumptions](#limitations--assumptions)
- [License](#license)
- [Citation](#citation)

---

## Overview

This repository provides a Python script that generates a realistic synthetic dataset modelling the degradation of a lithium-ion battery cell over its operational lifetime. The simulation covers:

- Electrochemical voltage behaviour (Thevenin equivalent circuit)
- Realistic State of Charge (SoC) evolution via Coulomb counting
- Multi-factor degradation: calendar aging, cycle aging, and thermal stress
- Fault detection flags (over-voltage, under-voltage, over-temperature)
- Rolling statistics and gradient features ready for ML pipelines

The output is a single `.csv` file with **~2.6 million rows** and **26 columns**.

---

## Dataset Description

| Property | Value |
|---|---|
| Duration | 5 years |
| Sampling rate | 1 minute |
| Approximate rows | 2,628,001 |
| Columns | 26 |
| File size (approx.) | ~500 MB |
| Format | CSV |

> **Note:** Due to GitHub's file size limit, the dataset CSV may be hosted on a separate platform
>https://www.kaggle.com/datasets/darshangovindaraju/liionpro-dt-lithium-ion-battery
> 

---

## Column Reference

### Raw Measurements

| Column | Unit | Description |
|---|---|---|
| `timestamp` | datetime | UTC timestamp at 1-minute intervals |
| `ambient_temp_C` | °C | Seasonal sinusoidal ambient temperature with noise |
| `battery_temp_C` | °C | Cell surface temperature (ambient + Joule heating) |
| `current_A` | A | Load current (positive = discharge, negative = charge) |
| `voltage_V` | V | Terminal voltage (OCV minus resistive drop) |
| `soc_%` | % | State of Charge (0–100%) via Coulomb counting |

### Health & Degradation

| Column | Unit | Description |
|---|---|---|
| `soh_%` | % | State of Health (100% = new, 70% = end-of-life) |
| `capacity_Ah` | Ah | Present usable capacity |
| `internal_resistance_ohm` | Ω | Internal resistance (grows linearly with aging) |
| `cycle_count` | cycles | Cumulative full-equivalent cycle count (Ah-throughput method) |
| `calendar_aging_%` | % | SoH loss due to time-based aging |
| `cycle_aging_%` | % | SoH loss due to cycling |
| `temperature_stress_%` | % | SoH loss due to thermal stress above 35 °C |
| `RUL_normalized` | [0, 1] | Remaining Useful Life (1.0 = new, 0.0 = end-of-life) |

### Fault Flags

| Column | Values | Description |
|---|---|---|
| `over_voltage_flag` | 0 / 1 | 1 if voltage > 4.25 V |
| `under_voltage_flag` | 0 / 1 | 1 if voltage < 2.80 V |
| `over_temperature_flag` | 0 / 1 | 1 if battery temp > 60 °C |

### Engineered Features (ML-ready)

| Column | Description |
|---|---|
| `voltage_roll_mean` | 60-sample rolling mean of voltage |
| `voltage_roll_std` | 60-sample rolling std of voltage |
| `current_roll_mean` | 60-sample rolling mean of current |
| `current_roll_std` | 60-sample rolling std of current |
| `temp_roll_mean` | 60-sample rolling mean of battery temperature |
| `temp_roll_std` | 60-sample rolling std of battery temperature |
| `dV_dt` | First-order voltage gradient (V/min) |
| `dT_dt` | First-order temperature gradient (°C/min) |
| `dSoC_dt` | First-order SoC gradient (%/min) |
| `power_W` | Instantaneous power (W = V × I) |
| `energy_Wh_cumulative` | Cumulative energy throughput (Wh) |

---

## Installation

**Requirements:** Python 3.8+

```bash
# Clone the repository
git clone https://github.com/darshankumargovindaraju/LiionPro-DT-Lithium-Ion-Prognostics-Digital-Twin-Dataset-5-Year-EV-Pack-Simulation-.git
cd LiionPro-DT-Lithium-Ion-Prognostics-Digital-Twin-Dataset-5-Year-EV-Pack-Simulation-

# Install dependencies
pip install numpy pandas
```

---

## Usage

### Generate the default dataset (5 years, 1-min resolution)

```bash
python generate_lithium_dataset.py
```

### Use as a module in your own script or notebook

```python
from generate_lithium_dataset import generate_advanced_lithium_dataset

# Default 5-year dataset
df = generate_advanced_lithium_dataset()

# Custom configuration
df = generate_advanced_lithium_dataset(
    filename="my_battery_data.csv",
    years=3,
    freq="1min",
    rolling_window=30,
    nominal_capacity_ah=3.0,
    eol_soh=75.0,
    calendar_aging_rate=8.0,
    random_seed=0,
)

print(df.head())
print(df.dtypes)
```

### Use without saving to disk (e.g., in a Jupyter notebook)

```python
df = generate_advanced_lithium_dataset(filename=None, verbose=True)
# df is a pandas DataFrame — use directly
```

---

## Configuration Parameters

| Parameter | Default | Description |
|---|---|---|
| `filename` | `"advanced_lithium_5yr_dataset.csv"` | Output file path. `None` to skip saving. |
| `years` | `5` | Simulation duration in years |
| `freq` | `"1min"` | Pandas time frequency string |
| `rolling_window` | `60` | Window size (samples) for rolling features |
| `nominal_capacity_ah` | `2.5` | Rated cell capacity (Ah) |
| `nominal_voltage` | `3.7` | Nominal cell voltage (V) |
| `max_voltage` | `4.2` | Upper cut-off voltage (V) |
| `min_voltage` | `3.0` | Lower cut-off voltage (V) |
| `eol_soh` | `70.0` | End-of-life SoH threshold (%) |
| `calendar_aging_rate` | `10.0` | Total % SoH lost to calendar aging over simulation |
| `cycle_aging_factor` | `0.02` | % SoH lost per full equivalent cycle |
| `temp_stress_threshold_c` | `35.0` | Temperature (°C) above which thermal aging begins |
| `temp_stress_factor` | `0.05` | Degradation coefficient per °C above threshold |
| `random_seed` | `42` | NumPy random seed (set for reproducibility) |
| `verbose` | `True` | Print progress and summary statistics |

---

## Simulation Models

### State of Charge — Coulomb Counting
```
ΔSoC = −I · Δt / C_nominal × 100
```
SoC is clipped to [0, 100]% at every step.

### Voltage — Simplified Thevenin Equivalent
```
OCV  = V_min + (SoC / 100) × (V_max − V_min)
V    = OCV − I × R_internal + ε
```

### Temperature — Joule Heating Model
```
T_battery = T_ambient + I² · R_internal · gain + ε
```

### State of Health — Multi-Factor Degradation
```
SoH = 100 − (CalendarAging + CycleAging + ThermalStress)
```

| Component | Formula |
|---|---|
| Calendar aging | Linear decline over simulation period |
| Cycle aging | `cycle_count × cycle_aging_factor` |
| Thermal stress | `max(T − T_threshold, 0) × temp_stress_factor` |

### Remaining Useful Life (Normalised)
```
RUL = (SoH − SoH_EoL) / (100 − SoH_EoL),  clipped to [0, 1]
```

---

## Suggested Research Tasks

This dataset is suitable for the following academic experiments:

| Task | Target Column(s) | Suggested Methods |
|---|---|---|
| **RUL Estimation** | `RUL_normalized` | LSTM, Transformer, XGBoost |
| **SoH Regression** | `soh_%` | Random Forest, SVR, MLP |
| **SoC Estimation** | `soc_%` | Kalman Filter, GRU, TCN |
| **Fault Detection** | `*_flag` columns | Isolation Forest, Autoencoder |
| **Anomaly Detection** | `dV_dt`, `dT_dt` | One-Class SVM, VAE |
| **Cycle Counting** | `cycle_count` | Signal processing, peak detection |
| **Capacity Fade Modelling** | `capacity_Ah` | Physics-informed NN |

---

## Limitations & Assumptions

- The simulation uses a **simplified electrochemical model**; it does not replicate full DFN (Doyle-Fuller-Newman) or P2D physics.
- Internal resistance growth is **linear** — real cells exhibit non-linear ageing patterns.
- The load profile is **Gaussian random noise** — for specific application profiles (EV drive cycles, grid storage), substitute a realistic load trace.
- No **capacity regeneration** or rest-phase relaxation is modelled.
- Results are intended for **ML benchmarking**, not certification or regulatory use.

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## Citation

If you use this dataset or code in your academic work, please cite:

```bibtex
@misc{lithium_battery_dataset_2024,
  author    = {Darshan Kumar Govindaraju},
  title     = LiionPro-DT-Lithium-Ion-Prognostics-Digital-Twin-Dataset-5-Year-EV-Pack-Simulation},
  year      = {2026},
  publisher = {GitHub},
  url       = {[https://github.com/<your-username>/<repo-name>](https://github.com/darshankumargovindaraju/LiionPro-DT-Lithium-Ion-Prognostics-Digital-Twin-Dataset-5-Year-EV-Pack-Simulation-)}
}
```

---

## Contributing

Pull requests and issues are welcome. If you extend the simulation (e.g., add drive-cycle profiles, temperature chambers, or multi-cell pack modelling), please open a PR with a description of the changes.

---

*Generated with Python · NumPy · Pandas*
