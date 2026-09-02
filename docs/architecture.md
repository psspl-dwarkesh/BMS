# BMS Portal — System Architecture

> **Version:** 1.0  
> **Type:** Full-Stack Web Application (SPA + REST API)

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Client (Browser)                     │
│                                                         │
│  ┌───────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Landing Page   │  │ Portal UI    │  │ Data Upload  │ │
│  │ (Marketing)    │  │ (Dashboard)  │  │ (CSV)        │ │
│  └───────────────┘  └──────────────┘  └──────────────┘ │
│                          │                              │
│           ┌──────────────┴──────────────┐               │
│           │    React + Vite (SPA)       │               │
│           │    Recharts · PapaParse     │               │
│           └──────────────┬──────────────┘               │
└──────────────────────────┼──────────────────────────────┘
                           │ HTTP (REST API)
┌──────────────────────────┼──────────────────────────────┐
│                    Server (Backend)                      │
│           ┌──────────────┴──────────────┐               │
│           │    FastAPI (Python)         │               │
│           │    Pandas · SQLAlchemy      │               │
│           └──────────────┬──────────────┘               │
│                          │                              │
│           ┌──────────────┴──────────────┐               │
│           │    SQLite Database          │               │
│           │    (bms_analytics.db)       │               │
│           └─────────────────────────────┘               │
└─────────────────────────────────────────────────────────┘
```

---

## Frontend Architecture

### Application Flow
1. **Landing Page** — Marketing/product introduction page
2. **Portal Entry** — Dashboard loads directly with sample or uploaded data
3. **Portal Views** — Dashboard, Cell Analysis, Degradation, Thermal, Alerts, Reports
4. **Data Upload** — Available within the portal as a dedicated section

### State Management
- React `useState` for local component state
- Props drilling for cross-component data (analytics data flows down from App)
- Future: React Context for global state (theme, auth)

### Analytics Engine (Client-Side)
Located in `utils/csvParser.js`:
- Parses CSV using PapaParse
- Computes pack-level KPIs (voltage, current, temperature, SOC)
- Generates cell-level analysis
- Detects anomalies (voltage imbalance, over-temperature)
- Outputs time-series data for chart rendering

---

## Backend Architecture

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api` | Health check |
| `POST` | `/api/v1/packs/upload` | Upload CSV and store telemetry |
| `GET` | `/api/v1/packs` | List all battery packs |

### Database Schema

**`battery_packs`** — Battery pack records
| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER (PK) | Auto-increment ID |
| `pack_name` | TEXT | Display name |
| `status` | TEXT | Active/Inactive |
| `cell_count` | INTEGER | Number of cells |
| `created_at` | DATETIME | Record creation time |

**`pack_telemetry`** — Time-series telemetry data
| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER (PK) | Auto-increment ID |
| `pack_id` | INTEGER (FK) | Reference to battery_packs |
| `timestamp` | DATETIME | Measurement time |
| `voltage` | FLOAT | Pack voltage |
| `current` | FLOAT | Pack current |
| `temperature` | FLOAT | Pack temperature |
| `soc` | FLOAT | State of charge |

---

## Deployment Options

### Development
```bash
# Frontend
cd bms-portal && npm run dev    # → localhost:5173

# Backend
cd backend && uvicorn main:app --reload    # → localhost:8000
```

### Production
```bash
# Build frontend
cd bms-portal && npm run build

# Serve via FastAPI
cd backend && uvicorn main:app --host 0.0.0.0 --port 8000
# FastAPI serves the built React app from /bms-portal/dist/
```

---

## Future Architecture (AI Integration)

```
CSV Upload → FastAPI → Pandas Processing → ML Model (SOH Prediction)
                                              ↓
                                        JSON Response → React Dashboard
```

The Python backend will integrate trained ML models (`.joblib`) from:
- `battery_aging-master/`
- `State-of-Health-Estimation-Methods-main/`
- `BatteryML-main/`
