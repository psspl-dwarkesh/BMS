# Frontend Standards

> **Version:** 1.0  
> **Framework:** React.js (Vite)  
> **Styling:** Vanilla CSS with CSS Custom Properties

---

## 1. Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19.x (via Vite 8.x) |
| Styling | Vanilla CSS with CSS Variables for theming |
| Charts | Recharts |
| Icons | Lucide React |
| CSV Parsing | PapaParse |
| PDF export | jsPDF + jspdf-autotable (`ReportGenerator.jsx`) |
| 3D | three + @react-three/fiber + @react-three/drei (used in `CellAnalysis.jsx` only) |
| Linting | oxlint |

> Analytics (KPIs, anomaly detection, SOH/degradation estimation) run entirely client-side in
> `utils/csvParser.js`. There's a FastAPI backend in `../backend` (see
> [current-status.md](current-status.md) for what it does and doesn't do), but the frontend does
> not currently call it for CSV processing or predictions — only a WebSocket connection for live
> alerts (`ws://localhost:8000/ws/alerts` in `Layout.jsx`).

---

## 2. Design System

### Color Palette (Black & White Enterprise Theme)
```css
/* Backgrounds */
--bg-primary: #ffffff;      /* Main background */
--bg-secondary: #f8f9fa;    /* Secondary panels */
--bg-panel: #f1f3f5;        /* Cards, widgets */
--bg-sidebar: #111111;      /* Sidebar background */

/* Text */
--text-primary: #111111;    /* Main body text */
--text-secondary: #6b7280;  /* Muted/secondary text */
--text-muted: #9ca3af;      /* Hints, placeholders */

/* Borders */
--border-default: #e5e7eb;  /* Standard borders */
--border-strong: #d1d5db;   /* Emphasized borders */

/* Accents */
--accent-primary: #111111;  /* Primary action color */
--success: #22c55e;         /* Good/healthy status */
--warning: #f59e0b;         /* Warning status */
--danger: #ef4444;          /* Error/critical status */
```

### Typography
- **Headings:** `'Outfit', sans-serif` — Weight: 600–700
- **Body:** `'Inter', sans-serif` — Weight: 400–500
- **Monospace:** `'JetBrains Mono', monospace` — For data values

### Spacing Scale
- `4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `48px`, `64px`

### Border Radius
- Small: `6px`
- Medium: `10px`
- Large: `14px`

---

## 3. Project Structure

```
bms-portal/src/
├── components/
│   ├── LandingPage.jsx        # Marketing landing page (entry point)
│   ├── LoginPage.jsx          # Mock login (hardcoded users) + fake SSO buttons
│   ├── Layout.jsx             # Portal shell: inline sidebar, topbar, tab routing, modals, alert WebSocket
│   ├── FleetDashboard.jsx     # "Fleet Overview" tab — randomly generated demo pack data
│   ├── Dashboard.jsx          # "Single Pack Dashboard" tab — KPI cards + time-series charts
│   ├── DataQuality.jsx        # "Data Quality" tab — validation report for the parsed CSV
│   ├── CellAnalysis.jsx       # "Cell Analysis" tab — 96-cell heatmap + bar chart (uses three.js)
│   ├── DegradationAnalysis.jsx# "Degradation" tab — SOH/capacity-fade curve (EKF-based)
│   ├── DataIngestion.jsx      # "Data Upload" tab — drag/drop, multi-file, bundled validation datasets
│   ├── ReportGenerator.jsx    # "Reports" tab — PDF/CSV export
│   ├── Documentation.jsx      # Standalone in-app docs view (reached from the landing page)
│   ├── Sidebar.jsx            # UNUSED — superseded by the inline sidebar in Layout.jsx
│   └── FileUpload.jsx         # UNUSED — superseded by the upload zone in DataIngestion.jsx
├── utils/
│   └── csvParser.js    # CSV parsing + client-side analytics engine (KPIs, anomalies, EKF-based SOH)
├── hooks/              # Custom React hooks (future — currently empty)
├── context/            # Global state providers (future — currently empty)
├── App.jsx             # Root component: landing/login/docs/portal state machine
├── App.css             # App-specific styles
├── docs.css            # Styles for Documentation.jsx
├── index.css           # Global design system + CSS variables
└── main.jsx            # Entry point
```

`Sidebar.jsx` and `FileUpload.jsx` are dead code — not imported anywhere. Don't build on them
without first checking whether they're still meant to be removed (see
[current-status.md](current-status.md)).

---

## 4. Responsive Breakpoints

| Breakpoint | Target |
|------------|--------|
| `≤ 768px` | Mobile |
| `769px – 1024px` | Tablet |
| `≥ 1025px` | Desktop |

All components must be fully responsive. Use CSS Flexbox/Grid and media queries.

---

## 5. Performance Guidelines

- Use `useMemo` for expensive calculations (processing 1000+ CSV rows).
- Lazy-load non-critical components where possible.
- Keep chart data to a max of 500 data points for rendering performance.
- Use CSS transitions instead of JS-based animations.

---

## 6. Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Components | PascalCase | `CellAnalysis.jsx` |
| CSS Classes | kebab-case | `.glass-card`, `.dashboard-grid` |
| JS Functions | camelCase | `parseCSV()`, `processFile()` |
| Constants | UPPER_SNAKE_CASE | `MAX_DATA_POINTS` |
| CSS Variables | kebab-case with `--` prefix | `--bg-primary` |
