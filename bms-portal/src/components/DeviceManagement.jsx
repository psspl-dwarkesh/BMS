import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Server, Plus, Save, Battery } from 'lucide-react';
import { devicesApi } from '../api/endpoints';
import { LoadingState, ErrorState } from './common/StateViews';
import Select from './common/Select';

// Field names/enum values here must match backend/routers/devices.py's
// CreateDeviceRequest and backend/models.py's Chemistry/ConnectionType enums
// exactly - an earlier version of this form sent series_cells/
// parallel_strings/firmware_version/nominal_voltage/capacity_ah and a
// chemistry value of "LFP", none of which exist on the real schema, so
// every device registration attempt was silently failing validation.
const CHEMISTRY_OPTIONS = [
  { value: 'Li-ion', label: 'Li-ion' },
  { value: 'LiPo', label: 'LiPo' },
  { value: 'LiFePO4', label: 'LiFePO4' },
];
const CONNECTION_OPTIONS = [
  { value: 'SIMULATED', label: 'Simulated' },
  { value: 'BLE', label: 'BLE' },
  { value: 'WIFI', label: 'WiFi' },
  { value: 'CAN', label: 'CAN' },
  { value: 'GSM_GPRS', label: 'GSM/GPRS' },
];
const emptyDevice = {
  serial_number: '', pack_name: '', manufacturer: '', chemistry: 'Li-ion',
  rated_voltage: '', rated_capacity_ah: '', cell_count: 16, thermistor_count: 4,
  connection_type: 'SIMULATED', install_site: '',
};

export default function DeviceManagement() {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [newDevice, setNewDevice] = useState(emptyDevice);

  const { data: devices = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['devices'],
    queryFn: devicesApi.getDevices
  });

  const createMutation = useMutation({
    mutationFn: (device) => devicesApi.createDevice({
      ...device,
      rated_voltage: device.rated_voltage === '' ? null : parseFloat(device.rated_voltage),
      rated_capacity_ah: device.rated_capacity_ah === '' ? null : parseFloat(device.rated_capacity_ah),
      cell_count: parseInt(device.cell_count, 10),
      thermistor_count: parseInt(device.thermistor_count, 10),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      setIsCreating(false);
      setNewDevice(emptyDevice);
    }
  });

  const handleCreateDevice = (e) => {
    e.preventDefault();
    createMutation.mutate(newDevice);
  };

  return (
    <div className="animate-in">
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Server size={24} color="var(--accent-primary)" />
            Device Management
          </h2>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Register new battery packs and view device metadata
          </div>
        </div>
        <button className="btn-primary" onClick={() => setIsCreating(!isCreating)}>
          <Plus size={16} />
          {isCreating ? 'Cancel' : 'Register Device'}
        </button>
      </div>

      {isCreating && (
        <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid var(--accent-primary)' }}>
          <h3 style={{ marginBottom: '1rem', fontWeight: 600 }}>Register New Battery Pack</h3>
          <form onSubmit={handleCreateDevice} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Serial Number</label>
              <input required type="text" className="form-input" value={newDevice.serial_number} onChange={e => setNewDevice({...newDevice, serial_number: e.target.value})} placeholder="BMS-XYZ-123" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Pack Name</label>
              <input required type="text" className="form-input" value={newDevice.pack_name} onChange={e => setNewDevice({...newDevice, pack_name: e.target.value})} placeholder="Bus Fleet A - Pack 1" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Manufacturer</label>
              <input type="text" className="form-input" value={newDevice.manufacturer} onChange={e => setNewDevice({...newDevice, manufacturer: e.target.value})} placeholder="Acme Batteries" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Chemistry</label>
              <Select value={newDevice.chemistry} onChange={(v) => setNewDevice({...newDevice, chemistry: v})} options={CHEMISTRY_OPTIONS} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Connection</label>
              <Select value={newDevice.connection_type} onChange={(v) => setNewDevice({...newDevice, connection_type: v})} options={CONNECTION_OPTIONS} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Cell Count</label>
              <input required type="number" min="1" className="form-input" value={newDevice.cell_count} onChange={e => setNewDevice({...newDevice, cell_count: e.target.value})} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Thermistor Count</label>
              <input required type="number" min="1" className="form-input" value={newDevice.thermistor_count} onChange={e => setNewDevice({...newDevice, thermistor_count: e.target.value})} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Rated Voltage (V)</label>
              <input type="number" step="0.1" className="form-input" value={newDevice.rated_voltage} onChange={e => setNewDevice({...newDevice, rated_voltage: e.target.value})} placeholder="48" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Rated Capacity (Ah)</label>
              <input type="number" step="0.1" className="form-input" value={newDevice.rated_capacity_ah} onChange={e => setNewDevice({...newDevice, rated_capacity_ah: e.target.value})} placeholder="100" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Install Site</label>
              <input type="text" className="form-input" value={newDevice.install_site} onChange={e => setNewDevice({...newDevice, install_site: e.target.value})} placeholder="Warehouse A" />
            </div>
            <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
              <Save size={16} />
              {createMutation.isPending ? 'Saving...' : 'Register'}
            </button>
          </form>
          {createMutation.isError && (
            <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: '0.85rem', borderRadius: 'var(--radius-sm)' }}>
              Failed to register device: {createMutation.error?.response?.data?.detail ? JSON.stringify(createMutation.error.response.data.detail) : createMutation.error?.message}
            </div>
          )}
        </div>
      )}

      <div className="card" style={{ padding: isLoading || isError ? undefined : 0, overflow: 'hidden' }}>
        {isLoading ? (
          <LoadingState label="Loading devices..." />
        ) : isError ? (
          <ErrorState title="Couldn't load devices" message="The device registry failed to load." onRetry={refetch} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: 'var(--bg-secondary)' }}>
                <tr>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Serial Number</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Name</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Configuration</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Rating</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Connection</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Registered</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((device, idx) => (
                  <tr key={device.id} style={{ borderBottom: '1px solid var(--border-light)', background: idx % 2 === 0 ? 'transparent' : 'var(--bg-secondary)' }}>
                    <td style={{ padding: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Battery size={16} color="var(--accent-primary)" />
                      {device.serial_number}
                    </td>
                    <td style={{ padding: '1rem' }}>{device.pack_name}</td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                      {device.chemistry} · {device.cell_count}S · {device.thermistor_count} thermistors
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                      {device.rated_voltage ?? 'N/A'}V, {device.rated_capacity_ah ?? 'N/A'}Ah
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span className="badge badge-neutral">{device.connection_type}</span>
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {new Date(device.created_at).toLocaleDateString()}
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
