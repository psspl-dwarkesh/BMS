import {
  FileSearch, CheckCircle2, AlertTriangle, ShieldAlert, ClipboardList, Cpu, Link2
} from 'lucide-react';

const STATUS_COLOR = { Healthy: 'var(--success)', Warning: 'var(--warning)', Critical: 'var(--danger)' };
const TIER_BADGE = { Good: 'badge-success', Limited: 'badge-warning', Insufficient: 'badge-danger' };
const SEVERITY_ICON = { info: CheckCircle2, warning: AlertTriangle, critical: ShieldAlert };
const SEVERITY_COLOR = { info: 'var(--success)', warning: 'var(--warning)', critical: 'var(--danger)' };

// Static reference: how each analytics output could plausibly feed a
// vehicle-control / calibration decision. This mapping is general engineering
// knowledge (per the requirement doc's §5), not a per-dataset computation -
// each row is only shown "available" when this session's data actually
// supports producing that output, so the mapping never implies more than
// what was just computed.
const OUTPUT_USE_CASES = [
  { output: 'SOC', check: (d) => !!d.signalsAvailable?.soc, use: 'Charging limit optimization, remaining-range estimation' },
  // SOH counts as available whenever we can produce a figure at all - measured
  // from a CSV column, or estimated via Coulomb-counting/EKF - matching what
  // the SOH KPI card above actually shows.
  { output: 'SOH / Capacity Fade', check: (d) => d.kpis.pack.estimatedSOH !== null, use: 'End-of-life prediction, preventive maintenance scheduling' },
  // Same logic as the Degradation tab: a trend needs at least two logged points.
  { output: 'Degradation Rate', check: (d) => (d.degradationSeries?.length || 0) >= 2, use: 'BMS calibration, fleet health scoring' },
  { output: 'Cell Voltage Imbalance', check: (d) => !!d.signalsAvailable?.cellVoltage, use: 'Battery protection strategies, cell-balancing triggers' },
  { output: 'Cell Temperature Deviation', check: (d) => !!d.signalsAvailable?.cellTemperature, use: 'Thermal-management strategy, derating decisions' },
  { output: 'Thermal Condition', check: (d) => !!d.signalsAvailable?.temperature, use: 'Discharge/power-limit decisions, cooling activation' },
  // The anomaly engine runs as long as it has at least one underlying signal
  // to check thresholds against - it doesn't require every signal at once.
  { output: 'Anomaly / Fault Indicators', check: (d) => !!(d.signalsAvailable?.voltage || d.signalsAvailable?.current || d.signalsAvailable?.temperature || d.signalsAvailable?.cellVoltage), use: 'Vehicle performance management, protection interlocks' },
];

export default function AutomatedFindings({ data }) {
  if (!data) {
    return (
      <div className="animate-fade-in" style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
        <FileSearch size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
        <p>No dataset loaded. Upload a CSV to generate the automated analytics report.</p>
      </div>
    );
  }

  const { kpis, status, dataQuality, findings = [], signalsAvailable = {}, degradationSeries = [] } = data;
  const pack = kpis.pack;
  const fmt = (v, d = 1) => (v === null || v === undefined || isNaN(v)) ? 'N/A' : Number(v).toFixed(d);

  const requiredSignals = [
    { label: 'Pack Voltage', available: signalsAvailable.voltage },
    { label: 'Pack Current', available: signalsAvailable.current },
    { label: 'Pack Temperature', available: signalsAvailable.temperature },
    { label: 'SOC', available: signalsAvailable.soc },
    { label: 'Cell Voltage', available: signalsAvailable.cellVoltage },
    { label: 'Cell Temperature', available: signalsAvailable.cellTemperature },
    { label: 'Cycle Number', available: signalsAvailable.cycle },
    { label: 'SOH / Capacity', available: signalsAvailable.capacity || signalsAvailable.soh },
  ];

  return (
    <div className="animate-fade-in">
      {/* Battery / Data Quality Status */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <div>
            <div className="card-title">Automated Analytics Report</div>
            <div className="card-subtitle">Auto-generated summary of this dataset's analytics run</div>
          </div>
          <ClipboardList size={20} color="var(--accent-primary)" />
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div>
            <div className="stat-label">Battery</div>
            <div className="stat-value" style={{ color: STATUS_COLOR[status] || 'var(--text-primary)' }}>{status}</div>
          </div>
          <div>
            <div className="stat-label">Data Quality</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem' }}>
              <span className={`badge ${TIER_BADGE[dataQuality.tier] || 'badge-neutral'}`}>{dataQuality.tier}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{dataQuality.score}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Key KPIs */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-title" style={{ marginBottom: '1rem' }}>Key KPIs</div>
        <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="card" style={{ background: 'var(--bg-secondary)', border: 'none' }}>
            <div className="stat-label">SOH</div>
            <div className="stat-value">{pack.estimatedSOH === null ? 'N/A' : `${pack.estimatedSOH}%`}</div>
            <div className="stat-detail">{pack.estimatedSOH === null ? 'Insufficient data' : (pack.estimatedSOHIsEstimate ? 'Estimated' : 'Measured')}</div>
          </div>
          <div className="card" style={{ background: 'var(--bg-secondary)', border: 'none' }}>
            <div className="stat-label">Cycle Count</div>
            <div className="stat-value">{degradationSeries.length > 0 ? degradationSeries[degradationSeries.length - 1].cycle : 'N/A'}</div>
          </div>
          <div className="card" style={{ background: 'var(--bg-secondary)', border: 'none' }}>
            <div className="stat-label">Energy (Chg / Dischg)</div>
            <div className="stat-value" style={{ fontSize: '1.1rem' }}>{fmt(pack.energyChargedKWh, 2)} / {fmt(pack.energyDischargedKWh, 2)} <span className="stat-unit">kWh</span></div>
          </div>
          <div className="card" style={{ background: 'var(--bg-secondary)', border: 'none' }}>
            <div className="stat-label">Temp Range</div>
            <div className="stat-value" style={{ fontSize: '1.1rem' }}>{fmt(pack.minTemp)}–{fmt(pack.maxTemp)}<span className="stat-unit">°C</span></div>
          </div>
          <div className="card" style={{ background: 'var(--bg-secondary)', border: 'none' }}>
            <div className="stat-label">Cell Voltage Spread</div>
            <div className="stat-value" style={{ fontSize: '1.1rem' }}>{pack.maxCellVoltageSpread !== null ? `${(pack.maxCellVoltageSpread * 1000).toFixed(0)}mV` : 'N/A'}</div>
          </div>
          <div className="card" style={{ background: 'var(--bg-secondary)', border: 'none' }}>
            <div className="stat-label">Cell Temp Spread</div>
            <div className="stat-value" style={{ fontSize: '1.1rem' }}>{pack.maxCellTempSpread !== null && pack.maxCellTempSpread !== undefined ? `${fmt(pack.maxCellTempSpread)}°C` : 'N/A'}</div>
          </div>
        </div>
      </div>

      {/* Key Findings */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-title" style={{ marginBottom: '1rem' }}>Key Findings</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {findings.map((f, idx) => {
            const Icon = SEVERITY_ICON[f.severity] || CheckCircle2;
            const color = SEVERITY_COLOR[f.severity] || 'var(--text-secondary)';
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '0.65rem 0.85rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                <Icon size={16} color={color} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                <div style={{ fontSize: '0.85rem' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{f.category}:</strong>{' '}
                  <span style={{ color: 'var(--text-secondary)' }}>{f.text}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Integration View */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Integration View</div>
            <div className="card-subtitle">Required BMS signals, analytics location, and potential vehicle-control applications</div>
          </div>
          <Cpu size={20} color="var(--accent-primary)" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div>
            <h4 style={{ marginBottom: '0.75rem', fontSize: '0.85rem', color: 'var(--text-primary)' }}>Required BMS Signals</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {requiredSignals.map((s) => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                  {s.available ? <CheckCircle2 size={14} color="var(--success)" /> : <AlertTriangle size={14} color="var(--text-muted)" />}
                  <span style={{ color: s.available ? 'var(--text-primary)' : 'var(--text-muted)' }}>{s.label}</span>
                  <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{s.available ? 'available' : 'not in this CSV'}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 style={{ marginBottom: '0.75rem', fontSize: '0.85rem', color: 'var(--text-primary)' }}>Analytics Location</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              This run executed as <strong>on-board-style</strong> analytics (client-side, in-browser). The same processing
              logic could run unchanged on an embedded controller (On-Board), a fleet backend (Cloud), or split across
              both (Hybrid) — see the Architecture doc for details on each deployment option.
            </p>
          </div>
        </div>

        <h4 style={{ marginBottom: '0.75rem', fontSize: '0.85rem', color: 'var(--text-primary)' }}>Available Outputs → Potential Vehicle-Control Applications</h4>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr><th>Output</th><th>Status (this dataset)</th><th>Potential Use</th></tr>
            </thead>
            <tbody>
              {OUTPUT_USE_CASES.map((row) => {
                const available = row.check(data);
                return (
                  <tr key={row.output}>
                    <td style={{ fontWeight: 500 }}>{row.output}</td>
                    <td>
                      <span className={`badge ${available ? 'badge-success' : 'badge-neutral'}`}>
                        {available ? 'Available' : 'Not available'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{row.use}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <Link2 size={14} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
          These outputs are diagnostic/monitoring signals only — they do not directly control the vehicle unless a
          validated control interface consumes them.
        </div>
      </div>
    </div>
  );
}
