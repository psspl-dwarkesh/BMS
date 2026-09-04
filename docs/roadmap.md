# BMS Portal — Project Roadmap

> For a detailed, feature-by-feature snapshot of what's actually built vs. known gaps, see
> [current-status.md](current-status.md) — this file just tracks the phase-level plan.

## Phase 1: Frontend Finalization — ✅ Done
- [x] Teal/Cyan enterprise color palette
- [x] Real login with Role-Based Access Control (Admin, User)
- [x] Bundled sample datasets for a zero-setup first upload
- [x] Interactive dropdowns, settings modal, SVG gauges, PDF/CSV report export

## Phase 2: Backend Integration & Server-Side Analytics — ✅ Done
- [x] Real FastAPI + SQLAlchemy backend (SQLite) — devices, telemetry, cell readings, alerts,
  users, all persisted and served over REST
- [x] CSV import runs server-side (batched inserts, background task) via
  `POST /devices/{id}/telemetry/import`
- [x] REST endpoints for fetching processed/historical time-series data
  (`/telemetry/latest`, `/telemetry/history`, `/telemetry/{id}/cells`)
- [ ] Move the client-side analytics math itself (KPIs, anomaly detection, EKF SOH estimation —
  currently `utils/csvParser.js`, run in the browser) to the server — still a client-side engine
  today, just now fed by backend data instead of only a raw upload

## Phase 3: Machine Learning & Predictive SOH — Partially done
- [x] Trained RandomForestRegressor for SOH/RUL (`POST /devices/{id}/predict/rul`), trained on the
  real NASA Li-ion discharge dataset — replaces the earlier untrained-model placeholder
- [ ] Wire that endpoint into an actual UI tab (it exists and works, nothing calls it yet)
- [x] Multi-cycle degradation curves (Degradation tab, EKF-derived when the source lacks a real
  SOH/Capacity signal, labeled measured vs. estimated)
- [ ] Track historical SOH across re-imports of the same device over time (currently each
  device's degradation view is computed from its own telemetry history, not compared release-over-release)

## Phase 4: Fleet Management & Scale — Mostly done
- [x] Fleet Dashboard backed by real device records (was 256 `Math.random()` packs; now the real
  `/devices` list, role-scoped)
- [x] Geographic mapping (Location tab, GPS trace from telemetry rows with lat/lng)
- [x] Real-time telemetry via WebSocket (`WS /ws/alerts` + an optional per-device simulator,
  `SIMULATOR_ENABLED`, off by default for this upload-and-analyze demo) — bypasses manual CSV
  upload when turned on
- [x] Real JWT authentication (bcrypt-hashed passwords, backend-issued/verified tokens) — no
  hardcoded frontend credentials; SSO is not implemented

## What's next
See [current-status.md](current-status.md#-in-progress--known-gaps) for the live list — currently:
wiring the RUL endpoint into the UI, WebSocket reconnect logic, real pagination for
alerts/location/analytics history (today they're capped, not paginated), and moving large-CSV
client-side parsing off the main thread.

---

## Ideas parked for later (not scheduled)
1. **Firmware OTA Manager** — interface to push over-the-air updates to BMS hardware.
2. **Advanced Calibration** — a page for engineers to manually adjust voltage curves/calibration
   metrics against lab test data.
3. **Audit Logs** — track which users accessed which devices or downloaded which reports.
