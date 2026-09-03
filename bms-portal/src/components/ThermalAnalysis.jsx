import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts';
import { Thermometer, FileSearch, TrendingUp } from 'lucide-react';

const CustomTooltip = ({ active, payload, label, unit = '°C' }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: '#fff', padding: '0.75rem 1rem', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-md)', fontSize: '0.8rem' }}>
        <p style={{ margin: '0 0 0.35rem 0', color: 'var(--text-secondary)', fontWeight: '500' }}>Time: {label}</p>
        {payload.map((p, idx) => (
          <p key={idx} style={{ margin: '0.15rem 0', color: p.color, fontWeight: '600' }}>
            {p.name}: {typeof p.value === 'number' ? `${p.value.toFixed(2)}${unit}` : p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function ThermalAnalysis({ data }) {
  if (!data) {
    return (
      <div className="animate-fade-in" style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
        <FileSearch size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
        <p>No dataset loaded. Upload a CSV to view thermal analysis.</p>
      </div>
    );
  }

  const pack = data.kpis.pack;
  const hasTempData = pack.tempSamples > 0;
  const hasCellTempData = !!data.signalsAvailable?.cellTemperature;

  // Null-safe formatter — never throws or fabricates a value when a signal
  // is genuinely missing from the source CSV.
  const fmt = (value, decimals = 1) => (value === null || value === undefined || isNaN(value)) ? 'N/A' : value.toFixed(decimals);

  const tempStatus = !hasTempData ? 'Unknown' : pack.maxTemp > 45 ? 'Critical' : pack.maxTemp > 35 ? 'Warning' : 'Normal';
  const tempColor = tempStatus === 'Critical' ? 'var(--danger)' : tempStatus === 'Warning' ? 'var(--warning)' : tempStatus === 'Unknown' ? 'var(--text-muted)' : 'var(--success)';

  const thermalAnomalies = (data.allAnomalies || []).filter(a => a.type.toLowerCase().includes('temp'));

  const hasTempTimeSeries = hasTempData && data.timeSeries.some(t => t.temperature !== null);
  const hasCellSpreadTimeSeries = hasCellTempData && data.timeSeries.some(t => t.cellTempSpread !== null);

  return (
    <div className="animate-fade-in">
      {!hasTempData && (
        <div className="card" style={{ marginBottom: '1.5rem', textAlign: 'center', padding: '2.5rem 2rem', color: 'var(--text-muted)' }}>
          <Thermometer size={40} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
          <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No temperature signal in this CSV</p>
          <p>Thermal behavior can't be assessed without a Temperature/Temp column.</p>
        </div>
      )}

      {hasTempData && (
        <>
          <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '1.5rem' }}>
            <div className="card" style={{ borderLeft: `4px solid ${tempColor}` }}>
              <div className="stat-label"><Thermometer size={14} color={tempColor} /> Max Pack Temp</div>
              <div className="stat-value">{fmt(pack.maxTemp)}<span className="stat-unit">°C</span></div>
              <span className={`badge badge-${tempStatus === 'Critical' ? 'danger' : tempStatus === 'Warning' ? 'warning' : 'success'}`} style={{ fontSize: '0.65rem', marginTop: '0.35rem' }}>{tempStatus}</span>
            </div>
            <div className="card">
              <div className="stat-label"><Thermometer size={14} color="var(--info)" /> Min Pack Temp</div>
              <div className="stat-value">{fmt(pack.minTemp)}<span className="stat-unit">°C</span></div>
            </div>
            <div className="card">
              <div className="stat-label"><Thermometer size={14} color="var(--text-secondary)" /> Avg Pack Temp</div>
              <div className="stat-value">{fmt(pack.avgTemp)}<span className="stat-unit">°C</span></div>
            </div>
            <div className="card">
              <div className="stat-label"><TrendingUp size={14} color="var(--warning)" /> Cell-to-Cell Δ (peak)</div>
              <div className="stat-value">
                {pack.maxCellTempSpread !== null && pack.maxCellTempSpread !== undefined ? fmt(pack.maxCellTempSpread) : 'N/A'}
                {pack.maxCellTempSpread !== null && pack.maxCellTempSpread !== undefined && <span className="stat-unit">°C</span>}
              </div>
              <div className="stat-detail">{hasCellTempData ? 'Consistency threshold: 8°C' : 'No cell temp columns'}</div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-title" style={{ marginBottom: '1rem' }}>Temperature vs Time</div>
            <div style={{ height: '280px', width: '100%' }}>
              {hasTempTimeSeries ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.timeSeries} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="thermalTempGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--danger)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="var(--danger)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
                    <XAxis dataKey="time" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="temperature" name="Pack Temp" stroke="var(--danger)" strokeWidth={2} fillOpacity={1} fill="url(#thermalTempGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No time-series temperature data to chart.</div>
              )}
            </div>
          </div>

          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-header">
              <div>
                <div className="card-title">Cell-to-Cell Temperature Difference vs Time</div>
                <div className="card-subtitle">{hasCellTempData ? 'Spread between the hottest and coldest cell at each sample' : 'Requires Cell*_Temp columns'}</div>
              </div>
            </div>
            <div style={{ height: '250px', width: '100%' }}>
              {hasCellSpreadTimeSeries ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.timeSeries} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
                    <XAxis dataKey="time" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="cellTempSpread" name="Cell ΔT" stroke="var(--warning)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
                  No per-cell temperature columns in this CSV — cell-to-cell temperature difference can't be computed. Add Cell1_Temp, Cell2_Temp, etc. to enable this chart.
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Thermal Anomalies</div>
              <span className="badge badge-neutral">{thermalAnomalies.length} events</span>
            </div>
            {thermalAnomalies.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr><th>Time</th><th>Severity</th><th>Type</th><th>Description</th><th>Component</th></tr>
                  </thead>
                  <tbody>
                    {thermalAnomalies.map((a, idx) => (
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
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No thermal anomalies detected.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
