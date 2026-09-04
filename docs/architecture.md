# BMS Portal — System Architecture

> **Version:** 2.0
> **Type:** Full-Stack Web Application (SPA + REST API + WebSocket)
> **Last Updated:** 2026-09-04 — see [current-status.md](current-status.md) for what this
> actually looks like feature-by-feature.

---

## High-Level Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                         Client (Browser)                          │
│                                                                    │
│  ┌──────────────┐   ┌──────────────────┐   ┌───────────────────┐  │
│  │ Landing Page │   │ Login (real JWT) │   │  Portal (Layout)  │  │
│  └──────────────┘   └──────────────────┘   └─────────┬─────────┘  │
│                                                       │            │
│           ┌───────────────────────────────────────────┴─────┐     │
│           │             React + Vite (SPA)                  │     │
│           │   react-query · Recharts · PapaParse · Axios    │     │
│           └───────────────────────┬────────────────┬─────────┘    │
└───────────────────────────────────┼────────────────┼──────────────┘
                    HTTP (REST, JWT)│                │ WebSocket (JWT via query param)
┌───────────────────────────────────┼────────────────┼──────────────┐
│                          Server (FastAPI)                          │
│           ┌───────────────────────┴────────────────┴─────────┐    │
│           │  routers/ auth · devices · telemetry · location   │    │
│           │           alerts · predict · users                │    │
│           └───────────────────────┬───────────────────────────┘    │
│                                   │                                │
│     ┌─────────────────────────────┼─────────────────────────┐     │
│     │                             │                         │     │
│     ▼                             ▼                         ▼     │
│  SQLAlchemy ORM          simulator.py (optional,      ml_inference │
│  → SQLite                 gated off by default)        .py (RUL)  │
│  (bms_analytics.db)                                                │
└─────────────────────────────────────────────────────────────────────┘
```

The backend is a real system of record, not a passthrough: every tab in the portal reads from
and writes to it over HTTP, and live alerts arrive over an authenticated WebSocket.

---

## Frontend Architecture

### Application Flow
1. **Landing Page** (`LandingPage.jsx`) — marketing/product page, unauthenticated
2. **Login** (`LoginPage.jsx`) — real `POST /api/v1/auth/login`, JWT stored in `localStorage`;
   "Quick Login" buttons for the two seeded demo accounts
3. **Portal Shell** (`Layout.jsx`) — sidebar (fleet nav for admins, device picker + device-scoped
   nav for everyone), topbar, live-alerts panel over `WS /ws/alerts`
4. **Two entry points into a device's data:**
   - **Upload & Analyze** (`/app/upload`) — cold-start flow: upload CSV(s) with no device yet,
     one gets created and imported automatically, landing on its report. See the diagram in the
     in-app Documentation → Architecture & Workflow tab (`Documentation.jsx`) for the exact steps.
   - **Live simulator** (off by default) — a device already streaming, viewed via Realtime/Cell
     Analysis/Location tabs
5. **Device-scoped analytics tabs** — Realtime, History, Cell Analysis, Location, Degradation,
   Data Quality, Thermal, Findings, Alerts, Reports — each pulls its data via
   `useDeviceAnalytics.js` (a shared react-query hook, capped at the most recent 500 telemetry
   rows) and runs the same client-side analytics math (`utils/csvParser.js`'s helpers,
   `telemetryAdapter.js`) that used to run only against an uploaded CSV.

### State Management
- **react-query** (`@tanstack/react-query`) for all server state — devices, telemetry, alerts —
  with polling (`refetchInterval`) for near-real-time tabs and cache invalidation on mutations
- React `useState`/`useContext` for local UI state and auth (`AuthContext.jsx`)
- No global client-state library (Redux/Zustand) — react-query's cache serves that role for
  server data

### Analytics Engine (Client-Side)
Still computed in the browser (not the backend) once data is fetched:
- `utils/csvParser.js` — column auto-detection, KPI computation, anomaly detection (9 types),
  EKF-based SOH/capacity-fade estimation when the source lacks a real SOH/Capacity signal
- `utils/telemetryAdapter.js` — adapts backend telemetry rows into the same shape the CSV
  analytics functions expect, so one analytics engine serves both a fresh CSV upload and
  previously-imported device history

---

## Backend Architecture

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|--------------|
| `POST` | `/api/v1/auth/login` | Authenticate, returns a signed JWT |
| `GET` | `/api/v1/auth/me` | Current user profile |
| `GET` | `/api/v1/devices` | List devices (role-scoped; admin sees all) |
| `POST` | `/api/v1/devices` | Register a new device |
| `GET` | `/api/v1/devices/{id}` | Device detail + latest telemetry snapshot |
| `PATCH` | `/api/v1/devices/{id}` | Update device metadata/status |
| `GET` | `/api/v1/devices/{id}/telemetry/latest` | Most recent telemetry row |
| `GET` | `/api/v1/devices/{id}/telemetry/history` | Paginated telemetry history |
| `GET` | `/api/v1/devices/{id}/telemetry/{telemetry_id}/cells` | Per-cell readings for one telemetry row |
| `GET` | `/api/v1/devices/{id}/telemetry/history/export` | Stream telemetry history as CSV |
| `POST` | `/api/v1/devices/{id}/telemetry/import` | Import a CSV as historical telemetry (background task, batched inserts, capped rows) |
| `GET` | `/api/v1/devices/{id}/location/history` | GPS trace (capped to the most recent 2000 points) |
| `POST` | `/api/v1/devices/{id}/predict/rul` | SOH/RUL prediction (trained RandomForestRegressor) |
| `GET` | `/api/v1/alerts` | List alerts (role-scoped, capped to 500 most recent) |
| `POST` | `/api/v1/alerts/{id}/acknowledge` | Acknowledge an alert |
| `GET` | `/api/v1/users` | List users (admin only) |
| `POST` | `/api/v1/users` | Create a user (admin only) |
| `PATCH` | `/api/v1/users/{id}/activate` | Enable/disable a user |
| `POST` | `/api/v1/users/{id}/set-password` | Reset a user's password |
| `POST`/`DELETE` | `/api/v1/users/{id}/device-assignments[/{device_id}]` | Assign/unassign a device to a `user`-role account |
| `WS` | `/ws/alerts?token=...` | Live alert stream (JWT-authenticated) |

### Database Schema (SQLAlchemy models, `backend/models.py`)

**`users`** — accounts and role
| Column | Type | Notes |
|--------|------|-------|
| `id` | PK | |
| `email` | String, unique | login identifier |
| `hashed_password` | String | bcrypt |
| `role` | Enum(`admin`, `user`) | RBAC |
| `is_active` | Boolean | |

**`devices`** — one row per registered battery pack
| Column | Type | Notes |
|--------|------|-------|
| `id` | PK | |
| `serial_number` | String, unique | |
| `pack_name` | String | |
| `chemistry` | Enum | LFP / NMC / LTO / Li-ion |
| `cell_count`, `thermistor_count` | Integer | sized from the source CSV on Upload & Analyze |
| `connection_type` | Enum | e.g. `SIMULATED` |
| `status` | Enum | healthy / warning / critical |
| `home_latitude`, `home_longitude` | Float, nullable | |

**`device_assignments`** — many-to-many, which `user`-role accounts can see which devices

**`telemetry`** — time-series pack-level readings, one row per sample
| Column | Type | Notes |
|--------|------|-------|
| `id` | PK | |
| `device_id` | FK → devices, indexed with `sample_time` | |
| `sample_time` | DateTime | real timestamp, not row order |
| `pack_voltage`, `pack_current`, `soc`, `soh` | Float, nullable | |
| `max_cell_voltage`, `min_cell_voltage`, `avg_cell_voltage` | Float, nullable | derived from `cell_readings` at import time |
| `max_thermistor_temp`, `min_thermistor_temp`, `avg_cell_temp` | Float, nullable | |
| `source` | Enum | `csv_import` vs `simulator` |

**`cell_readings`** — per-cell voltage/temperature for one `telemetry` row (one-to-many)

**`alerts`** — threshold-violation events (pack- or cell-level), deduped per `(device, type,
cell_number)` while unresolved; `telemetry_id` links back to the row that triggered it

---

## Deployment

### Development
```bash
# Frontend
cd bms-portal && npm run dev    # → localhost:5173

# Backend
cd backend && uvicorn main:app --reload    # → localhost:8000
```

### Production (single service, e.g. Render — see `render.yaml`)
```bash
# Build frontend
cd bms-portal && npm run build

# Serve via FastAPI (static files + SPA fallback from bms-portal/dist)
cd backend && uvicorn main:app --host 0.0.0.0 --port 8000
```

On a completely empty database (e.g. a fresh deploy), the backend auto-seeds two demo accounts
(`admin@bms.local`, `user@bms.local`) — intentional for this public demo instance, matching the
login page's own "Quick Login" buttons, not a security oversight to "fix" by disabling it.

---

## Known Architectural Limitations

See [current-status.md](current-status.md#backend--known-limitations) for the full, current list
(analytics-window row caps, WebSocket reconnect, large-CSV main-thread parsing, missing FK
`ondelete` rule, etc.) — kept in one place to avoid this doc and that one drifting apart again.
