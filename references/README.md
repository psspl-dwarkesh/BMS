# Reference Projects

External, third-party repositories and datasets kept for research and reference while building
the BMS Battery Analytics platform (`backend/`, `bms-portal/`). Nothing in this folder is part of
the shipped application — treat it as read-only prior art, not a dependency.

| Folder | What it is | Why it's here |
| --- | --- | --- |
| [`BatteryML/`](BatteryML/README.md) | Open-source ML toolkit for battery degradation (BatteryML team) — data pipelines, feature extraction, RUL/SOH baseline models | Reference implementation for RUL/SOH modeling approaches and feature engineering |
| [`LiionPro-DT/`](LiionPro-DT/README.md) | Synthetic Li-ion digital-twin dataset generator — 5 years of 1-minute-resolution EV pack telemetry | Sample/synthetic data source for testing analytics against long-horizon degradation trends |
| [`State-of-Health-Estimation-Methods/`](State-of-Health-Estimation-Methods/README.md) | Collection of SOH estimation methods and scripts | Reference for SOH estimation algorithms |
| [`battery_aging/`](battery_aging/README.md) | NASA Li-ion battery aging dataset tooling (`mat` → `DataFrame` conversion, trained aging model) | Reference dataset/model for aging behavior and a `.mat`-to-`DataFrame` conversion pattern |

Each subfolder is the upstream repo as downloaded (its own `README.md`/`LICENSE` apply — see that
file for attribution and terms before reusing any code or data from it).
