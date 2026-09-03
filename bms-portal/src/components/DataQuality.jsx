import { CheckCircle2, AlertTriangle, ShieldAlert, FileSearch, HelpCircle } from 'lucide-react';

export default function DataQuality({ analyticsData }) {
  if (!analyticsData) {
    return (
      <div className="animate-fade-in" style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
        <FileSearch size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
        <p>No dataset loaded. Upload a CSV to view data quality metrics.</p>
      </div>
    );
  }

  const { dataQuality, signalsAvailable } = analyticsData;
  if (!dataQuality) {
    return (
      <div className="animate-fade-in" style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
        <FileSearch size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
        <p>Data quality metrics are unavailable for the current dataset. Please reload the data.</p>
      </div>
    );
  }

  const getScoreColor = (score) => {
    if (score >= 90) return 'var(--success)';
    if (score >= 70) return 'var(--warning)';
    return 'var(--danger)';
  };

  const getScoreBadge = (score) => {
    if (score >= 90) return 'badge-success';
    if (score >= 70) return 'badge-warning';
    return 'badge-danger';
  };

  return (
    <div className="animate-fade-in">
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <div>
            <div className="card-title">Data Quality Report</div>
            <div className="card-subtitle">Detailed validation analysis of the ingested CSV logs</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Overall Score:</span>
            {dataQuality.tier && (
              <span className={`badge ${getScoreBadge(dataQuality.score)}`}>{dataQuality.tier}</span>
            )}
            <div style={{
              background: 'var(--bg-secondary)',
              padding: '0.5rem 1rem',
              borderRadius: '2rem',
              fontSize: '1.25rem',
              fontWeight: '700',
              color: getScoreColor(dataQuality.score),
              border: `1px solid ${getScoreColor(dataQuality.score)}20`
            }}>
              {dataQuality.score}%
            </div>
          </div>
        </div>

        <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '2rem' }}>
          <div className="card" style={{ background: 'var(--bg-secondary)', border: 'none' }}>
            <div className="stat-label">Total Rows Parsed</div>
            <div className="stat-value" style={{ color: 'var(--text-primary)' }}>{dataQuality.totalRows.toLocaleString()}</div>
          </div>
          <div className="card" style={{ background: 'var(--bg-secondary)', border: 'none' }}>
            <div className="stat-label">Available Signals</div>
            <div className="stat-value" style={{ color: 'var(--info)' }}>{dataQuality.availableSignals.length}</div>
          </div>
          <div className="card" style={{ background: 'var(--bg-secondary)', border: 'none' }}>
            <div className="stat-label">Missing Timestamps</div>
            <div className="stat-value" style={{ color: dataQuality.missingTimestamps > 0 ? 'var(--warning)' : 'var(--success)' }}>
              {dataQuality.missingTimestamps}
            </div>
          </div>
          <div className="card" style={{ background: 'var(--bg-secondary)', border: 'none' }}>
            <div className="stat-label">Invalid Values</div>
            <div className="stat-value" style={{ color: dataQuality.invalidValues > 0 ? 'var(--danger)' : 'var(--success)' }}>
              {dataQuality.invalidValues}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {/* Missing Required Signals */}
          <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
              <ShieldAlert size={18} color={dataQuality.missingRequiredSignals.length > 0 ? 'var(--danger)' : 'var(--success)'} />
              Missing Required Signals
            </h4>
            {dataQuality.missingRequiredSignals.length > 0 ? (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {dataQuality.missingRequiredSignals.map((signal, idx) => (
                  <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)', fontSize: '0.85rem', background: 'var(--danger-bg)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
                    <AlertTriangle size={14} /> Critical: "{signal}" could not be mapped.
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)', fontSize: '0.85rem', background: 'var(--success-bg)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                <CheckCircle2 size={16} /> All required base signals (Voltage, Current, Temp, SOC) were successfully mapped.
              </div>
            )}
          </div>

          {/* Data Gaps & Anomalies */}
          <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
              <HelpCircle size={18} color={dataQuality.dataGaps > 0 ? 'var(--warning)' : 'var(--success)'} />
              Time-Series Continuity
            </h4>
            {dataQuality.dataGaps > 0 ? (
              <div style={{ color: 'var(--warning)', fontSize: '0.85rem', background: 'var(--warning-bg)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                <strong>{dataQuality.dataGaps} significant time gaps detected.</strong>
                <p style={{ marginTop: '0.25rem' }}>Gaps &gt; 60 seconds were found between adjacent rows. This may affect integration calculations like Capacity and energy throughput.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)', fontSize: '0.85rem', background: 'var(--success-bg)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                <CheckCircle2 size={16} /> Continuous time-series verified. No gaps exceeding 60s detected.
              </div>
            )}
          </div>
        </div>
        
        {signalsAvailable && !signalsAvailable.cellVoltage && (
          <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
            <HelpCircle size={16} />
            No per-cell voltage columns were found in this CSV — cell-level voltage imbalance detection is unavailable for this dataset (no cell readings are simulated in their place).
          </div>
        )}
        {signalsAvailable && (!signalsAvailable.capacity || !signalsAvailable.soh || !signalsAvailable.cycle) && (
          <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
            <HelpCircle size={16} />
            No {[!signalsAvailable.cycle && 'cycle number', !signalsAvailable.capacity && 'capacity', !signalsAvailable.soh && 'SOH'].filter(Boolean).join(' / ')} column found — SOH and Capacity Fade figures on the Degradation tab are modeled estimates, not measured values.
          </div>
        )}

        <div style={{ marginTop: '2rem' }}>
          <h4 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>All Identified Signals ({dataQuality.availableSignals.length})</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {dataQuality.availableSignals.map((sig, idx) => (
              <span key={idx} style={{ 
                background: 'var(--bg-secondary)', 
                border: '1px solid var(--border-default)', 
                color: 'var(--text-secondary)',
                fontSize: '0.75rem', 
                padding: '0.25rem 0.6rem', 
                borderRadius: '4px',
                fontFamily: 'monospace'
              }}>
                {sig}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
