import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Activity, Battery, History, FileSearch, FlaskConical } from 'lucide-react';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: '#fff', padding: '0.75rem 1rem', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-md)', fontSize: '0.8rem' }}>
        <p style={{ margin: '0 0 0.35rem 0', color: 'var(--text-secondary)', fontWeight: '500' }}>Cycle: {label}</p>
        {payload.map((p, idx) => (
          <p key={idx} style={{ margin: '0.15rem 0', color: p.color, fontWeight: '600' }}>
            {p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function DegradationAnalysis({ data }) {
  if (!data || !data.degradationSeries || data.degradationSeries.length === 0) {
    return (
      <div className="animate-fade-in" style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
        <FileSearch size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
        <p>No degradation data available. Upload a multi-cycle dataset to view Capacity Fade and SOH projections.</p>
      </div>
    );
  }

  const { degradationSeries } = data;
  const lastPoint = degradationSeries[degradationSeries.length - 1];
  const firstPoint = degradationSeries[0];
  const currentSOH = lastPoint?.soh ?? 100;
  const initialCap = firstPoint?.capacity ?? 50;
  const currentCap = lastPoint?.capacity ?? 50;
  const capFade = ((initialCap - currentCap) / initialCap) * 100;

  // SOH and Capacity each have their own estimate/measured basis - a CSV can
  // easily carry a real SOH column but no Capacity column (or vice versa), so
  // treating "any signal missing" as "the whole series is an estimate" would
  // mislabel a genuinely measured SOH curve as modeled just because Capacity
  // wasn't logged. Track and message each one on its own terms.
  const sohIsEstimate = !!lastPoint?.sohIsEstimate;
  const capacityIsEstimate = !!lastPoint?.capacityIsEstimate;
  const seriesIsEstimate = sohIsEstimate || capacityIsEstimate;
  const estimatedMetrics = [
    sohIsEstimate && 'SOH',
    capacityIsEstimate && 'Capacity'
  ].filter(Boolean);
  const missingSignals = [
    lastPoint?.cycleIsEstimate && 'Cycle Number',
    capacityIsEstimate && 'Capacity',
    sohIsEstimate && 'SOH'
  ].filter(Boolean);

  return (
    <div className="animate-fade-in">
      {seriesIsEstimate && (
        <div className="card" style={{ marginBottom: '1.5rem', background: 'var(--warning-bg)', border: '1px solid var(--warning)', display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '1rem 1.25rem' }}>
          <FlaskConical size={18} color="var(--warning)" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
          <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
            <strong>{estimatedMetrics.join(' and ')} {estimatedMetrics.length > 1 ? 'are' : 'is'} a modeled estimate, not a measurement.</strong> The source CSV has no {missingSignals.join(', ')} column{missingSignals.length > 1 ? 's' : ''}, so {estimatedMetrics.join('/')} {estimatedMetrics.length > 1 ? 'are' : 'is'} derived from Coulomb-counting throughput fed through an EKF assuming a 50Ah nominal pack capacity — not read from an actual health sensor or lab test.
            {!sohIsEstimate && capacityIsEstimate && ' SOH above is read directly from the CSV and is not affected by this.'}
            {sohIsEstimate && !capacityIsEstimate && ' Capacity above is read directly from the CSV and is not affected by this.'}
          </div>
        </div>
      )}
      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="stat-label"><Activity size={14} color="var(--accent-primary)" /> Current SOH</div>
          <div className="stat-value" style={{ color: currentSOH < 80 ? 'var(--danger)' : 'var(--text-primary)' }}>
            {currentSOH.toFixed(1)}<span className="stat-unit">%</span>
          </div>
        </div>
        <div className="card">
          <div className="stat-label"><Battery size={14} color="var(--warning)" /> Capacity Fade</div>
          <div className="stat-value">{capFade.toFixed(1)}<span className="stat-unit">%</span></div>
        </div>
        <div className="card">
          <div className="stat-label"><History size={14} color="var(--info)" /> Total Ah Throughput</div>
          <div className="stat-value">{Number(lastPoint?.ahThroughput || 0).toLocaleString()}<span className="stat-unit"> Ah</span></div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <div>
            <div className="card-title">State of Health (SOH) Projection</div>
            <div className="card-subtitle">
              {sohIsEstimate
                ? 'Estimated SOH decline over operating cycles, modeled from Ah integration (no SOH column in source data)'
                : 'SOH decline over operating cycles, read from the source CSV'}
            </div>
          </div>
          <span className={`badge ${sohIsEstimate ? 'badge-warning' : 'badge-success'}`}>
            {sohIsEstimate ? 'Estimated (EKF model)' : 'Measured (from CSV)'}
          </span>
        </div>
        <div style={{ height: '300px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={degradationSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="sohGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
              <XAxis dataKey="cycle" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
              <RechartsTooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="soh" name="SOH (%)" stroke="var(--accent-primary)" strokeWidth={3} fillOpacity={1} fill="url(#sohGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Capacity Fade Curve</div>
            <div className="card-subtitle">{capacityIsEstimate ? 'Estimated' : 'Measured'} remaining Ah capacity over cycles</div>
          </div>
        </div>
        <div style={{ height: '250px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={degradationSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
              <XAxis dataKey="cycle" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
              <RechartsTooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="capacity" name="Capacity (Ah)" stroke="var(--warning)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
