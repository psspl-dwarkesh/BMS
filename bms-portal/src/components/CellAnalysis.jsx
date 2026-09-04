import { useState, useRef, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import { HelpCircle, TrendingDown, TrendingUp, Gauge, Thermometer } from 'lucide-react';
import { telemetryApi } from '../api/endpoints';

function BatteryCell3D({ position, voltage, avg, name }) {
  const meshRef = useRef();
  const [hovered, setHover] = useState(false);

  // Determine color based on threshold
  const color = useMemo(() => {
    if (voltage < avg - 0.1) return '#ef4444'; // Danger
    if (voltage < avg - 0.05 || voltage > avg + 0.05) return '#f59e0b'; // Warning
    return '#22c55e'; // Success
  }, [voltage, avg]);

  // Subtle breathing animation for all cells, aggressive for critical
  useFrame((state) => {
    if (meshRef.current && voltage < avg - 0.1) {
      meshRef.current.scale.y = 1 + Math.sin(state.clock.elapsedTime * 5) * 0.1;
      meshRef.current.material.emissiveIntensity = 0.5 + Math.sin(state.clock.elapsedTime * 5) * 0.5;
    }
  });

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={(e) => { e.stopPropagation(); setHover(false); document.body.style.cursor = 'auto'; }}
        scale={hovered ? 1.05 : 1}
      >
        <boxGeometry args={[0.8, 2.5, 0.8]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 0.4 : 0.1}
          metalness={0.6}
          roughness={0.2}
        />
      </mesh>

      {hovered && (
        <Html position={[0, 1.5, 0]} center zIndexRange={[100, 0]}>
          <div style={{
            background: 'rgba(12, 25, 41, 0.95)',
            color: '#fff',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            border: `1px solid ${color}`,
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            pointerEvents: 'none'
          }}>
            {name}<br/>{voltage.toFixed(3)}V
          </div>
        </Html>
      )}
    </group>
  );
}

function BatteryPackModel({ cellData, avg }) {
  const cells = [];
  const cols = Math.max(1, Math.ceil(Math.sqrt(cellData.length * 1.5)));
  const rows = Math.max(1, Math.ceil(cellData.length / cols));
  const spacingX = 1.0;
  const spacingZ = 1.0;

  for (let i = 0; i < cellData.length; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    // Center the grid around origin [0,0,0]
    const x = (col - cols / 2 + 0.5) * spacingX;
    const z = (row - rows / 2 + 0.5) * spacingZ;

    cells.push(
      <BatteryCell3D
        key={i}
        position={[x, 0, z]}
        voltage={cellData[i].voltage_mv / 1000}
        avg={avg}
        name={`Cell ${cellData[i].cell_number}`}
      />
    );
  }

  return (
    <group>
      {/* Pack Base Plate */}
      <mesh position={[0, -1.3, 0]}>
        <boxGeometry args={[cols * spacingX + 0.5, 0.2, rows * spacingZ + 0.5]} />
        <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.4} />
      </mesh>
      {cells}
    </group>
  );
}

export default function CellAnalysis() {
  const { id } = useParams();

  const { data: latest, isLoading } = useQuery({
    queryKey: ['telemetry-latest', id],
    queryFn: () => telemetryApi.getLatest(id),
    refetchInterval: 1000,
    enabled: !!id
  });

  if (isLoading) {
    return <div className="p-8 text-center">Loading cell data...</div>;
  }

  const cellData = latest?.cell_readings || [];
  const hasCellData = cellData.length > 0;
  
  if (!hasCellData) {
    return (
      <div className="animate-fade-in">
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
          <HelpCircle size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
          <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No per-cell data</p>
          <p style={{ maxWidth: '480px', margin: '0 auto' }}>
            This device has no active per-cell voltage or temperature telemetry.
          </p>
        </div>
      </div>
    );
  }

  const avg = latest.avg_cell_voltage;
  const weakestCell = cellData.reduce((prev, current) => (prev.voltage_mv < current.voltage_mv) ? prev : current);
  const strongestCell = cellData.reduce((prev, current) => (prev.voltage_mv > current.voltage_mv) ? prev : current);
  const maxTempSpread = latest.max_thermistor_temp - latest.min_thermistor_temp;

  // Format data for bar charts
  const barData = cellData.map(c => ({
    name: `C${c.cell_number}`,
    voltage: c.voltage_mv / 1000,
    temperature: c.temperature_c
  }));

  return (
    <div className="animate-fade-in">
      {/* Cell-Level KPI Strip */}
      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="stat-label"><TrendingDown size={14} color="var(--danger)" /> Weakest Cell</div>
          <div className="stat-value">Cell {weakestCell.cell_number}</div>
          <div className="stat-detail">Live: {(weakestCell.voltage_mv / 1000).toFixed(3)}V</div>
        </div>
        <div className="card">
          <div className="stat-label"><TrendingUp size={14} color="var(--success)" /> Strongest Cell</div>
          <div className="stat-value">Cell {strongestCell.cell_number}</div>
          <div className="stat-detail">Live: {(strongestCell.voltage_mv / 1000).toFixed(3)}V</div>
        </div>
        <div className="card">
          <div className="stat-label"><Gauge size={14} color="var(--warning)" /> Peak Voltage Spread</div>
          <div className="stat-value">
            {((strongestCell.voltage_mv - weakestCell.voltage_mv)).toFixed(0)}
            <span className="stat-unit">mV</span>
          </div>
          <div className="stat-detail">Live difference between max and min</div>
        </div>
      </div>

      {/* Interactive 3D Pack Viewer */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '0', overflow: 'hidden', border: '1px solid var(--border-strong)' }}>
        <div className="card-header" style={{ padding: '1.25rem' }}>
          <div>
            <div className="card-title">Interactive 3D Physical Pack Model</div>
            <div className="card-subtitle">WebGL spatial visualization of {cellData.length} measured cells — Live view</div>
          </div>
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#22c55e' }} /> Normal</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#f59e0b' }} /> Imbalanced</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#ef4444', animation: 'pulse 1s infinite' }} /> Critical</span>
          </div>
        </div>

        <div style={{ height: '400px', width: '100%', background: '#0a101d', cursor: 'grab' }} onMouseDown={e => e.target.style.cursor = 'grabbing'} onMouseUp={e => e.target.style.cursor = 'grab'}>
          <Canvas camera={{ position: [0, 8, 12], fov: 45 }}>
            <ambientLight intensity={0.4} />
            <directionalLight position={[10, 15, 10]} intensity={0.8} castShadow />
            <pointLight position={[-10, 5, -10]} intensity={0.5} />
            <BatteryPackModel cellData={cellData} avg={avg} />
            <OrbitControls
              enablePan={true}
              enableZoom={true}
              maxPolarAngle={Math.PI / 2 + 0.1}
              minDistance={5}
              maxDistance={30}
              autoRotate={true}
              autoRotateSpeed={0.5}
            />
          </Canvas>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="card" style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
        <div className="card-title" style={{ marginBottom: '1rem' }}>Cell Voltage Distribution (Bar)</div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--text-muted)" tick={{ fontSize: 9 }} interval={3} />
              <YAxis stroke="var(--text-muted)" domain={['dataMin - 0.05', 'dataMax + 0.05']} tick={{ fontSize: 11 }} tickFormatter={(val) => val.toFixed(3)} width={60} />
              <Tooltip
                contentStyle={{ background: '#fff', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-md)', fontSize: '0.8rem' }}
                itemStyle={{ color: 'var(--text-primary)', fontWeight: '600' }}
                formatter={(value) => [value.toFixed(3) + 'V', 'Voltage']}
              />
              <Bar dataKey="voltage" fill="var(--text-primary)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cell Temperature Distribution */}
      <div className="card" style={{ height: '350px', display: 'flex', flexDirection: 'column', marginTop: '1.5rem' }}>
        <div className="card-header" style={{ marginBottom: '0.5rem' }}>
          <div>
            <div className="card-title">Cell Temperature Distribution</div>
            <div className="card-subtitle">
              Live temperature per cell across {cellData.length} sensors
            </div>
          </div>
          <span className={`badge ${maxTempSpread > 8 ? 'badge-danger' : 'badge-success'}`}>
            <Thermometer size={12} style={{ marginRight: '0.25rem' }} />
            Peak Δ {maxTempSpread.toFixed(1)}°C
          </span>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--text-muted)" tick={{ fontSize: 9 }} interval={3} />
              <YAxis stroke="var(--text-muted)" domain={['dataMin - 1', 'dataMax + 1']} tick={{ fontSize: 11 }} width={50} tickFormatter={(val) => val.toFixed(1)} />
              <Tooltip
                contentStyle={{ background: '#fff', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-md)', fontSize: '0.8rem' }}
                itemStyle={{ color: 'var(--text-primary)', fontWeight: '600' }}
                formatter={(value) => [value.toFixed(1) + '°C', 'Temperature']}
              />
              <Bar dataKey="temperature" fill="var(--danger)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
