import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Server, Plus, Save, Battery } from 'lucide-react';
import { devicesApi } from '../api/endpoints';

export default function DeviceManagement() {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [newDevice, setNewDevice] = useState({ serial_number: '', pack_name: '', firmware_version: '1.0.0', chemistry: 'LFP', series_cells: 96, parallel_strings: 1, nominal_voltage: 307.2, capacity_ah: 100 });

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: devicesApi.getDevices
  });

  const createMutation = useMutation({
    mutationFn: devicesApi.createDevice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      setIsCreating(false);
      setNewDevice({ serial_number: '', pack_name: '', firmware_version: '1.0.0', chemistry: 'LFP', series_cells: 96, parallel_strings: 1, nominal_voltage: 307.2, capacity_ah: 100 });
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
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Chemistry</label>
              <select className="form-input" value={newDevice.chemistry} onChange={e => setNewDevice({...newDevice, chemistry: e.target.value})}>
                <option value="LFP">LFP (LiFePO4)</option>
                <option value="NMC">NMC (Nickel Manganese Cobalt)</option>
                <option value="LTO">LTO (Lithium Titanate)</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Firmware</label>
              <input required type="text" className="form-input" value={newDevice.firmware_version} onChange={e => setNewDevice({...newDevice, firmware_version: e.target.value})} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Series Cells</label>
              <input required type="number" className="form-input" value={newDevice.series_cells} onChange={e => setNewDevice({...newDevice, series_cells: parseInt(e.target.value)})} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Parallel Strings</label>
              <input required type="number" className="form-input" value={newDevice.parallel_strings} onChange={e => setNewDevice({...newDevice, parallel_strings: parseInt(e.target.value)})} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Nominal Voltage (V)</label>
              <input required type="number" step="0.1" className="form-input" value={newDevice.nominal_voltage} onChange={e => setNewDevice({...newDevice, nominal_voltage: parseFloat(e.target.value)})} />
            </div>
            <button type="submit" className="btn-primary" disabled={createMutation.isLoading}>
              <Save size={16} />
              {createMutation.isLoading ? 'Saving...' : 'Register'}
            </button>
          </form>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading devices...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: 'var(--bg-secondary)' }}>
                <tr>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Serial Number</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Name</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Configuration</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Capacity</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Firmware</th>
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
                      {device.chemistry} · {device.series_cells}S{device.parallel_strings}P
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                      {device.nominal_voltage}V, {device.capacity_ah}Ah
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                      v{device.firmware_version}
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
