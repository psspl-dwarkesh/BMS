import { useState } from 'react';
import { ArrowLeft, BookOpen, Terminal, Database, Shield, Zap, Search, Link2 } from 'lucide-react';
import '../docs.css';

const DOC_TOPICS = [
  { id: 'intro', label: 'Introduction', icon: <BookOpen size={16} /> },
  { id: 'quickstart', label: 'Quick Start', icon: <Terminal size={16} /> },
  { id: 'architecture', label: 'Architecture & Workflow', icon: <Database size={16} /> },
  { id: 'data-format', label: 'CSV Data Format', icon: <Database size={16} /> },
  { id: 'outputs', label: 'Outputs → Vehicle Control', icon: <Link2 size={16} /> },
  { id: 'security', label: 'Security & Roles', icon: <Shield size={16} /> },
];

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

  const renderContent = () => {
    switch (activeTopic) {
      case 'intro':
        return (
          <div className="animate-fade-in">
            <h1>Introduction to BMS Analytics</h1>
            <p className="doc-lead">The enterprise-grade intelligence layer for battery fleets. Our platform transforms raw CSV logs from your Battery Management Systems into actionable health insights and predictive diagnostics.</p>
            
            <h2>Core Capabilities</h2>
            <ul>
              <li><strong>Time-Series Analytics:</strong> Process thousands of data points for voltage, current, and temperature instantly.</li>
              <li><strong>Degradation Modeling:</strong> Track capacity fade and estimate true State of Health (SOH) over time.</li>
              <li><strong>Anomaly Detection:</strong> Automatically flag cell voltage imbalances and thermal events exceeding ISO 26262 standards.</li>
              <li><strong>PDF Reporting:</strong> Generate compliance-ready diagnostic reports in a single click.</li>
            </ul>

            <div className="doc-note">
              <strong>Note:</strong> This portal is currently in Demo mode. All analytics processing happens securely within your browser session.
            </div>
          </div>
        );
      case 'quickstart':
        return (
          <div className="animate-fade-in">
            <h1>Quick Start Guide</h1>
            <p>Get up and running with the BMS Analytics portal in three simple steps.</p>
            
            <h3>1. Authentication</h3>
            <p>Navigate to the login screen and select a role. For exploring all features, select the <strong>Admin</strong> or <strong>Engineer</strong> role.</p>
            
            <h3>2. Loading Data</h3>
            <p>Upon login, the system will automatically parse a sample 50-cycle dataset. If you wish to upload your own data, navigate to the <strong>Data Upload</strong> tab and select a valid `.csv` file.</p>

            <h3>3. Exploring Insights</h3>
            <p>Once data is loaded, navigate through the sidebar to view:</p>
            <ul>
              <li><strong>Dashboard:</strong> High-level KPIs and circular gauges for Pack SOC and Temperature.</li>
              <li><strong>Cell Analysis:</strong> An interactive 3D pack viewer and voltage/temperature distribution charts, sized to however many per-cell columns your CSV actually provides.</li>
              <li><strong>Reports:</strong> Compile your findings into a downloadable PDF document.</li>
            </ul>
          </div>
        );
      case 'architecture':
        return (
          <div className="animate-fade-in">
            <h1>Architecture & Analytics Workflow</h1>
            <p>The BMS Analytics Platform is designed to ingest raw BMS telemetry and convert it into actionable vehicle-control/calibration outputs.</p>
            
            <h2>End-to-End Workflow</h2>
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

            <h2>Deployment Architectures</h2>
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
            <p>To ensure accurate analytics, uploaded CSV logs must adhere to the following schema structure. The parser is flexible but requires specific column keywords.</p>
            
            <h2>Required Columns</h2>
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
                  <td><code>Timestamp</code> / <code>Time</code></td>
                  <td>Integer / Float</td>
                  <td>Relative time in seconds or absolute epoch.</td>
                </tr>
                <tr>
                  <td><code>Pack_Voltage</code></td>
                  <td>Float</td>
                  <td>Total pack voltage in Volts (V).</td>
                </tr>
                <tr>
                  <td><code>Current</code></td>
                  <td>Float</td>
                  <td>Pack current in Amperes (A). Discharge is negative.</td>
                </tr>
                <tr>
                  <td><code>Temperature</code> / <code>Temp</code></td>
                  <td>Float</td>
                  <td>Maximum pack temperature in Celsius (°C).</td>
                </tr>
                <tr>
                  <td><code>SOC</code></td>
                  <td>Float</td>
                  <td>State of Charge percentage (0-100).</td>
                </tr>
              </tbody>
            </table>

            <h2>Cell-Level Data (Optional)</h2>
            <p>If your logs include individual cell voltages, name the columns <code>Cell1_Voltage</code>, <code>Cell2_Voltage</code>, etc. — the portal reads whatever number of cell columns are actually present (not a fixed count). Per-cell temperatures follow the same pattern with <code>Cell1_Temp</code>, <code>Cell2_Temp</code>, etc. If these columns are omitted, cell-level views clearly report that no per-cell data is available rather than inventing balanced cell readings.</p>
          </div>
        );
      case 'outputs':
        return (
          <div className="animate-fade-in">
            <h1>Analytics Outputs → Vehicle-Control & Calibration</h1>
            <p>Each analytics output below is a <strong>diagnostic/monitoring signal</strong> that could plausibly feed a BMS, vehicle-control, or calibration workflow. None of these outputs directly control the vehicle in this MVP — that requires a separate, validated control interface consuming them.</p>

            <table className="doc-table">
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
      case 'security':
        return (
          <div className="animate-fade-in">
            <h1>Security & Role-Based Access</h1>
            <p>The platform employs strict Role-Based Access Control (RBAC) to ensure data integrity and operational safety.</p>
            
            <h2>Available Roles</h2>
            <div className="doc-card-grid">
              <div className="doc-card">
                <h4>Admin</h4>
                <p>Full system access. Can modify organization settings, manage user access control, and view all fleet data.</p>
              </div>
              <div className="doc-card">
                <h4>Engineer</h4>
                <p>Standard operational access. Can upload new CSV datasets, generate reports, and configure personal notification settings.</p>
              </div>
              <div className="doc-card">
                <h4>Viewer</h4>
                <p>Read-only access. Restricted from uploading new data or modifying any settings. Can only view dashboards and download reports.</p>
              </div>
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
          <input type="text" placeholder="Search documentation..." />
        </div>
      </header>

      <div className="docs-body">
        {/* Sidebar */}
        <aside className="docs-sidebar">
          <div className="docs-sidebar-title">Documentation</div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {DOC_TOPICS.map(topic => (
              <button
                key={topic.id}
                className={`docs-nav-btn ${activeTopic === topic.id ? 'active' : ''}`}
                onClick={() => setActiveTopic(topic.id)}
              >
                {topic.icon} {topic.label}
              </button>
            ))}
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
