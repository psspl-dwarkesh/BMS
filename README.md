# BMS Battery Analytics Platform

A BMS/cell-level battery analytics platform: a FastAPI backend for data ingestion, SOH/RUL
inference and live telemetry, paired with a React (Vite) portal for visualization and reporting.

## Project Structure

```
BMS/
├── backend/     FastAPI service — ingestion, ML inference, WebSocket telemetry, SQLite storage
├── bms-portal/  React + Vite frontend — dashboards, CSV upload, reporting
├── docs/        Architecture, requirements, roadmap, and contribution standards
└── references/  Third-party reference repos/datasets used for research (not shipped)
```

## Getting Started

**Backend** (`backend/`)
```bash
cd backend
python -m venv venv && venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

**Frontend** (`bms-portal/`)
```bash
cd bms-portal
npm install
npm run dev
```

## Documentation

See [`docs/`](docs/) for the full picture:
- [architecture.md](docs/architecture.md) — system architecture
- [project-requirements.md](docs/project-requirements.md) — current requirements
- [original-requirements.md](docs/original-requirements.md) — original source requirements doc
- [roadmap.md](docs/roadmap.md) — roadmap and implemented feature set
- [current-status.md](docs/current-status.md) — snapshot of what's actually built
- [frontend-standards.md](docs/frontend-standards.md) — frontend conventions
- [git-standards.md](docs/git-standards.md) — branching/commit workflow

Reference material used during research lives in [`references/`](references/README.md) and is
kept separate from the application code.
