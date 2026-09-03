import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { Calendar, Download, RefreshCw, AlertTriangle, Cpu } from 'lucide-react';
import { telemetryApi, devicesApi } from '../api/endpoints';

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
  const [timeRange, setTimeRange] = useState({
    start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    end: new Date().toISOString()
  });

  const { data: device } = useQuery({
    queryKey: ['device', id],
    queryFn: () => devicesApi.getDevice(id),
    enabled: !!id
  });

  const { data: historyData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['telemetry-history', id, timeRange.start, timeRange.end],
    queryFn: () => telemetryApi.getHistory(id, { start: timeRange.start, end: timeRange.end, pageSize: 1000 }),
    enabled: !!id
  });

  const handleExport = async () => {
    try {
      const token = localStorage.getItem('bms_token');
      const url = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/v1/devices/${id}/telemetry/history/export?start=${timeRange.start}&end=${timeRange.end}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `device_${device?.serial_number}_export.csv`;
      a.click();
    } catch (err) {
      console.error(err);
      alert('Failed to export data');
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
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Calendar size={16} color="var(--text-muted)" />
            <select 
              className="form-input" 
              style={{ padding: '0.4rem', fontSize: '0.8rem' }}
              onChange={(e) => {
                const hours = parseInt(e.target.value, 10);
                setTimeRange({
                  start: new Date(Date.now() - hours * 60 * 60 * 1000).toISOString(),
                  end: new Date().toISOString()
                });
              }}
              defaultValue="24"
            >
              <option value="1">Last 1 Hour</option>
              <option value="6">Last 6 Hours</option>
              <option value="24">Last 24 Hours</option>
              <option value="168">Last 7 Days</option>
              <option value="720">Last 30 Days</option>
            </select>
          </div>
          <button onClick={() => refetch()} className="btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }} disabled={isFetching}>
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button onClick={handleExport} className="btn-primary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}>
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center">Loading historical data...</div>
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
