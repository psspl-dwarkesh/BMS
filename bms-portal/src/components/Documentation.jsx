import { useState } from 'react';
import { ArrowLeft, BookOpen, Terminal, Database, Shield, Zap, Search, Link2, Users, Map as MapIcon, UploadCloud } from 'lucide-react';
import '../docs.css';

const DOC_TOPICS = [
  { id: 'intro', label: 'Introduction', icon: <BookOpen size={16} /> },
  { id: 'quickstart', label: 'Quick Start', icon: <Terminal size={16} /> },
  { id: 'architecture', label: 'Architecture & Workflow', icon: <Database size={16} /> },
  { id: 'data-format', label: 'CSV Data Format', icon: <Database size={16} /> },
  { id: 'data-sources', label: 'Upload History & Data Sources', icon: <UploadCloud size={16} /> },
  { id: 'outputs', label: 'Outputs → Vehicle Control', icon: <Link2 size={16} /> },
  { id: 'roles', label: 'Roles & Device Assignment', icon: <Users size={16} /> },
  { id: 'fleet-map', label: 'Fleet Map', icon: <MapIcon size={16} /> },
  { id: 'security', label: 'Security & Roles', icon: <Shield size={16} /> },
];

// Small React-docs-style "On this page" mini nav - each topic hand-lists its
// own h2 anchors (content here is static per topic, so a scroll-spy isn't
// needed for this to be useful) and just scrolls the docs content pane.
function OnThisPage({ items }) {
  const scrollToId = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return (
    <div className="doc-on-this-page">
      <div className="doc-on-this-page-title">On this page</div>
      <ul>
        {items.map((it) => (
          <li key={it.id}>
            <a href={`#${it.id}`} onClick={(e) => { e.preventDefault(); scrollToId(it.id); }}>{it.label}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

// A single labeled box for the deployment-architecture diagrams below.
const DiagBox = ({ title, subtitle, accent }) => (
  <div style={{
    border: `1.5px solid ${accent || 'var(--border-strong)'}`,
    borderRadius: 'var(--radius-md)',
    padding: '0.85rem 1rem',
    minWidth: '130px',
    textAlign: 'center',
    background: 'var(--bg-primary)',
    flexShrink: 0
  }}>
    <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-primary)' }}>{title}</div>
    {subtitle && <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{subtitle}</div>}
  </div>
);

const DiagArrow = ({ vertical }) => (
  <div style={{
    color: 'var(--accent-primary)', fontSize: '1.1rem', fontWeight: 700, flexShrink: 0,
    padding: vertical ? '0.15rem 0' : '0 0.4rem'
  }}>
    {vertical ? '↓' : '→'}
  </div>
);

const DeploymentDiagram = ({ title, description, children }) => (
  <div className="card" style={{ marginBottom: '1.25rem', background: 'var(--bg-secondary)' }}>
    <div className="card-title" style={{ fontSize: '0.9rem', marginBottom: '0.35rem' }}>{title}</div>
    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>{description}</p>
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.25rem', justifyContent: 'center', padding: '0.5rem 0' }}>
      {children}
    </div>
  </div>
);

export default function Documentation({ onBack }) {
  const [activeTopic, setActiveTopic] = useState('intro');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTopics = DOC_TOPICS.filter((t) =>
    t.label.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const renderContent = () => {
    switch (activeTopic) {
      case 'intro':
        return (
          <div className="animate-fade-in">
            <h1>Introduction to BMS Analytics</h1>
            <p className="doc-lead">The enterprise-grade intelligence layer for battery fleets. The platform transforms raw CSV logs from your Battery Management Systems into actionable health insights and predictive diagnostics — a real FastAPI backend with a Postgres/SQLite system of record, not a client-side mock.</p>

            <OnThisPage items={[{ id: 'intro-capabilities', label: 'Core Capabilities' }, { id: 'intro-two-roles', label: 'Two ways in: Admin vs. User' }, { id: 'intro-data-flow', label: 'Where your data actually goes' }]} />

            <h2 id="intro-capabilities">Core Capabilities</h2>
            <ul>
              <li><strong>Time-Series Analytics:</strong> Process thousands of data points for voltage, current, and temperature instantly.</li>
              <li><strong>Degradation Modeling:</strong> Track capacity fade and estimate true State of Health (SOH) over time.</li>
              <li><strong>Anomaly Detection:</strong> Automatically flag cell voltage imbalances and thermal events across 9 anomaly types.</li>
              <li><strong>Fleet Map:</strong> Plot every registered battery on one map, color-coded by status (admin only) — see <a href="#" onClick={(e) => { e.preventDefault(); setActiveTopic('fleet-map'); }}>Fleet Map</a>.</li>
              <li><strong>Upload History:</strong> Every CSV imported into a battery is kept as an auditable record — timestamp, row count, an include/exclude toggle, and delete — see <a href="#" onClick={(e) => { e.preventDefault(); setActiveTopic('data-sources'); }}>Upload History &amp; Data Sources</a>.</li>
              <li><strong>PDF Reporting:</strong> Generate downloadable diagnostic reports in a single click.</li>
            </ul>

            <h2 id="intro-two-roles">Two ways in: Admin vs. User</h2>
            <p>This is the single most common point of confusion, so it's worth stating plainly up front: an <strong>Admin</strong> is a fleet manager who can see and register every battery and decide who gets access to which ones. A <strong>User</strong> is scoped to whichever batteries an admin has explicitly assigned them — one, several, or (if never assigned any) none at all. A user is not locked to "one cell" — they see full real-time and historical data for every battery pack assigned to them, just not the rest of the fleet. Full detail in <a href="#" onClick={(e) => { e.preventDefault(); setActiveTopic('roles'); }}>Roles &amp; Device Assignment</a>.</p>

            <h2 id="intro-data-flow">Where your data actually goes</h2>
            <p>Every number shown in this portal - KPIs, charts, alerts, the Fleet Map, PDF reports - is computed from rows in the <code>telemetry</code>/<code>cell_readings</code> tables, populated one of two ways: a CSV import (<strong>Upload &amp; Analyze</strong>) or the built-in device simulator (off by default on this demo instance). Nothing is fabricated client-side to "fill in" a chart.</p>

            <div className="doc-note">
              <strong>Note:</strong> This is a demo/reference deployment. Two seeded accounts (<code>admin@bms.local</code> / <code>user@bms.local</code>) exist out of the box — see <a href="#" onClick={(e) => { e.preventDefault(); setActiveTopic('security'); }}>Security &amp; Roles</a> for how login actually works.
            </div>
          </div>
        );
      case 'quickstart':
        return (
          <div className="animate-fade-in">
            <h1>Quick Start Guide</h1>
            <p>Get up and running with the BMS Analytics portal in three steps.</p>

            <OnThisPage items={[{ id: 'qs-auth', label: '1. Authentication' }, { id: 'qs-data', label: '2. Loading Data' }, { id: 'qs-explore', label: '3. Exploring Insights' }]} />

            <h3 id="qs-auth">1. Authentication</h3>
            <p>On the login screen, either sign in with real credentials or use one of the two <strong>Quick Login</strong> demo buttons: <strong>Admin</strong> (full fleet access) or <strong>User</strong> (assigned devices only). There is no separate "Engineer" role in this build — if you've seen that mentioned elsewhere, it's stale; the platform has exactly two roles, admin and user.</p>

            <h3 id="qs-data">2. Loading Data</h3>
            <p>The fastest way to see the platform in action is <strong>Upload &amp; Analyze</strong> (admin-only, left sidebar) — drop one or more CSV telemetry logs, or pick a bundled sample dataset (there are four: a healthy pack, a cell-imbalance/thermal anomaly pack, a lab cycling-degradation log, and a comprehensive demo pack that exercises every tab in one file). A new battery is created and analyzed automatically — no device setup required. See the diagram in <a href="#" onClick={(e) => { e.preventDefault(); setActiveTopic('architecture'); }}>Architecture &amp; Workflow</a> for exactly what happens on submit.</p>

            <h3 id="qs-explore">3. Exploring Insights</h3>
            <p>Once a battery has data, select it from the <strong>Device View</strong> picker in the left sidebar to unlock its tabs:</p>
            <ul>
              <li><strong>Real-Time Live:</strong> Current pack voltage/current/SOC/SOH and live per-cell readings.</li>
              <li><strong>Device History:</strong> Paginated historical telemetry with CSV export.</li>
              <li><strong>Cell Analysis:</strong> An interactive 3D pack viewer and voltage/temperature distribution, sized to however many per-cell columns your CSV actually provided.</li>
              <li><strong>GPS Tracking:</strong> Live position + historical trace for this one battery (see the fleet-wide equivalent in <a href="#" onClick={(e) => { e.preventDefault(); setActiveTopic('fleet-map'); }}>Fleet Map</a>).</li>
              <li><strong>Degradation, Data Quality, Thermal, Findings, Alerts:</strong> The analytics tabs proper — anomaly detection, SOH/capacity-fade trend, thermal condition, and a rolled-up automated-findings report.</li>
              <li><strong>Reports:</strong> Compile the above into a downloadable PDF.</li>
              <li><strong>Data Sources</strong> (topbar database icon, once a battery is selected): every CSV ever imported into this battery, with a timestamp, an include/exclude toggle, and delete — see <a href="#" onClick={(e) => { e.preventDefault(); setActiveTopic('data-sources'); }}>Upload History &amp; Data Sources</a>.</li>
            </ul>
          </div>
        );
      case 'architecture':
        return (
          <div className="animate-fade-in">
            <h1>Architecture & Analytics Workflow</h1>
            <p>The BMS Analytics Platform ingests raw BMS telemetry and converts it into actionable vehicle-control/calibration outputs.</p>

            <OnThisPage items={[{ id: 'arch-upload-flow', label: 'Upload & Analyze — the primary flow' }, { id: 'arch-e2e', label: 'End-to-End Workflow' }, { id: 'arch-deploy', label: 'Deployment Architectures' }]} />

            <h2 id="arch-upload-flow">Upload &amp; Analyze — the primary flow</h2>
            <p>This is the platform's main entry point: no device has to exist beforehand. It supports more than one CSV per upload, since a real battery's telemetry often arrives as several logs rather than a single file.</p>
            <DeploymentDiagram
              title="Upload & Analyze (/app/upload)"
              description="Every CSV added is parsed in the browser far enough to preview its signals before anything is sent to the backend; only files left toggled 'Include' are actually imported."
            >
              <DiagBox title="1. Add CSV(s)" subtitle="drag/drop, sample dataset, or file picker — one or many" />
              <DiagArrow />
              <DiagBox title="2. Preview & toggle" subtitle="detected signals per file · include / view / remove" accent="var(--accent-primary)" />
              <DiagArrow />
              <DiagBox title="3. Create battery" subtitle="device sized from cell/thermistor count" />
              <DiagArrow />
              <DiagBox title="4. Import each file" subtitle="in order, into the same device" />
              <DiagArrow />
              <DiagBox title="5. Automated Report" subtitle="Findings tab, generated instantly" accent="var(--accent-primary)" />
            </DeploymentDiagram>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>All of a battery's CSVs are imported at creation time, in one Upload &amp; Analyze session — there's currently no separate "add more history to an existing battery" flow in the UI. Once imported, each file becomes a row in that battery's <a href="#" onClick={(e) => { e.preventDefault(); setActiveTopic('data-sources'); }}>Data Sources panel</a>, where it can be toggled out of the dashboard or deleted, but not replaced with a newer version.</p>

            <h2 id="arch-e2e">End-to-End Workflow</h2>
            <div style={{ background: 'var(--bg-sidebar)', color: '#fff', padding: '1.5rem', borderRadius: 'var(--radius-md)', overflowX: 'auto', marginBottom: '2rem' }}>
              <pre style={{ fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: '1.2' }}>{`        BMS / Cell Data
              │
              ▼
         CSV Upload
              │
              ▼
       Data Validation
              │
              ▼
       Data Processing
              │
              ▼
      ┌───────┼────────┐
      ▼       ▼        ▼
    Cell    Battery   Thermal
  Analytics Analytics Analytics
      │       │        │
      └───────┼────────┘
              ▼
     Degradation / SOH
          Analytics
              │
              ▼
       Anomaly Detection
              │
              ▼
       Analytics Outputs
              │
       ┌──────┴──────┐
       ▼             ▼
   Dashboard     Report / CSV
       │
       ▼
BMS / Calibration / Vehicle-Control Evaluation`}</pre>
            </div>

            <h2 id="arch-deploy">Deployment Architectures</h2>
            <p>The analytics models can be deployed in three distinct configurations depending on latency and storage requirements. This MVP demonstrates the analytics logic using uploaded CSVs (equivalent to the On-Board path, running in-browser); the same processing could run unchanged in any of the three configurations below.</p>

            <DeploymentDiagram
              title="On-Board Analytics"
              description="Processes data locally on the vehicle for low-latency outputs feeding vehicle-level decisions directly."
            >
              <DiagBox title="Battery" />
              <DiagArrow />
              <DiagBox title="BMS" />
              <DiagArrow />
              <DiagBox title="Analytics Model" subtitle="on-board compute" accent="var(--accent-primary)" />
              <DiagArrow />
              <DiagBox title="Vehicle Control" />
            </DeploymentDiagram>

            <DeploymentDiagram
              title="Cloud Analytics"
              description="Suitable for fleet monitoring, long-term degradation analysis, and engineering investigations where latency is less critical."
            >
              <DiagBox title="Battery → BMS" subtitle="vehicle data" />
              <DiagArrow />
              <DiagBox title="Cloud" subtitle="Analytics Engine" accent="var(--accent-primary)" />
              <DiagArrow />
              <DiagBox title="Health / Degradation" />
              <DiagArrow />
              <DiagBox title="Engineering Dashboard" />
            </DeploymentDiagram>

            <DeploymentDiagram
              title="Hybrid Architecture"
              description="Edge compute handles time-critical anomaly detection on-board, while the cloud processes historical degradation, SOH prediction, and fleet-wide trends."
            >
              <DiagBox title="Battery → BMS" subtitle="vehicle data" />
              <DiagArrow />
              <DiagBox title="On-Board Analytics" subtitle="real-time" accent="var(--accent-primary)" />
              <DiagArrow />
              <DiagBox title="Cloud" subtitle="fleet & degradation monitoring" accent="var(--accent-primary)" />
            </DeploymentDiagram>
          </div>
        );
      case 'data-format':
        return (
          <div className="animate-fade-in">
            <h1>CSV Data Format Specification</h1>
            <p>The importer matches columns by <strong>keyword, case-insensitively</strong> — your header doesn't need to be an exact name, just contain the right word (e.g. <code>pack_volt</code>, <code>PackVoltage_V</code>, and <code>Total Pack Voltage</code> all match). This table reflects the actual column-sniffing logic in <code>backend/routers/telemetry.py</code>, not an aspirational spec.</p>

            <OnThisPage items={[{ id: 'fmt-columns', label: 'Recognized Columns' }, { id: 'fmt-cells', label: 'Cell-Level Data' }, { id: 'fmt-limits', label: 'Import Limits' }]} />

            <h2 id="fmt-columns">Recognized Columns</h2>
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Column Header (or contains)</th>
                  <th>Data Type</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>Timestamp</code> (contains "time" or "date")</td>
                  <td>ISO date string</td>
                  <td>Parsed with pandas' flexible date parser. Missing/unparseable → the import timestamp is used instead.</td>
                </tr>
                <tr>
                  <td><code>Pack_Voltage</code></td>
                  <td>Float</td>
                  <td>Total pack voltage in Volts (V). Matches any "volt" column that isn't also a per-cell one.</td>
                </tr>
                <tr>
                  <td><code>Pack_Current</code></td>
                  <td>Float</td>
                  <td>Pack current in Amperes (A). Positive = charging, negative = discharging.</td>
                </tr>
                <tr>
                  <td><code>SOC</code></td>
                  <td>Float</td>
                  <td>State of Charge, 0–100%.</td>
                </tr>
                <tr>
                  <td><code>SOH</code></td>
                  <td>Float</td>
                  <td>State of Health, 0–100%.</td>
                </tr>
                <tr>
                  <td><code>Latitude</code> / <code>Longitude</code></td>
                  <td>Float</td>
                  <td>GPS fix for this row — feeds GPS Tracking and the Fleet Map. Omit both for rows without a fix; there's no separate standalone "Temperature" pack-level column (thermal data comes from the per-cell columns below).</td>
                </tr>
                <tr>
                  <td><code>Cycle_Number</code> / <code>Capacity_Ah</code></td>
                  <td>Integer / Float</td>
                  <td>Lab-cycling test logs — one row per charge/discharge cycle, with the pack's actual measured capacity at that cycle. Optional; only meaningful for cycling-bench data.</td>
                </tr>
              </tbody>
            </table>

            <h2 id="fmt-cells">Cell-Level Data (Optional)</h2>
            <p>If your logs include individual cell voltages, name the columns <code>Cell1_Voltage</code>, <code>Cell2_Voltage</code>, etc. — the portal reads whatever number of cell columns are actually present, not a fixed count, and auto-detects V vs mV (a value under 100 is treated as Volts and converted). Per-cell temperatures follow the same pattern with <code>Cell1_Temp</code>, <code>Cell2_Temp</code>, etc. If these columns are omitted, cell-level views clearly report that no per-cell data is available rather than inventing balanced cell readings.</p>

            <h2 id="fmt-limits">Import Limits</h2>
            <p>This demo deployment caps a single CSV import at the first <strong>1,000 rows</strong> (the response reports how many of a larger file were actually accepted) and a history export at <strong>100,000 rows</strong>. A malformed individual row is skipped, logged, and doesn't fail the rest of the import.</p>

            <div className="doc-note">
              <strong>Note:</strong> This exact schema is also documented inline on the <strong>Upload &amp; Analyze</strong> page itself — this page just explains the "why" behind it.
            </div>
          </div>
        );
      case 'data-sources':
        return (
          <div className="animate-fade-in">
            <h1>Upload History &amp; Data Sources</h1>
            <p className="doc-lead">Every CSV imported into a battery is kept as a permanent, auditable record — separate from the pre-upload preview you see on the Upload &amp; Analyze page itself.</p>

            <OnThisPage items={[{ id: 'ds-vs-preview', label: 'Not the same as the upload preview' }, { id: 'ds-panel', label: 'The Data Sources panel' }, { id: 'ds-toggle', label: 'Include / exclude vs. delete' }]} />

            <h2 id="ds-vs-preview">Not the same as the upload preview</h2>
            <p>On <strong>Upload &amp; Analyze</strong>, the Eye/Include/Trash controls only apply to files you're about to submit — before a battery even exists. Once a battery has been created and its files imported, that page has nothing more to say about them. The <strong>Data Sources</strong> panel is the separate, persistent answer to "which CSVs are actually feeding this battery's dashboard right now, and when were they uploaded?"</p>

            <h2 id="ds-panel">The Data Sources panel</h2>
            <p>Select any battery from the sidebar's Device View picker, then click the database icon in the top bar (a small badge shows how many CSVs have been imported). For each import batch, the panel shows:</p>
            <ul>
              <li><strong>Filename</strong> and a relative <strong>upload timestamp</strong> ("2h ago", etc.), recorded the moment the file was submitted.</li>
              <li><strong>Row count</strong> actually written (and how many rows were skipped as malformed, if any).</li>
              <li><strong>Status:</strong> Processing (import runs in the background), Completed, or Failed.</li>
              <li><strong>View:</strong> expand to see the detected signals (voltage/current/SOC/SOH/cells/GPS) and a sample of the actual imported rows, without needing to re-open the original file.</li>
              <li><strong>Include / Exclude</strong> and <strong>Delete</strong> — see below.</li>
            </ul>

            <h2 id="ds-toggle">Include / exclude vs. delete</h2>
            <p><strong>Exclude</strong> is a soft, reversible hide: the batch's rows are skipped by every analytics view (Real-Time, History, Degradation, Thermal, Findings, GPS Tracking, the Fleet Map) without touching the data itself — useful for a bad or duplicate upload you want out of the picture without losing it. Toggling it back to <strong>Include</strong> restores it everywhere instantly. <strong>Delete</strong> is permanent: it removes the batch record and every telemetry row it wrote, with no undo — a confirmation step guards against an accidental click.</p>

            <div className="doc-note">
              <strong>Note:</strong> Excluding or deleting a batch never affects data written by other sources (the live simulator, or other CSV batches) for the same battery — only that one file's rows.
            </div>
          </div>
        );
      case 'outputs':
        return (
          <div className="animate-fade-in">
            <h1>Analytics Outputs → Vehicle-Control & Calibration</h1>
            <p>Each analytics output below is a <strong>diagnostic/monitoring signal</strong> that could plausibly feed a BMS, vehicle-control, or calibration workflow. None of these outputs directly control the vehicle in this MVP — that requires a separate, validated control interface consuming them.</p>

            <OnThisPage items={[{ id: 'out-table', label: 'Output → Application mapping' }]} />

            <table id="out-table" className="doc-table">
              <thead>
                <tr>
                  <th>Analytics Output</th>
                  <th>Potential Vehicle-Control / Calibration Application</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>SOC</td><td>Charging limit optimization, remaining-range estimation</td></tr>
                <tr><td>SOH / Estimated Capacity</td><td>End-of-life prediction, preventive maintenance scheduling</td></tr>
                <tr><td>Capacity Fade / Degradation Rate</td><td>BMS calibration, fleet health scoring</td></tr>
                <tr><td>Cell Voltage Imbalance</td><td>Battery protection strategies, cell-balancing triggers</td></tr>
                <tr><td>Cell Temperature Deviation</td><td>Thermal-management strategy, derating decisions</td></tr>
                <tr><td>Thermal Condition (max/avg pack temp)</td><td>Discharge/power-limit decisions, cooling activation</td></tr>
                <tr><td>Anomaly / Fault Indicators</td><td>Vehicle performance management, protection interlocks</td></tr>
                <tr><td>Unusual Current Behavior</td><td>Discharge/power-limit decisions, load-shedding triggers</td></tr>
                <tr><td>Battery Health Status (Healthy/Warning/Critical)</td><td>Fleet battery monitoring, dispatch prioritization</td></tr>
              </tbody>
            </table>

            <div className="doc-note">
              <strong>Note:</strong> The "Findings &amp; Outputs" tab in the portal shows this same mapping filtered to what the
              currently loaded CSV actually supports — an output only shows as "Available" there when the required signal was
              found in the source data.
            </div>
          </div>
        );
      case 'roles':
        return (
          <div className="animate-fade-in">
            <h1>Roles &amp; Device Assignment</h1>
            <p className="doc-lead">This is the standard model used by fleet-telematics platforms generally (vehicle trackers, industrial IoT fleets, etc.), not something specific to batteries: one operations layer with full visibility, and named end-users scoped to only the assets they're responsible for.</p>

            <OnThisPage items={[{ id: 'roles-model', label: 'The model: Admin vs. User' }, { id: 'roles-assign', label: 'How a battery gets assigned to a user' }, { id: 'roles-common-q', label: 'Common question: is a "User" one cell?' }]} />

            <h2 id="roles-model">The model: Admin vs. User</h2>
            <div className="doc-card-grid">
              <div className="doc-card">
                <h4>Admin</h4>
                <p>Full fleet access — every battery, regardless of assignment. Registers devices (Device Registry), creates users and assigns/unassigns devices to them (User Management), uploads new data (Upload &amp; Analyze), and sees the Fleet Map and Fleet Alerts across the whole fleet.</p>
              </div>
              <div className="doc-card">
                <h4>User</h4>
                <p>Sees only the battery packs explicitly assigned to them — zero, one, or many. Full real-time/historical data, reports, alerts, and the Data Sources panel for each assigned battery. No fleet-wide list, no other users' batteries, no user management, no Fleet Map, no upload access.</p>
              </div>
            </div>

            <h2 id="roles-assign">How a battery gets assigned to a user</h2>
            <p>An admin creates the user (email, name, initial password, role) in <strong>User Management</strong>, then uses the "+ Assign…" control on that user's row to attach one or more registered batteries to them — the same page shows every currently-assigned battery per user with a one-click remove. This is enforced identically on the backend (every device-scoped API call re-checks the assignment — a user can't reach an unassigned battery's data by guessing its URL) and the frontend (route guards, the Device View picker only lists assigned batteries).</p>

            <h2 id="roles-common-q">Common question: is a "User" one cell?</h2>
            <p>No — the smallest unit a user can be scoped to is one <strong>battery pack</strong> (a device, made up of many individual cells), not an individual cell within a pack. A "User" in this platform reads more like a fleet operator, technician, or site owner who's responsible for a specific set of battery packs, while an "Admin" is the fleet manager with visibility into everything. If your organization needs finer-grained access than "which packs", that would be a new, currently-unbuilt capability layered on top of this model — not something this platform does today.</p>
          </div>
        );
      case 'fleet-map':
        return (
          <div className="animate-fade-in">
            <h1>Fleet Map</h1>
            <p className="doc-lead">Admin-only. Plots every registered battery pack on one map, so an admin can see where their whole fleet actually is at a glance instead of paging through a table.</p>

            <OnThisPage items={[{ id: 'map-where-from', label: 'Where a pin\'s location comes from' }, { id: 'map-color', label: 'What the pin color means' }, { id: 'map-no-location', label: 'Batteries with no location set' }]} />

            <h2 id="map-where-from">Where a pin's location comes from</h2>
            <p>Each battery is plotted at its most recent real GPS fix if it has one (from a CSV with Latitude/Longitude columns, or the live simulator), falling back to its fixed <strong>home location</strong> — a one-time coordinate set on the battery in Device Registry when it doesn't report live GPS at all (e.g. a stationary installation, or a pack whose telemetry logs never include a position). The map itself is OpenStreetMap tiles — no API key, no per-view cost, consistent with the single-device GPS Tracking tab's zero-dependency approach.</p>

            <h2 id="map-color">What the pin color means</h2>
            <p>Pin color mirrors the same device status shown elsewhere in the portal (Fleet Overview's status badge, Device Registry): green = active, amber = maintenance, red = fault, gray = inactive. Click a pin for a quick summary (pack name, serial number, status, SOC) and a link straight to that battery's Real-Time tab.</p>

            <h2 id="map-no-location">Batteries with no location set</h2>
            <p>A battery with neither a live GPS fix nor a home location isn't guessed at or plotted at (0,0) — it's listed separately below the map with a shortcut to set its home location in Device Registry.</p>
          </div>
        );
      case 'security':
        return (
          <div className="animate-fade-in">
            <h1>Security & Role-Based Access</h1>
            <p>The platform employs Role-Based Access Control (RBAC), enforced on both the frontend (route guards) and the backend (every request re-checks the caller's role and device assignments — the UI never has to be trusted). For the full mental model of how Admin/User actually works day to day, see <a href="#" onClick={(e) => { e.preventDefault(); setActiveTopic('roles'); }}>Roles &amp; Device Assignment</a> — this page focuses on the authentication mechanics.</p>

            <OnThisPage items={[{ id: 'sec-roles', label: 'Available Roles' }, { id: 'sec-auth', label: 'How authentication works' }]} />

            <h2 id="sec-roles">Available Roles</h2>
            <div className="doc-card-grid">
              <div className="doc-card">
                <h4>Admin</h4>
                <p>Full fleet access. Registers devices, manages users and device assignments, uploads new data via Upload &amp; Analyze, and can view/acknowledge alerts across the whole fleet.</p>
              </div>
              <div className="doc-card">
                <h4>User</h4>
                <p>Scoped to their assigned devices only (set by an admin via User Management). Can view real-time and historical data, reports, and alerts for those devices — no fleet-wide visibility, user management, or upload access.</p>
              </div>
            </div>

            <h2 id="sec-auth">How authentication works</h2>
            <p>Authentication is real, backend-issued and verified JWT — not a demo/mock token. Passwords are bcrypt-hashed at rest; login exchanges credentials for a signed token (<code>POST /api/v1/auth/login</code>) that's attached as a Bearer header on every subsequent API call and re-validated server-side (including a live re-check that the account is still active) rather than trusted at face value from the client.</p>

            <div className="doc-note">
              <strong>Note:</strong> The login page's "Quick Login" buttons sign in as one of two seeded demo accounts (<code>admin@bms.local</code> / <code>user@bms.local</code>) for this public demo instance — see <code>backend/seed.py</code>.
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="docs-layout">
      {/* Top Navbar */}
      <header className="docs-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn-ghost" onClick={onBack} style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
            <ArrowLeft size={16} /> Back to App
          </button>
          <div style={{ width: '1px', height: '24px', background: 'var(--border-default)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Zap size={18} color="var(--accent-primary)" />
            <span style={{ fontWeight: '600', fontFamily: "'Outfit', sans-serif" }}>BMS Documentation</span>
          </div>
        </div>
        <div className="docs-search">
          <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search documentation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </header>

      <div className="docs-body">
        {/* Sidebar */}
        <aside className="docs-sidebar">
          <div className="docs-sidebar-title">Documentation</div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {filteredTopics.length === 0 ? (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.5rem' }}>No topics match "{searchQuery}".</div>
            ) : (
              filteredTopics.map(topic => (
                <button
                  key={topic.id}
                  className={`docs-nav-btn ${activeTopic === topic.id ? 'active' : ''}`}
                  onClick={() => setActiveTopic(topic.id)}
                >
                  {topic.icon} {topic.label}
                </button>
              ))
            )}
          </nav>
        </aside>

        {/* Content */}
        <main className="docs-content">
          <div className="docs-content-inner">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}
