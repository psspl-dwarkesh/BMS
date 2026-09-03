import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { Battery, Zap, Thermometer, Activity, AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Percent, Gauge } from 'lucide-react';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: '#fff', padding: '0.75rem 1rem', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-md)', fontSize: '0.8rem' }}>
        <p style={{ margin: '0 0 0.35rem 0', color: 'var(--text-secondary)', fontWeight: '500' }}>Time: {label}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ margin: '0.15rem 0', color: entry.color, fontWeight: '600' }}>
            {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// SVG Circular Gauge Component
const CircularGauge = ({ value, max, label, unit, color, size = 70 }) => {
  const hasValue = typeof value === 'number' && !isNaN(value);
  const pct = hasValue ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ position: 'relative', width: `${size}px`, height: `${size}px` }}>
      <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--bg-panel)" strokeWidth="3" />
        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={color} strokeWidth="3" strokeDasharray={`${pct}, 100`} strokeLinecap="round" style={{ transition: 'stroke-dasharray 1s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: hasValue ? '0.8rem' : '0.65rem', fontWeight: '700', color: hasValue ? 'var(--text-primary)' : 'var(--text-muted)', lineHeight: 1 }}>{hasValue ? value.toFixed(0) : 'N/A'}</span>
        <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>{unit}</span>
      </div>
    </div>
  );
};

// Horizontal Battery Indicator
const BatteryIndicator = ({ percent }) => {
  if (percent === null || percent === undefined || isNaN(percent)) {
    return <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SOC not available in source data</span>;
  }
  const barColor = percent > 50 ? 'var(--success)' : percent > 20 ? 'var(--warning)' : 'var(--danger)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div style={{ position: 'relative', width: '48px', height: '22px' }}>
        <div style={{ width: '44px', height: '22px', border: `2px solid ${barColor}`, borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
          <div style={{ width: `${percent}%`, height: '100%', background: barColor, transition: 'width 1s ease', opacity: 0.85 }} />
        </div>
        <div style={{ position: 'absolute', right: '-4px', top: '6px', width: '4px', height: '10px', background: barColor, borderRadius: '0 2px 2px 0' }} />
      </div>
      <span style={{ fontSize: '0.75rem', fontWeight: '600', color: barColor }}>{percent.toFixed(0)}%</span>
    </div>
  );
};

export default function Dashboard({ data }) {
  const { kpis, timeSeries, anomalies, status } = data;
  const pack = kpis.pack;

  // Optional per-pack metadata (vehicle ID, chemistry, firmware) isn't part of
  // standard BMS telemetry columns, so it's only shown when the CSV actually
  // carries a matching column - never a fabricated fixed value.
  const metaRows = (data.datasets || []).filter(d => d.active !== false).flatMap(d => d.data || []);
  const findMeta = (keywords) => {
    if (metaRows.length === 0) return null;
    const headers = Object.keys(metaRows[0]);
    const key = headers.find(h => keywords.some(kw => h.toLowerCase().includes(kw)));
    if (!key) return null;
    const row = metaRows.find(r => r[key] !== undefined && r[key] !== null && r[key] !== '');
    return row ? String(row[key]) : null;
  };
  const vehicleId = findMeta(['vehicle', 'asset_id', 'assetid', 'pack_id', 'packid']);
  const chemistry = findMeta(['chemistry', 'chem_type', 'cell_chemistry']);
  const firmware = findMeta(['firmware', 'fw_version', 'fwversion']);
  const hasAnyMeta = !!(vehicleId || chemistry || firmware);

  // Temp status - 'Unknown' when the CSV had no temperature signal to judge, so
  // this never silently reports "Normal" for data that simply isn't there.
  const tempStatus = pack.maxTemp === null ? 'Unknown' : pack.maxTemp > 45 ? 'Critical' : pack.maxTemp > 35 ? 'Warning' : 'Normal';
  const tempColor = tempStatus === 'Critical' ? 'var(--danger)' : tempStatus === 'Warning' ? 'var(--warning)' : tempStatus === 'Unknown' ? 'var(--text-muted)' : 'var(--success)';

  const fmtHrs = (hrs) => {
    if (hrs === null || hrs === undefined || isNaN(hrs)) return 'N/A';
    if (hrs < 1) return `${Math.round(hrs * 60)}m`;
    return `${hrs.toFixed(1)}h`;
  };

  // Null-safe numeric formatter for KPIs that may be genuinely absent from the
  // source CSV - shows "N/A" instead of throwing or fabricating a number.
  const fmt = (value, decimals = 1) => (value === null || value === undefined || isNaN(value)) ? 'N/A' : value.toFixed(decimals);

  return (
    <div className="animate-in">
      {/* KPI Cards */}
      <div className="dashboard-grid">
        <div className="card" style={{ borderLeft: '4px solid var(--accent-primary)' }}>
          <div className="stat-label"><Zap size={14} color="var(--accent-primary)" /> Avg Pack Voltage</div>
          <div className="stat-value">{fmt(pack.avgVoltage, 2)}<span className="stat-unit">V</span></div>
          <div className="stat-detail">Min: {fmt(pack.minVoltage)}V · Max: {fmt(pack.maxVoltage)}V</div>
          {pack.voltageSamples === 0 && <div className="stat-detail" style={{ color: 'var(--warning)' }}>No voltage signal found in CSV</div>}
        </div>

        <div className="card" style={{ borderLeft: '4px solid var(--warning)' }}>
          <div className="stat-label"><Activity size={14} color="var(--warning)" /> Avg Pack Current</div>
          <div className="stat-value">{fmt(pack.avgCurrent, 2)}<span className="stat-unit">A</span></div>
          <div className="stat-detail">Min: {fmt(pack.minCurrent)}A · Max: {fmt(pack.maxCurrent)}A</div>
          {pack.currentSamples === 0 && <div className="stat-detail" style={{ color: 'var(--warning)' }}>No current signal found in CSV</div>}
        </div>

        <div className="card" style={{ borderLeft: '4px solid var(--success)' }}>
          <div className="stat-label"><Battery size={14} color="var(--success)" /> State of Charge</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
            <CircularGauge value={pack.finalSOC} max={100} label="SOC" unit="%" color="var(--success)" />
            <div>
              <div className="stat-value" style={{ margin: 0, fontSize: '1.5rem' }}>{fmt(pack.finalSOC)}<span className="stat-unit">%</span></div>
              <div className="stat-detail">
                {pack.estimatedSOH === null
                  ? 'SOH: insufficient data'
                  : <>Est. SOH: {pack.estimatedSOH}%{' '}
                      <span
                        className={`badge ${pack.estimatedSOHIsEstimate ? 'badge-warning' : 'badge-success'}`}
                        style={{ fontSize: '0.6rem', padding: '0.1rem 0.4rem' }}
                        title={pack.estimatedSOHIsEstimate
                          ? 'Modeled via Coulomb-counting/EKF - no SOH or capacity column found in the source CSV'
                          : 'Read directly from a SOH/health column in the source CSV'}
                      >
                        {pack.estimatedSOHIsEstimate ? 'estimated' : 'measured'}
                      </span>
                    </>
                }
              </div>
              <BatteryIndicator percent={pack.finalSOC} />
            </div>
          </div>
        </div>

        <div className="card" style={{ borderLeft: `4px solid ${tempColor}` }}>
          <div className="stat-label"><Thermometer size={14} color={tempColor} /> Max Temperature</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
            <CircularGauge value={pack.maxTemp} max={60} label="Temp" unit="°C" color={tempColor} />
            <div>
              <div className="stat-value" style={{ margin: 0, fontSize: '1.5rem' }}>{fmt(pack.maxTemp)}<span className="stat-unit">°C</span></div>
              <div className="stat-detail">Avg: {fmt(pack.avgTemp)}°C</div>
              <span className={`badge badge-${tempStatus === 'Critical' ? 'danger' : tempStatus === 'Warning' ? 'warning' : tempStatus === 'Unknown' ? 'neutral' : 'success'}`} style={{ fontSize: '0.65rem', marginTop: '0.25rem' }}>
                {tempStatus}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Energy / Efficiency / Duration KPI Cards */}
      <div className="dashboard-grid">
        <div className="card" style={{ borderLeft: '4px solid var(--success)' }}>
          <div className="stat-label"><ArrowDownToLine size={14} color="var(--success)" /> Energy Charged</div>
          <div className="stat-value">{pack.energyChargedKWh.toFixed(2)}<span className="stat-unit">kWh</span></div>
          <div className="stat-detail">Charging time: {fmtHrs(pack.chargeDurationHrs)}</div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid var(--warning)' }}>
          <div className="stat-label"><ArrowUpFromLine size={14} color="var(--warning)" /> Energy Discharged</div>
          <div className="stat-value">{pack.energyDischargedKWh.toFixed(2)}<span className="stat-unit">kWh</span></div>
          <div className="stat-detail">Discharging time: {fmtHrs(pack.dischargeDurationHrs)}</div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid var(--accent-primary)' }}>
          <div className="stat-label"><Percent size={14} color="var(--accent-primary)" /> Charge/Discharge Efficiency</div>
          <div className="stat-value">
            {pack.chargeDischargeEfficiency !== null ? pack.chargeDischargeEfficiency.toFixed(1) : 'N/A'}
            {pack.chargeDischargeEfficiency !== null && <span className="stat-unit">%</span>}
          </div>
          <div className="stat-detail">Operating time: {fmtHrs(pack.operatingDurationHrs)}</div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid var(--info)' }}>
          <div className="stat-label"><Gauge size={14} color="var(--info)" /> SOC Operating Range</div>
          <div className="stat-value">
            {pack.socRange !== null ? pack.socRange.toFixed(1) : 'N/A'}
            {pack.socRange !== null && <span className="stat-unit">%</span>}
          </div>
          <div className="stat-detail">
            Initial: {pack.initialSOC !== null && pack.initialSOC !== undefined ? Number(pack.initialSOC).toFixed(1) : 'N/A'}% ·
            {' '}{pack.minSOC !== null ? pack.minSOC.toFixed(1) : 'N/A'}–{pack.maxSOC !== null ? pack.maxSOC.toFixed(1) : 'N/A'}%
          </div>
        </div>
      </div>

      {/* Context Card */}
      <div className="card" style={{ marginBottom: '1.5rem', maxWidth: '480px' }}>
        <div className="card-title" style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
          Battery Context {!hasAnyMeta && <span style={{ color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>(illustrative — no metadata columns in this CSV)</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
          <Activity size={14} color="var(--accent-primary)" />
          Deployed in: <strong>{vehicleId || 'Not specified in source data'}</strong>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem' }}>
          {[
            ['Chemistry', chemistry],
            ['Firmware', firmware],
          ].map(([label, val]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-primary)' }} />
              <span style={{ color: 'var(--text-secondary)' }}>{label}:</span> {val || 'Not specified in source data'}
            </div>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="charts-grid">
        <div className="card" style={{ height: '380px', display: 'flex', flexDirection: 'column' }}>
          <div className="card-title" style={{ marginBottom: '1rem' }}>Pack Voltage vs Time</div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeSeries}>
                <defs>
                  <linearGradient id="voltGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0891b2" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#0891b2" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                <XAxis dataKey="time" stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                <YAxis stroke="var(--text-muted)" domain={['dataMin - 10', 'dataMax + 10']} tick={{ fontSize: 11 }} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="voltage" stroke="#0891b2" strokeWidth={2} fillOpacity={1} fill="url(#voltGrad)" name="Voltage (V)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card" style={{ height: '380px', display: 'flex', flexDirection: 'column' }}>
          <div className="card-title" style={{ marginBottom: '1rem' }}>Current Profile</div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                <XAxis dataKey="time" stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                <YAxis stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="current" stroke="var(--warning)" strokeWidth={2} dot={false} name="Current (A)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card" style={{ height: '380px', display: 'flex', flexDirection: 'column' }}>
          <div className="card-title" style={{ marginBottom: '1rem' }}>SOC Profile</div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeSeries}>
                <defs>
                  <linearGradient id="socGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--success)" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="var(--success)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                <XAxis dataKey="time" stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                <YAxis stroke="var(--text-muted)" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="soc" stroke="var(--success)" strokeWidth={2} fillOpacity={1} fill="url(#socGrad)" name="SOC (%)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card" style={{ height: '380px', display: 'flex', flexDirection: 'column' }}>
          <div className="card-title" style={{ marginBottom: '1rem' }}>Temperature Profile</div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeSeries}>
                <defs>
                  <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--danger)" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="var(--danger)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                <XAxis dataKey="time" stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                <YAxis stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="temperature" stroke="var(--danger)" strokeWidth={2} fillOpacity={1} fill="url(#tempGrad)" name="Temp (°C)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card" style={{ height: '380px', display: 'flex', flexDirection: 'column' }}>
          <div className="card-title" style={{ marginBottom: '1rem' }}>Cell Voltage Spread</div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                <XAxis dataKey="time" stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                <YAxis stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="vSpread" stroke="var(--info)" strokeWidth={2} dot={false} name="Spread (mV)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Anomalies */}
      {anomalies.length > 0 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <div className="card-title">Recent Alerts</div>
            <span className="badge badge-danger">{data.anomalySummary?.total ?? anomalies.length} anomalies</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Severity</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Component</th>
                </tr>
              </thead>
              <tbody>
                {anomalies.map((a, idx) => (
                  <tr key={idx}>
                    <td style={{ color: 'var(--text-secondary)' }}>{a.timestamp}</td>
                    <td><span className={`badge badge-${a.severity === 'Critical' ? 'danger' : 'warning'}`}>{a.severity}</span></td>
                    <td style={{ fontWeight: '500' }}>{a.type}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{a.description}</td>
                    <td>{a.affected}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
