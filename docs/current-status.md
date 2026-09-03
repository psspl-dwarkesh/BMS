# BMS Portal — Current Status & Roadmap

> **Last Updated:** 2026-09-03

This snapshot reflects what's actually in the repo right now, not the original plan — see
[frontend-standards.md](frontend-standards.md) for the component inventory it's based on.

---

## How the app actually works today

The portal is **almost entirely a client-side analytics tool**. `App.jsx` gates the UI through
`landing → login → portal (Layout)`, and once inside, every tab reads from a single
`analyticsData` object produced by [csvParser.js](../bms-portal/src/utils/csvParser.js) — parsed
and computed entirely in the browser with PapaParse. The FastAPI backend runs alongside it but
**is not called by any of these flows**; the only backend touchpoint from the UI is a WebSocket
connection for live alerts, which stays empty unless something else hits the upload endpoint
separately.

### Frontend — real & working (client-side)
- [x] Landing page → mock-login → portal flow (`App.jsx`, `LandingPage.jsx`, `LoginPage.jsx`)
- [x] Portal layout with sidebar nav, topbar, notifications dropdown, settings/profile/access-control modals (`Layout.jsx`)
- [x] Fleet Overview, Single Pack Dashboard, Data Quality, Cell Analysis, Degradation, Thermal, Alerts, Findings & Outputs tabs
- [x] CSV upload with drag-and-drop, multi-file queueing, two bundled "predefined validation case" datasets, and a default sample dataset auto-loaded on login (`DataIngestion.jsx`, `csvParser.js`)
- [x] Column auto-detection by header keyword matching (`voltage`, `current`, `temp`, `soc`, `cell`, `cycle`, etc.) — not a configurable mapping UI
- [x] Data Quality scoring (missing signals, invalid values incl. a proportional score penalty, timestamp gaps) with a Good/Limited/Insufficient tier, computed from the parsed CSV
- [x] Cell Analysis: interactive 3D WebGL pack viewer + voltage bar chart + temperature distribution bar chart, all sized to however many `CellN_Voltage`/`CellN_Temp` columns the CSV actually has (never a fixed 96) — plus weakest/strongest-cell KPIs
- [x] Time-series charts (Voltage, Current, SOC, Cell Spread) via Recharts
- [x] Degradation view: SOH/capacity-fade curve driven by an in-browser Extended Kalman Filter over Coulomb-counted throughput when the CSV lacks SOH/Capacity columns; reads them directly when present. SOH and Capacity are labeled measured/estimated independently (a CSV can have one without the other)
- [x] Dedicated Thermal Analysis tab (`ThermalAnalysis.jsx`): pack temp KPIs, temp-vs-time chart, cell-to-cell temperature difference chart, thermal-anomaly table — all null-safe when temperature data is absent
- [x] Anomaly detection (9 types, client-side): cell voltage imbalance, per-cell over/under-voltage, pack over-temperature, cell over-temperature, cell-to-cell temperature imbalance, statistical current outliers, abnormal degradation pattern (measured SOH only), and low data-quality-score
- [x] Automated Findings & Outputs tab (`AutomatedFindings.jsx`): plain-language Key Findings generated from the actual computed KPIs/anomalies, plus an Integration View mapping available outputs to potential BMS/vehicle-control use cases (filtered to what this CSV actually supports)
- [x] PDF and CSV report export (`ReportGenerator.jsx`, via jsPDF) — includes Key Findings, the full anomaly list, and weakest/strongest-cell + cell-temp-spread KPIs, not just a 5-row preview
- [x] Black & white enterprise theme, responsive layout
- [x] In-app documentation view (`Documentation.jsx`), incl. visual on-board/cloud/hybrid deployment diagrams and an outputs → vehicle-control mapping reference page

### Frontend — mocked / simulated (worth knowing before you build on it)
- **Login has no real backend.** `LoginPage.jsx` checks against 3 hardcoded users
  (admin/engineer/viewer) and issues a self-signed, unverified "JWT" (`btoa` payload + a literal
  `"mock-signature-do-not-use-in-production"`). The "Google"/"Microsoft" SSO buttons are a 1.2s
  `setTimeout` that fabricates a token — no OAuth flow exists.
- **Fleet Overview is 100% fake data.** `FleetDashboard.jsx` generates 256 random packs
  (`Math.random()`) on every mount; it has no relationship to the `GET /api/v1/packs` endpoint or
  any uploaded dataset.
- **Client-side SOH is still a heuristic, not a validated model.** `csvParser.js` reads SOH/Capacity
  directly from the CSV when present (labeled "measured"); otherwise it derives them from an
  Extended Kalman Filter over Coulomb-counted throughput assuming a 50Ah nominal pack (labeled
  "estimated"). No fallback is ever presented as measured, and no value is fabricated when there's
  no signal to base it on — but the EKF itself is still a heuristic filter, not a trained/validated
  battery model (the backend's `/predict/rul` RandomForestRegressor is the closer-to-real one; the
  frontend doesn't call it — see the gap list below).
- **Custom Alert Rules, Access Control (user list), and Profile editing** in the settings modals
  are UI-only — nothing is persisted or enforced.
- Two dead/unused components remain in the tree: `Sidebar.jsx` and `FileUpload.jsx` (superseded by
  the inline sidebar in `Layout.jsx` and the upload UI in `DataIngestion.jsx`).

### Backend — real but not wired to the frontend
- [x] FastAPI server with CORS, SQLite (`bms_analytics.db`) via SQLAlchemy
- [x] `POST /api/v1/packs/upload` — parses a CSV, stores **only the first 50 rows** per pack, with
  SOC/temperature hardcoded to placeholder values (`100.0` / `25.0`); dispatches a background task
- [x] `GET /api/v1/packs` — lists stored packs (nothing currently populates it from the UI)
- [x] `POST /api/v1/predict/rul` — SOH/RUL prediction, backed by a RandomForestRegressor
  (`backend/ml_models/soh_capacity_model.joblib`) retrained on the real NASA Li-ion discharge
  dataset from [battery_aging-master](../battery_aging-master/battery_aging-master); see
  `ml_inference.py` for the feature engineering and its documented caveats (assumed sampling
  interval, single-sample RUL extrapolation using a population-average fade rate)
- [x] `WS /ws/alerts` — broadcasts ISO-26262-style threshold violations found by the background task; this is what `Layout.jsx` connects to for the "Real-Time System Alerts" panel
- [x] Static file serving of the production build + SPA fallback

### Backend — mocked / simulated
- **Anomaly detection worker (`tasks.py`) is FastAPI `BackgroundTasks`, not a real queue.** The
  code explicitly notes it's standing in for Celery + Redis ("to avoid requiring a local Redis
  installation on Windows") and adds an artificial 2s `sleep` to simulate queue latency.
- **The upload endpoint's column mapping is hardcoded** (first column containing `voltage`/
  `current`), not the mapping the frontend computes.

---

## 🔄 In Progress / Known Gaps

- [ ] Frontend never calls the backend — CSV upload, RUL prediction, and pack listing are two
  disconnected systems today. Wiring `DataIngestion.jsx` to `POST /api/v1/packs/upload` (or
  removing the backend from the pitch) is the biggest structural gap.
- [ ] Real authentication (backend-issued, verified JWT; no hardcoded credentials)
- [ ] Fleet Overview backed by real pack records instead of random data
- [ ] Client-side SOH (the Dashboard/Degradation tabs' EKF heuristic) still needs to move to a
  trained/validated model — the backend's `/predict/rul` now has one, but nothing in the UI calls
  it yet
- [ ] Backend CSV ingestion beyond the first 50 rows, with real SOC/temperature extraction, and
  storing per-row sample timestamps so RUL feature extraction can use real elapsed time instead of
  an assumed sampling interval

---

## 📋 Next Milestones

### Milestone 2 — Backend Analytics
- [ ] Server-side CSV processing with Pandas (beyond the current 50-row demo limit)
- [x] SOH/capacity estimation using a trained ML model (`/api/v1/predict/rul`, RandomForestRegressor
  on the NASA discharge dataset) — replaces the untrained-LSTM fallback
- [ ] Frontend actually calling backend analytics endpoints
- [ ] Database storage for computed analytics

### Milestone 3 — Advanced Features
- [x] RUL (Remaining Useful Life) prediction backed by a trained model (single-sample estimate,
  extrapolated from a population-average fade rate — see known caveats in `ml_inference.py`)
- [ ] Fleet-level monitoring backed by real multi-pack data (replace `FleetDashboard.jsx` mock data)
- [ ] Real user authentication & role-based access (replace hardcoded `STATIC_USERS`)
- [ ] Real Celery/Redis (or equivalent) task queue for anomaly detection, replacing `BackgroundTasks`

### Milestone 4 — Production Polish
- [ ] OpenAPI/Swagger documentation
- [ ] End-to-end testing suite (none exists today)
- [ ] Performance optimization for large datasets
- [ ] Deployment documentation (Docker/cloud)
- [ ] Remove dead components (`Sidebar.jsx`, `FileUpload.jsx`) or wire them back in

---

## Known Issues

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | Client-side SOH/Capacity (Dashboard + Degradation tab) is an honestly-labeled EKF heuristic when the CSV lacks the signal, not a trained model | Medium | Needs real model (backend has one now, frontend doesn't call it) |
| 2 | ~~Backend `/predict/rul` uses an untrained neural net blended with a heuristic~~ | ~~Medium~~ | Fixed — now a RandomForestRegressor trained on real NASA discharge data |
| 3 | Backend only stores first 50 rows per upload | Low | Demo limitation |
| 4 | Frontend does not call the backend for upload/predict — two disconnected systems | Medium | Needs integration |
| 5 | Login/SSO is fully mocked (hardcoded users, fake JWT signature) | Medium | Needs real auth |
| 6 | Fleet Overview shows randomly generated packs, not real data | Low | Demo limitation |
| 7 | `Sidebar.jsx` and `FileUpload.jsx` are unused dead code | Low | Cleanup |
