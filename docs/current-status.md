# BMS Portal — Current Status & Roadmap

> **Last Updated:** 2026-09-04

This snapshot reflects what's actually in the repo right now, not the original plan — see
[frontend-standards.md](frontend-standards.md) for the component inventory it's based on.

> Superseded note: earlier versions of this doc described a client-side-only demo where the
> FastAPI backend existed but wasn't called by the UI. That's no longer true — the backend is a
> real, persistent system of record and the frontend is wired to it end-to-end (auth, devices,
> telemetry, alerts, live WebSocket updates).

---

## How the app actually works today

`App.jsx` gates the UI through `landing → login → portal (Layout)`. Login is real: `POST
/api/v1/auth/login` checks a bcrypt-hashed password against the `users` table and issues a
genuine signed JWT (see [security.md](#) / `backend/auth.py`), not a mock token. Everything inside
the portal — the fleet list, per-device telemetry, alerts, CSV import — is a real HTTP/WebSocket
call to the FastAPI backend, backed by SQLAlchemy models (`Device`, `Telemetry`, `CellReading`,
`Alert`, `User`, `DeviceAssignment`) persisted in SQLite.

### Two ways data gets into the system
1. **Upload & Analyze** (`/app/upload`, `DataIngestion.jsx`) — the primary demo flow. Drop one or
   more CSV files (or pick a bundled sample dataset); each file is parsed client-side just far
   enough to preview its detected signals (voltage/current/SOC/SOH/cycle/cell count) and can be
   individually included/excluded/removed before submitting. On submit, a **new device is created**
   sized from the first file's detected cell/thermistor count, and every included file is imported
   into it in order — then the user lands straight on that device's Automated Analytics Report
   (Findings tab). This is a *cold-start* flow: no device has to exist beforehand.
2. **Live simulator** (`backend/simulator.py`) — generates realistic per-device telemetry ticks and
   pushes them over `/ws/alerts`, feeding the Realtime/Cell Analysis/Location tabs for a device as
   if it were physically connected. **Off by default** (`SIMULATOR_ENABLED=false`) since this is
   framed as an upload-and-analyze demo, not a live-telemetry product — one env var away if a
   live-mode demo is wanted.

The old per-device "Historical Data Ingestion" page (`/app/devices/:id/upload`, for backfilling an
*existing* device) was removed as a duplicate of Upload & Analyze — see git history around
`39ad393` for the removal and the merge that unified the two flows' single component.

### Frontend — real & working, calling the real backend
- [x] Landing page → real login (JWT) → portal flow (`App.jsx`, `LandingPage.jsx`, `LoginPage.jsx`),
  with "Quick Login" demo buttons for the two seeded demo accounts
- [x] Portal layout with sidebar nav, device picker (with a "deselect" option back to fleet view),
  topbar, live alerts panel over WebSocket (`Layout.jsx`)
- [x] Admin-only: Fleet Overview (real device list, not mock data), User Management, Device
  Registry, Fleet Alerts
- [x] Per-device tabs: Real-Time Live, Device History (with CSV export), Cell Analysis, GPS
  Tracking, Degradation, Data Quality, Thermal, Findings (Automated Findings & Outputs), Alerts,
  Reports (PDF/CSV export)
- [x] Upload & Analyze (`/app/upload`): multi-CSV batch upload with per-file preview/include/remove,
  auto-creates a device and imports every included file, lands on the new device's report
- [x] Column auto-detection by header keyword matching (voltage/current/temp/soc/cell/cycle etc.)
- [x] Data Quality scoring, Cell Analysis (3D pack viewer sized to actual CSV cell count),
  Degradation (EKF-derived SOH/capacity fade when the CSV lacks the signal, labeled
  measured/estimated), Thermal Analysis, 9-type anomaly detection, Automated Findings, PDF/CSV
  report export — all computed from data fetched from the backend via `useDeviceAnalytics.js`
- [x] In-app documentation view (`Documentation.jsx`), including a diagram of the Upload & Analyze
  flow, the deployment-architecture options, and dedicated topics on the Admin/User assignment
  model, the Data Sources panel, and the Fleet Map
- [x] RBAC: **admin** (full fleet access) and **user** (assigned devices only) — enforced both by
  route guards (`RequireAuth adminOnly`) and backend `require_admin`/`get_scoped_device` checks
- [x] **Data Sources panel** (`UploadHistoryPanel.jsx`, topbar database icon once a device is
  selected): the CSV-upload audit trail a device never had — every import batch's filename,
  upload timestamp, row count, an include/exclude toggle (hides that batch's rows from every
  analytics endpoint without deleting them), a view-sample-rows action, and a permanent delete.
  Backed by the new `TelemetryImport` model and `/telemetry/imports*` endpoints
  (`backend/routers/telemetry.py`)
- [x] **Fleet Map** (`/app/fleet/map`, admin-only): every registered battery plotted on one
  Leaflet + OpenStreetMap map, pin-colored by device status, using its latest GPS fix or its
  `home_latitude`/`home_longitude` as a fallback; devices with neither are listed separately
  instead of being plotted at (0,0)

### Frontend — known limitations (worth knowing before you build on it)
- Device-scoped analytics tabs (Degradation/Thermal/Data Quality/Findings) are computed over the
  **most recent 500 telemetry rows only** (`useDeviceAnalytics.js`), with no indication in the UI
  that this is a recent-window rather than lifetime stat — a device with years of history will
  show trends only over its last 500 samples.
- The WebSocket live-alerts connection has no reconnect logic; a dropped connection (network blip,
  server restart) silently stops live alerts until a full page reload.
- Large CSV parsing (PapaParse) runs synchronously on the main thread — a big file will visibly
  freeze the UI during the pre-upload preview.
- The Fleet Overview table caps at 50 rows with a "Showing 50 of N" note but no further pagination
  — refine the search to see more.
- `predictApi.getRul` (backend `/predict/rul`, a trained RandomForestRegressor for SOH/RUL) and the
  historical per-cell drill-down endpoint exist and work, but aren't called from any UI yet.
- A CSV's `Cycle_Number`/`Capacity_Ah` columns are now stored per telemetry row (see Backend
  below), but the Degradation tab's measured-vs-EKF-estimated branching hasn't been updated to
  prefer them yet — it still estimates from SOH/voltage trends even when real capacity data is
  present. Wiring that in is a follow-up.

### Backend — real, persistent, wired to the frontend
- [x] FastAPI server, SQLite (`bms_analytics.db`) via SQLAlchemy; auto-creates tables and
  auto-seeds two demo accounts (`admin@bms.local` / `user@bms.local`) on a completely empty DB —
  deliberate for this public demo instance (the login page's own "Quick Login" buttons use these
  exact credentials), not an oversight
- [x] `POST /api/v1/auth/login`, `GET /api/v1/auth/me` — real bcrypt + JWT auth
- [x] `GET/POST/PATCH /api/v1/devices` — device CRUD, role-scoped listing (batched — one query for
  the latest telemetry across all devices, not one per device)
- [x] `GET /api/v1/devices/{id}/telemetry/latest|history|history/export`,
  `POST /api/v1/devices/{id}/telemetry/import` — CSV import runs as a background task with batched
  inserts (200 rows/commit), capped at 1000 rows/import for this demo (the response reports how
  many rows were actually accepted if the file was larger). Also now reads Latitude/Longitude and
  Cycle_Number/Capacity_Ah columns when present (previously silently dropped despite being
  documented/advertised in the UI)
- [x] `GET/PATCH/DELETE /api/v1/devices/{id}/telemetry/imports[/{import_id}]`,
  `GET .../imports/{import_id}/preview` — the CSV upload audit trail backing the Data Sources
  panel (`TelemetryImport` model). Every `latest`/`history`/`location/history`/fleet-list query
  excludes a device's excluded import batches so the include/exclude toggle propagates everywhere
- [x] `GET /api/v1/devices/{id}/location/history` — GPS trace, capped at the most recent 2000 points
- [x] `GET/POST /api/v1/alerts`, `.../acknowledge` — capped at 500 most-recent rows
- [x] `POST /api/v1/devices/{id}/predict/rul` — SOH/RUL prediction via a RandomForestRegressor
  trained on the real NASA Li-ion discharge dataset (not yet called from the UI)
- [x] `WS /ws/alerts` — authenticated (JWT via query param), broadcasts real threshold-violation
  alerts as they're generated by either the simulator or a CSV import's latest row
- [x] `backend/simulator.py` — per-device live telemetry generator, gated off by default
- [x] Static file serving of the production build + SPA fallback (single-service deploy on Render)

### Backend — known limitations
- Device-scoped analytics endpoints don't paginate beyond simple `page`/`page_size` on history;
  a few endpoints (alerts, location) only recently got a safety cap rather than real pagination.
- `Alert.telemetry_id`'s foreign key has no `ondelete` rule — a future telemetry-retention/cleanup
  feature that deletes old `Telemetry` rows would need this addressed first (currently blocked by
  FK enforcement rather than silently orphaning, which is safer but still needs a real fix).
- Several `String` columns have no explicit length limit — harmless on SQLite (this demo's DB) but
  will need attention if the app ever moves to PostgreSQL, which nothing here currently blocks.
- No end-to-end test suite exists yet.

---

## 🔄 In Progress / Known Gaps

- [ ] Wire `predictApi.getRul` (backend already supports it) into a device tab — the ML model is
  trained and working, just not surfaced in the UI yet
- [ ] WebSocket reconnect/backoff logic for the live-alerts connection
- [ ] Real pagination (not just a row cap) for alerts, location history, and analytics-tab history
  so a long-lived device's full history is genuinely reachable, not just its most recent window
- [ ] Move large-CSV client-side parsing off the main thread (Web Worker) so a big upload doesn't
  visibly freeze the UI during preview

---

## 📋 Next Milestones

### Milestone 4 — Production Polish
- [ ] OpenAPI/Swagger documentation pass (FastAPI generates this automatically at `/docs`, but the
  hand-rolled response dicts across routers aren't backed by shared Pydantic response models yet)
- [ ] End-to-end testing suite (none exists today)
- [ ] Web Worker for large CSV client-side parsing
- [ ] PostgreSQL migration path (add explicit column lengths, connection pool tuning) if/when this
  moves off a single SQLite file

---

## Known Issues

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | Analytics tabs (Degradation/Thermal/Quality/Findings) compute over the most recent 500 rows only, with no UI indication it's a partial window | Medium | Open |
| 2 | WebSocket live-alerts connection has no reconnect logic | Medium | Open |
| 3 | Large CSV parsing blocks the main thread (visible freeze on big files) | Low-Medium | Open |
| 4 | `predict/rul` (trained SOH/RUL model) isn't called from any UI | Low | Backend ready, needs wiring |
| 5 | `Alert.telemetry_id` FK has no `ondelete` rule | Low | Would block a future retention/cleanup feature |
| 6 | Several `String` DB columns have no explicit length limit | Low | Fine on SQLite; needs attention before a Postgres migration |
| 7 | Fleet Overview table caps at 50 rows with only a warning, no further pagination | Low | Open |
