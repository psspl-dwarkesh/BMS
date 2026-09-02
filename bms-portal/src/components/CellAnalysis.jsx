import { useState, useRef, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import { HelpCircle } from 'lucide-react';

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
    if (voltage < avg - 0.1) {
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
  // Layout cells in as square a grid as the real cell count allows - this is
  // whatever number of Cell*_Voltage columns the CSV actually provided, not
  // a fixed 96.
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
        voltage={cellData[i].voltage}
        avg={avg}
        name={cellData[i].name}
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

export default function CellAnalysis({ data }) {
  const hasCellData = !!data?.signalsAvailable?.cellVoltage;

  // Real per-cell average voltage, computed directly from the CSV's own
  // Cell*_Voltage columns across every active row. Nothing here is randomized
  // or backfilled - if the CSV has no per-cell columns, cellData stays empty
  // and the pack viewer / chart are replaced with an explicit empty state.
  const cellData = useMemo(() => {
    if (!hasCellData) return [];
    const rows = (data.datasets || [])
      .filter(d => d.active !== false)
      .flatMap(d => d.data || []);
    if (rows.length === 0) return [];

    const headers = Object.keys(rows[0]);
    const cellVoltageCols = headers.filter(k => k.toLowerCase().includes('cell') && k.toLowerCase().includes('voltage'));
    if (cellVoltageCols.length === 0) return [];

    return cellVoltageCols
      .map((col, i) => {
        let total = 0, samples = 0;
        rows.forEach(row => {
          const val = parseFloat(row[col]);
          if (!isNaN(val)) { total += val; samples++; }
        });
        const numMatch = col.match(/\d+/);
        return {
          name: numMatch ? `C${numMatch[0]}` : col,
          voltage: samples > 0 ? total / samples : null
        };
      })
      .filter(c => c.voltage !== null);
  }, [data, hasCellData]);

  const avg = cellData.length > 0
    ? cellData.reduce((sum, c) => sum + c.voltage, 0) / cellData.length
    : null;

  if (cellData.length === 0) {
    return (
      <div className="animate-fade-in">
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
          <HelpCircle size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
          <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No per-cell voltage data in this CSV</p>
          <p style={{ maxWidth: '480px', margin: '0 auto' }}>
            This dataset has no Cell*_Voltage columns, so per-cell imbalance can't be computed or shown.
            Pack-level voltage is still available on the Dashboard tab — no cell readings are simulated in their place.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Interactive 3D Pack Viewer */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '0', overflow: 'hidden', border: '1px solid var(--border-strong)' }}>
        <div className="card-header" style={{ padding: '1.25rem' }}>
          <div>
            <div className="card-title">Interactive 3D Physical Pack Model</div>
            <div className="card-subtitle">WebGL spatial visualization of {cellData.length} measured cells — Click and drag to rotate, hover for diagnostics</div>
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
            <BarChart data={cellData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--text-muted)" tick={{ fontSize: 9 }} interval={3} />
              <YAxis stroke="var(--text-muted)" domain={['dataMin - 0.05', 'dataMax + 0.05']} tick={{ fontSize: 11 }} tickFormatter={(val) => val.toFixed(3)} width={60} />
              <Tooltip
                contentStyle={{ background: '#fff', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-md)', fontSize: '0.8rem' }}
                itemStyle={{ color: 'var(--text-primary)', fontWeight: '600' }}
                formatter={(value) => [value.toFixed(3) + 'V', 'Voltage']}
              />
              <Bar dataKey="voltage" fill="var(--text-primary)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
