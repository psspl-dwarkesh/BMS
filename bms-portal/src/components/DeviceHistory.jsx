import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { Calendar, Download, RefreshCw, AlertTriangle } from 'lucide-react';
import { telemetryApi, devicesApi } from '../api/endpoints';
import { BASE_URL } from '../api/apiClient';
import { LoadingState, ErrorState } from './common/StateViews';
import Select from './common/Select';

const PRESETS = [
  { value: '1', label: 'Last 1 Hour' },
  { value: '6', label: 'Last 6 Hours' },
  { value: '24', label: 'Last 24 Hours' },
  { value: '168', label: 'Last 7 Days' },
  { value: '720', label: 'Last 30 Days' },
  { value: 'custom', label: 'Custom Range' },
];

// yyyy-mm-dd for a native <input type="date"> value from an ISO datetime.
const toDateInputValue = (iso) => iso.slice(0, 10);

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: '#fff', padding: '0.75rem 1rem', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-md)', fontSize: '0.8rem' }}>
        <p style={{ margin: '0 0 0.35rem 0', color: 'var(--text-secondary)', fontWeight: '500' }}>Time: {new Date(label).toLocaleString()}</p>
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

export default function DeviceHistory() {
  const { id } = useParams();
  
  // Last 24 hours by default
  const [preset, setPreset] = useState('24');
  const [timeRange, setTimeRange] = useState({
    start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    end: new Date().toISOString()
  });
  const [customStart, setCustomStart] = useState(toDateInputValue(timeRange.start));
  const [customEnd, setCustomEnd] = useState(toDateInputValue(timeRange.end));
  const [exportError, setExportError] = useState('');

  const handlePresetChange = (value) => {
    setPreset(value);
    if (value === 'custom') return; // wait for the user to pick dates + Apply
    const hours = parseInt(value, 10);
    setTimeRange({
      start: new Date(Date.now() - hours * 60 * 60 * 1000).toISOString(),
      end: new Date().toISOString()
    });
  };

  const applyCustomRange = () => {
    if (!customStart || !customEnd) return;
    setTimeRange({
      start: new Date(`${customStart}T00:00:00`).toISOString(),
      end: new Date(`${customEnd}T23:59:59`).toISOString()
    });
  };

  const { data: device } = useQuery({
    queryKey: ['device', id],
    queryFn: () => devicesApi.getDevice(id),
    enabled: !!id
  });

  const { data: historyData, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['telemetry-history', id, timeRange.start, timeRange.end],
    queryFn: () => telemetryApi.getHistory(id, { start: timeRange.start, end: timeRange.end, pageSize: 1000 }),
    enabled: !!id
  });

  const handleExport = async () => {
    setExportError('');
    try {
      const token = localStorage.getItem('bms_token');
      const url = `${BASE_URL}/api/v1/devices/${id}/telemetry/history/export?start=${timeRange.start}&end=${timeRange.end}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `device_${device?.serial_number}_export.csv`;
      a.click();
    } catch (err) {
      console.error(err);
      setExportError('Failed to export data. Please try again.');
    }
  };

  const chartData = (historyData?.items || []).slice().reverse();

  return (
    <div className="animate-in">
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>{device?.pack_name || 'Battery Pack'} - Historical Data</h2>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>SN: {device?.serial_number}</div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Calendar size={16} color="var(--text-muted)" />
            <Select style={{ width: '160px' }} value={preset} onChange={handlePresetChange} options={PRESETS} />
          </div>
          {preset === 'custom' && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input type="date" className="form-input" style={{ padding: '0.4rem', fontSize: '0.8rem' }} value={customStart} onChange={(e) => setCustomStart(e.target.value)} max={customEnd} />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>to</span>
              <input type="date" className="form-input" style={{ padding: '0.4rem', fontSize: '0.8rem' }} value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} min={customStart} max={toDateInputValue(new Date().toISOString())} />
              <button onClick={applyCustomRange} className="btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}>Apply</button>
            </div>
          )}
          <button onClick={() => refetch()} className="btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }} disabled={isFetching}>
            <RefreshCw size={14} style={isFetching ? { animation: 'spin 0.9s linear infinite' } : undefined} />
            Refresh
          </button>
          <button onClick={handleExport} className="btn-primary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}>
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {exportError && (
        <div className="card" style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: '0.85rem', border: '1px solid var(--danger)' }}>
          {exportError}
        </div>
      )}

      {isLoading ? (
        <LoadingState label="Loading historical data..." />
      ) : isError ? (
        <ErrorState title="Couldn't load history" message="Telemetry history failed to load for this time range." onRetry={refetch} />
      ) : chartData.length === 0 ? (
        <div className="card text-center p-12">
          <AlertTriangle size={32} color="var(--warning)" style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
          <p style={{ color: 'var(--text-primary)', fontWeight: 600 }}>No telemetry found for this time range.</p>
          <p style={{ color: 'var(--text-secondary)' }}>Try selecting a wider date range or upload historical CSV data.</p>
        </div>
      ) : (
        <div className="charts-grid" style={{ gridTemplateColumns: '1fr', gap: '1.5rem' }}>
          <div className="card" style={{ height: '350px', display: 'flex', flexDirection: 'column' }}>
            <div className="card-title" style={{ marginBottom: '1rem' }}>Pack Voltage Profile</div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="voltGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0891b2" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#0891b2" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                  <XAxis dataKey="sample_time" tickFormatter={(v) => new Date(v).toLocaleTimeString()} stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                  <YAxis domain={['auto', 'auto']} stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="pack_voltage" stroke="#0891b2" strokeWidth={2} fillOpacity={1} fill="url(#voltGrad)" name="Voltage (V)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card" style={{ height: '350px', display: 'flex', flexDirection: 'column' }}>
            <div className="card-title" style={{ marginBottom: '1rem' }}>Current Profile</div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                  <XAxis dataKey="sample_time" tickFormatter={(v) => new Date(v).toLocaleTimeString()} stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                  <YAxis domain={['auto', 'auto']} stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="pack_current" stroke="var(--warning)" strokeWidth={2} dot={false} name="Current (A)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card" style={{ height: '350px', display: 'flex', flexDirection: 'column' }}>
            <div className="card-title" style={{ marginBottom: '1rem' }}>SOC Profile</div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="socGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--success)" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="var(--success)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                  <XAxis dataKey="sample_time" tickFormatter={(v) => new Date(v).toLocaleTimeString()} stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="soc" stroke="var(--success)" strokeWidth={2} fillOpacity={1} fill="url(#socGrad)" name="SOC (%)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card" style={{ height: '350px', display: 'flex', flexDirection: 'column' }}>
            <div className="card-title" style={{ marginBottom: '1rem' }}>Temperature Trends</div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                  <XAxis dataKey="sample_time" tickFormatter={(v) => new Date(v).toLocaleTimeString()} stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                  <YAxis domain={['auto', 'auto']} stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="max_thermistor_temp" stroke="var(--danger)" strokeWidth={2} dot={false} name="Max Temp (°C)" />
                  <Line type="monotone" dataKey="avg_cell_temp" stroke="var(--warning)" strokeWidth={2} dot={false} name="Avg Temp (°C)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
