import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Globe, ShieldAlert, Battery, Search, Server, Filter, CheckCircle2, AlertTriangle, Cpu } from 'lucide-react';
import { devicesApi } from '../api/endpoints';
import { LoadingState, ErrorState } from './common/StateViews';

export default function FleetDashboard() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const navigate = useNavigate();

  const { data: fleetData = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['devices'],
    queryFn: devicesApi.getDevices
  });

  const filteredFleet = useMemo(() => {
    return fleetData.filter(pack => {
      const matchesSearch = (pack.serial_number || '').toLowerCase().includes(searchTerm.toLowerCase()) || (pack.pack_name || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || (pack.status || '').toLowerCase() === statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [fleetData, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: fleetData.length,
      healthy: fleetData.filter(p => p.status === 'healthy').length,
      warning: fleetData.filter(p => p.status === 'warning').length,
      critical: fleetData.filter(p => p.status === 'critical').length,
    };
  }, [fleetData]);

  if (isLoading) {
    return <LoadingState label="Loading fleet data..." />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Couldn't load the fleet"
        message="The device list failed to load from the server."
        onRetry={refetch}
      />
    );
  }

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '2rem' }}>
      {/* Top Hero */}
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
              <p style={{ color: 'var(--text-secondary)' }}>Live telemetry for {stats.total} registered battery packs.</p>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ background: 'var(--bg-panel)', padding: '0.75rem 1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Server size={18} color="var(--success)" />
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Server Status</div>
                  <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>Live Connection</div>
                </div>
              </div>
            </div>
          </div>

          <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
            <div className="card" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-default)' }}>
              <div className="stat-label"><Battery size={14} color="var(--accent-primary)" /> Total Registered Packs</div>
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
          </div>
        </div>
      </div>

      {/* Grid Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            type="text" 
            placeholder="Search Pack SN or Name..." 
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
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Serial Number</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name / Model</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Chemistry</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Configuration</th>
                <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredFleet.length > 0 ? filteredFleet.slice(0, 50).map((pack, idx) => (
                <tr key={pack.id} style={{ borderBottom: '1px solid var(--border-light)', background: idx % 2 === 0 ? 'transparent' : 'var(--bg-secondary)' }}>
                  <td style={{ padding: '1rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Battery size={16} color="var(--text-muted)" /> {pack.serial_number}
                  </td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{pack.pack_name}</td>
                  <td style={{ padding: '1rem' }}>
                    <span className={`badge badge-${pack.status === 'critical' ? 'danger' : pack.status === 'warning' ? 'warning' : 'success'}`}>
                      {pack.status || 'unknown'}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Cpu size={12} /> {pack.chemistry || 'N/A'}
                    </div>
                  </td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                    {pack.cell_count}S · {pack.connection_type}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <button 
                      onClick={() => navigate(`/app/devices/${pack.id}/realtime`)}
                      style={{ background: 'transparent', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)', padding: '0.3rem 0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' }}
                    >
                      View Live
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No battery packs match your search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
