import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { Battery, Zap, Thermometer, Activity, AlertTriangle } from 'lucide-react';
import { telemetryApi, devicesApi } from '../api/endpoints';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: '#fff', padding: '0.75rem 1rem', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-md)', fontSize: '0.8rem' }}>
        <p style={{ margin: '0 0 0.35rem 0', color: 'var(--text-secondary)', fontWeight: '500' }}>Time: {new Date(label).toLocaleTimeString()}</p>
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

const CircularGauge = ({ value, max, label, unit, color, size = 70 }) => {
  const hasValue = typeof value === 'number' && !isNaN(value);
  const pct = hasValue ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ position: 'relative', width: `${size}px`, height: `${size}px` }}>
      <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--bg-panel)" strokeWidth="3" />
        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={color} strokeWidth="3" strokeDasharray={`${pct}, 100`} strokeLinecap="round" style={{ transition: 'stroke-dasharray 1s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: hasValue ? '0.8rem' : '0.65rem', fontWeight: '700', color: hasValue ? 'var(--text-primary)' : 'var(--text-muted)', lineHeight: 1 }}>{hasValue ? value.toFixed(0) : 'N/A'}</span>
        <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>{unit}</span>
      </div>
    </div>
  );
};

const BatteryIndicator = ({ percent }) => {
  if (percent === null || percent === undefined || isNaN(percent)) return null;
  const barColor = percent > 50 ? 'var(--success)' : percent > 20 ? 'var(--warning)' : 'var(--danger)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div style={{ position: 'relative', width: '48px', height: '22px' }}>
        <div style={{ width: '44px', height: '22px', border: `2px solid ${barColor}`, borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
          <div style={{ width: `${percent}%`, height: '100%', background: barColor, transition: 'width 1s ease', opacity: 0.85 }} />
        </div>
        <div style={{ position: 'absolute', right: '-4px', top: '6px', width: '4px', height: '10px', background: barColor, borderRadius: '0 2px 2px 0' }} />
      </div>
      <span style={{ fontSize: '0.75rem', fontWeight: '600', color: barColor }}>{percent.toFixed(0)}%</span>
    </div>
  );
};

export default function DeviceRealtime() {
  const { id } = useParams();
  const [timeSeries, setTimeSeries] = useState([]);

  // Fetch device details
  const { data: device } = useQuery({
    queryKey: ['device', id],
    queryFn: () => devicesApi.getDevice(id),
    enabled: !!id
  });

  // Polling for latest telemetry every 1 second
  const { data: latest, isLoading } = useQuery({
    queryKey: ['telemetry-latest', id],
    queryFn: () => telemetryApi.getLatest(id),
    refetchInterval: 1000,
    enabled: !!id
  });

  // Keep a running window of the last 60 points
  useEffect(() => {
    if (latest) {
      setTimeSeries(prev => {
        const last = prev[prev.length - 1];
        if (last && last.sample_time === latest.sample_time) return prev;
        const next = [...prev, latest];
        if (next.length > 60) next.shift(); // Keep last 60 seconds
        return next;
      });
    }
  }, [latest]);

  if (isLoading && !latest) {
    return <div className="p-8 text-center">Loading realtime data...</div>;
  }

  if (!latest) {
    return <div className="p-8 text-center text-gray-400">No telemetry data available for this device yet. Wait for simulator or upload CSV.</div>;
  }

  const fmt = (v, d = 2) => (v === null || v === undefined) ? 'N/A' : v.toFixed(d);

  const tempStatus = latest.max_thermistor_temp > 50 ? 'Critical' : latest.max_thermistor_temp > 40 ? 'Warning' : 'Normal';
  const tempColor = tempStatus === 'Critical' ? 'var(--danger)' : tempStatus === 'Warning' ? 'var(--warning)' : 'var(--success)';

  return (
    <div className="animate-in">
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>{device?.pack_name || 'Battery Pack'} - Realtime</h2>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>SN: {device?.serial_number}</div>
        </div>
        <div className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ width: '8px', height: '8px', background: 'currentColor', borderRadius: '50%', animation: 'pulse 2s infinite' }} />
          Live Connection Active
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card" style={{ borderLeft: '4px solid var(--accent-primary)' }}>
          <div className="stat-label"><Zap size={14} color="var(--accent-primary)" /> Pack Voltage</div>
          <div className="stat-value">{fmt(latest.pack_voltage, 2)}<span className="stat-unit">V</span></div>
          <div className="stat-detail">Min Cell: {fmt(latest.min_cell_voltage, 3)}V · Max Cell: {fmt(latest.max_cell_voltage, 3)}V</div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid var(--warning)' }}>
          <div className="stat-label"><Activity size={14} color="var(--warning)" /> Pack Current</div>
          <div className="stat-value">{fmt(latest.pack_current, 1)}<span className="stat-unit">A</span></div>
          <div className="stat-detail">Mode: {latest.pack_current > 0 ? 'Charging' : latest.pack_current < 0 ? 'Discharging' : 'Idle'}</div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid var(--success)' }}>
          <div className="stat-label"><Battery size={14} color="var(--success)" /> State of Charge</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
            <CircularGauge value={latest.soc} max={100} label="SOC" unit="%" color="var(--success)" />
            <div>
              <div className="stat-value" style={{ margin: 0, fontSize: '1.5rem' }}>{fmt(latest.soc, 1)}<span className="stat-unit">%</span></div>
              <div className="stat-detail">SOH: {fmt(latest.soh, 1)}%</div>
              <BatteryIndicator percent={latest.soc} />
            </div>
          </div>
        </div>

        <div className="card" style={{ borderLeft: `4px solid ${tempColor}` }}>
          <div className="stat-label"><Thermometer size={14} color={tempColor} /> Max Temperature</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
            <CircularGauge value={latest.max_thermistor_temp} max={60} label="Temp" unit="°C" color={tempColor} />
            <div>
              <div className="stat-value" style={{ margin: 0, fontSize: '1.5rem' }}>{fmt(latest.max_thermistor_temp, 1)}<span className="stat-unit">°C</span></div>
              <div className="stat-detail">Avg: {fmt(latest.avg_cell_temp, 1)}°C</div>
              <span className={`badge badge-${tempStatus === 'Critical' ? 'danger' : tempStatus === 'Warning' ? 'warning' : 'success'}`} style={{ fontSize: '0.65rem', marginTop: '0.25rem' }}>
                {tempStatus}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Realtime Charts */}
      <div className="charts-grid" style={{ marginTop: '1.5rem' }}>
        <div className="card" style={{ height: '300px', display: 'flex', flexDirection: 'column' }}>
          <div className="card-title" style={{ marginBottom: '1rem' }}>Live Voltage</div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeSeries}>
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
                <Area isAnimationActive={false} type="monotone" dataKey="pack_voltage" stroke="#0891b2" strokeWidth={2} fillOpacity={1} fill="url(#voltGrad)" name="Voltage (V)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card" style={{ height: '300px', display: 'flex', flexDirection: 'column' }}>
          <div className="card-title" style={{ marginBottom: '1rem' }}>Live Current</div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                <XAxis dataKey="sample_time" tickFormatter={(v) => new Date(v).toLocaleTimeString()} stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                <YAxis domain={['auto', 'auto']} stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Line isAnimationActive={false} type="monotone" dataKey="pack_current" stroke="var(--warning)" strokeWidth={2} dot={false} name="Current (A)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
