# BMS Portal — Project Roadmap & Architecture Structure

## Current Architecture Implemented
- **Frontend Stack**: React 19, Vite, Lucide React, Recharts
- **Theme**: Professional BMS Teal/Cyan Enterprise Theme
- **Data Flow**: PapaParse for client-side CSV processing, full React state management
- **Core Views**:
  - Landing Page (Marketing & Platform Capabilities)
  - Login Page (Role-Based Access Control demo)
  - Dashboard (KPIs, Charts, SVG Gauges)
  - Cell Analysis (96-cell Heatmap & Bar Charts)
  - Degradation & Thermal Analysis
  - Alerts & Anomalies Table
  - Data Ingestion Wizard
  - Report Generator (PDF mock export)
- **Interactive UI**: Working Modals (Settings), Dropdowns (Profile, Notifications), SVG Gauges

---

## Phase 1: Frontend Finalization (Current)
- [x] Complete UI redesign to Teal/Cyan enterprise color palette.
- [x] Implement Login page with Role-Based Access Control mock (Admin, Engineer, Viewer).
- [x] Add auto-loading sample datasets for seamless first-time user experience.
- [x] Implement interactive dropdowns (Profile, Notifications).
- [x] Implement Settings Modal for configuration.
- [x] Implement Report Generator (Mock PDF generation).
- [x] Convert SOC indicator to custom animated SVG Gauge.
- [ ] Connect Settings state to actual UI behavior (e.g. changing alert sensitivity updates anomalies array).

## Phase 2: Backend Integration & Server-Side Analytics
- [ ] Migrate CSV parsing from client-side (`PapaParse`) to server-side (`Pandas`).
- [ ] Create Python-based calculation engine for thermal anomaly detection.
- [ ] Create Python-based calculation engine for voltage imbalance spread.
- [ ] Implement database persistence (`SQLite`/`PostgreSQL`) for uploaded logs and generated reports.
- [ ] Build REST API endpoints for fetching processed time-series data.

## Phase 3: Machine Learning & Predictive SOH
- [ ] Integrate ML models to replace mock `estimatedSOH`.
- [ ] Implement multi-cycle degradation curves.
- [ ] Implement Remaining Useful Life (RUL) predictive modeling.
- [ ] Store historical SOH data to track capacity fade over time.

## Phase 4: Fleet Management & Scale
- [ ] Introduce "Fleet Dashboard" to monitor multiple battery packs simultaneously.
- [ ] Build geographic mapping for deployed fleet vehicles.
- [ ] Implement real-time WebSocket telemetry ingestion (bypassing manual CSV upload).
- [ ] Implement robust user authentication via JWT tokens and backend SSO integration.

---

## New Page Ideas for Future Development
1. **Fleet Map**: A map view showing live locations and health statuses of multiple battery packs.
2. **Firmware OTA Manager**: Interface to push Over-The-Air updates to BMS hardware.
3. **Advanced Calibration**: A page for engineers to manually adjust voltage curves and calibration metrics based on lab test data.
4. **Audit Logs**: Security page tracking which users accessed which datasets or downloaded which reports.
