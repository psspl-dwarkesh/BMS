import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, ShieldAlert, Filter, Calendar } from 'lucide-react';
import { alertsApi, devicesApi } from '../api/endpoints';

export default function AlertsPage() {
  const { id } = useParams(); // undefined if fleet scope
  const [statusFilter, setStatusFilter] = useState('active');
  const [severityFilter, setSeverityFilter] = useState('all');
  const queryClient = useQueryClient();

  // If scoped to device, fetch device info for title
  const { data: device } = useQuery({
    queryKey: ['device', id],
    queryFn: () => devicesApi.getDevice(id),
    enabled: !!id
  });

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['alerts', id, statusFilter, severityFilter],
    queryFn: () => alertsApi.getAlerts({ 
      deviceId: id,
      status: statusFilter === 'all' ? undefined : statusFilter,
      severity: severityFilter === 'all' ? undefined : severityFilter
    })
  });

  const ackMutation = useMutation({
    mutationFn: (alertId) => alertsApi.acknowledge(alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    }
  });

  return (
    <div className="animate-in">
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={24} color="var(--warning)" />
            {id ? `${device?.pack_name || 'Device'} Alerts` : 'Fleet Alerts'}
          </h2>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            {id ? `Manage active and historical alerts for SN: ${device?.serial_number}` : 'Global alert management for all accessible devices'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.25rem', borderRadius: 'var(--radius-md)' }}>
            <Filter size={14} color="var(--text-muted)" style={{ marginLeft: '0.5rem' }} />
            <select className="form-input" style={{ border: 'none', background: 'transparent', padding: '0.2rem' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="active">Active Only</option>
              <option value="resolved">Resolved</option>
              <option value="all">All Statuses</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.25rem', borderRadius: 'var(--radius-md)' }}>
            <ShieldAlert size={14} color="var(--text-muted)" style={{ marginLeft: '0.5rem' }} />
            <select className="form-input" style={{ border: 'none', background: 'transparent', padding: '0.2rem' }} value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}>
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading alerts...</div>
        ) : alerts.length === 0 ? (
          <div className="p-12 text-center text-gray-400" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <CheckCircle size={48} color="var(--success)" style={{ marginBottom: '1rem', opacity: 0.5 }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No alerts found</h3>
            <p>Your {id ? 'device is' : 'devices are'} operating within normal parameters for the selected filters.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: 'var(--bg-secondary)' }}>
                <tr>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Time</th>
                  {!id && <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Device</th>}
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Severity</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Type</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Message</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                  <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert, idx) => (
                  <tr key={alert.id} style={{ borderBottom: '1px solid var(--border-light)', background: idx % 2 === 0 ? 'transparent' : 'var(--bg-secondary)' }}>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Calendar size={12} />
                        {new Date(alert.triggered_at).toLocaleString()}
                      </div>
                    </td>
                    {!id && (
                      <td style={{ padding: '1rem', fontWeight: 500 }}>
                        Dev {alert.device_id}
                      </td>
                    )}
                    <td style={{ padding: '1rem' }}>
                      <span className={`badge badge-${alert.severity === 'critical' ? 'danger' : 'warning'}`}>
                        {alert.severity}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', fontWeight: 500, textTransform: 'capitalize' }}>
                      {alert.alert_type.replace('_', ' ')}
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                      {alert.message}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span className={`badge badge-${alert.status === 'active' ? 'danger' : 'success'}`}>
                        {alert.status}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      {alert.status === 'active' ? (
                        <button 
                          className="btn-secondary" 
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                          onClick={() => ackMutation.mutate(alert.id)}
                          disabled={ackMutation.isLoading}
                        >
                          Acknowledge
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {alert.resolved_at ? new Date(alert.resolved_at).toLocaleString() : 'Done'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
