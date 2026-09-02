import { useState, useMemo } from 'react';
import { Globe, ShieldAlert, Battery, Activity, Search, MapPin, SignalHigh, Server, Filter, CheckCircle2, AlertTriangle, FlaskConical } from 'lucide-react';

export default function FleetDashboard({ onSelectPack }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // NOTE: This app has no live fleet telemetry backend or multi-pack CSV feed -
  // there is nothing real to show here. Every row below is placeholder demo
  // data (Math.random()-generated), not a measurement of any actual pack, and
  // is labeled as such in the UI rather than presented as live telemetry.
  const fleetData = useMemo(() => {
    const regions = ['North America', 'Europe', 'Asia-Pacific', 'Latin America'];
    const statuses = ['Healthy', 'Healthy', 'Healthy', 'Healthy', 'Warning', 'Critical'];
    const data = [];

    for (let i = 1; i <= 256; i++) {
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const soh = status === 'Critical' ? 65 + Math.random() * 10 : (status === 'Warning' ? 75 + Math.random() * 10 : 85 + Math.random() * 15);

      data.push({
        id: `BMS-EV-${1000 + i}`,
        region: regions[Math.floor(Math.random() * regions.length)],
        status: status,
        soh: soh.toFixed(1),
        soHIsEstimate: true, // demo data - no real fleet SOH source exists
        fwVersion: `v2.${Math.floor(Math.random() * 4)}.${Math.floor(Math.random() * 10)}`,
        lastPing: `${Math.floor(Math.random() * 60)} mins ago`,
        cycles: Math.floor(Math.random() * 1500)
      });
    }
    return data;
  }, []);

  const filteredFleet = useMemo(() => {
    return fleetData.filter(pack => {
      const matchesSearch = pack.id.toLowerCase().includes(searchTerm.toLowerCase()) || pack.region.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || pack.status.toLowerCase() === statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [fleetData, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: fleetData.length,
      healthy: fleetData.filter(p => p.status === 'Healthy').length,
      warning: fleetData.filter(p => p.status === 'Warning').length,
      critical: fleetData.filter(p => p.status === 'Critical').length,
      avgSoh: (fleetData.reduce((acc, curr) => acc + parseFloat(curr.soh), 0) / fleetData.length).toFixed(1)
    };
  }, [fleetData]);

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '2rem' }}>
      {/* Demo Data Notice - this view has no live fleet backend or multi-pack
          CSV feed, so every pack below is generated placeholder data, not a
          real measurement. */}
      <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--warning-bg, rgba(245, 158, 11, 0.08))', border: '1px solid var(--warning)' }}>
        <FlaskConical size={18} color="var(--warning)" style={{ flexShrink: 0 }} />
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--text-primary)' }}>Demo data.</strong> This portal has no live fleet telemetry connection — the packs, statuses, SOH, and firmware versions below are randomly generated for illustration and are not derived from any uploaded CSV or real device.
        </div>
      </div>

      {/* Top Hero / Map Simulation */}
      <div className="card" style={{ marginBottom: '1.5rem', background: 'var(--bg-secondary)', overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', right: '-10%', top: '-50%', width: '60%', height: '200%', opacity: 0.05, pointerEvents: 'none' }}>
          <Globe size={600} strokeWidth={0.5} />
        </div>

        <div style={{ position: 'relative', zIndex: 1, padding: '1rem 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
            <div>
              <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Globe size={28} color="var(--accent-primary)" />
                Global Fleet Operations
              </h2>
              <p style={{ color: 'var(--text-secondary)' }}>Simulated demo telemetry for {stats.total} illustrative battery packs — not connected to live devices.</p>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ background: 'var(--bg-panel)', padding: '0.75rem 1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Server size={18} color="var(--warning)" />
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Server Status</div>
                  <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>Demo Mode (no live connection)</div>
                </div>
              </div>
            </div>
          </div>

          <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
            <div className="card" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-default)' }}>
              <div className="stat-label"><Battery size={14} color="var(--accent-primary)" /> Total Active Packs</div>
              <div className="stat-value">{stats.total}</div>
            </div>
            <div className="card" style={{ background: 'var(--bg-primary)', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
              <div className="stat-label"><CheckCircle2 size={14} color="var(--success)" /> Healthy</div>
              <div className="stat-value" style={{ color: 'var(--success)' }}>{stats.healthy}</div>
            </div>
            <div className="card" style={{ background: 'var(--bg-primary)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
              <div className="stat-label"><AlertTriangle size={14} color="var(--warning)" /> Attention Needed</div>
              <div className="stat-value" style={{ color: 'var(--warning)' }}>{stats.warning}</div>
            </div>
            <div className="card" style={{ background: 'var(--bg-primary)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              <div className="stat-label"><ShieldAlert size={14} color="var(--danger)" /> Critical Faults</div>
              <div className="stat-value" style={{ color: 'var(--danger)' }}>{stats.critical}</div>
            </div>
            <div className="card" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-default)' }}>
              <div className="stat-label"><Activity size={14} color="var(--info)" /> Fleet Avg SOH (demo)</div>
              <div className="stat-value" style={{ color: 'var(--info)' }}>{stats.avgSoh}<span className="stat-unit">%</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            type="text" 
            placeholder="Search Pack ID or Region..." 
            className="form-input" 
            style={{ paddingLeft: '2.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-default)' }}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Filter size={16} color="var(--text-muted)" />
          <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.25rem', borderRadius: 'var(--radius-md)' }}>
            {['All', 'Healthy', 'Warning', 'Critical'].map(status => (
              <button 
                key={status}
                onClick={() => setStatusFilter(status.toLowerCase())}
                style={{
                  padding: '0.4rem 1rem', fontSize: '0.8rem', fontWeight: '500', borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'all 0.2s',
                  background: statusFilter === status.toLowerCase() ? 'var(--bg-primary)' : 'transparent',
                  color: statusFilter === status.toLowerCase() ? 'var(--text-primary)' : 'var(--text-secondary)',
                  border: 'none', boxShadow: statusFilter === status.toLowerCase() ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                }}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Data Grid */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'var(--bg-secondary)' }}>
              <tr>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pack ID</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>SOH</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Region</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cycles</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Firmware</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Last Ping</th>
                <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredFleet.length > 0 ? filteredFleet.slice(0, 50).map((pack, idx) => (
                <tr key={pack.id} style={{ borderBottom: '1px solid var(--border-light)', background: idx % 2 === 0 ? 'transparent' : 'var(--bg-secondary)' }}>
                  <td style={{ padding: '1rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Battery size={16} color="var(--text-muted)" /> {pack.id}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span className={`badge badge-${pack.status === 'Critical' ? 'danger' : pack.status === 'Warning' ? 'warning' : 'success'}`}>
                      {pack.status}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', fontWeight: '600', color: pack.soh < 80 ? (pack.soh < 70 ? 'var(--danger)' : 'var(--warning)') : 'var(--text-primary)' }}>
                    {pack.soh}%
                    {pack.soHIsEstimate && (
                      <span
                        className="badge badge-warning"
                        style={{ fontSize: '0.55rem', padding: '0.1rem 0.35rem', marginLeft: '0.4rem', fontWeight: '500' }}
                        title="Demo data - not a real SOH measurement"
                      >
                        demo
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <MapPin size={12} /> {pack.region}
                    </div>
                  </td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{pack.cycles}</td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{pack.fwVersion}</td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <SignalHigh size={12} color="var(--success)" /> {pack.lastPing}
                    </div>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <button 
                      onClick={() => window.location.hash = 'dashboard'}
                      style={{ background: 'transparent', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)', padding: '0.3rem 0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' }}
                    >
                      View Analytics
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="8" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No battery packs match your search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {filteredFleet.length > 50 && (
            <div style={{ padding: '1rem', textAlign: 'center', background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Showing 50 of {filteredFleet.length} matching packs.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
// Add CheckCircle2, AlertTriangle to imports if they aren't, wait I need to add them to lucide-react imports.
