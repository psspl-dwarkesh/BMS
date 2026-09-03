import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import Papa from 'papaparse';
import { Upload, FileText, CheckCircle, AlertTriangle, Sparkles, X } from 'lucide-react';
import { telemetryApi, devicesApi } from '../api/endpoints';

// Bundled demo datasets (see backend/scripts/gen_sample_csvs.py for how
// they were generated) - let the "Upload & Analyze" flow work with zero
// setup, no user-supplied file required.
const SAMPLE_DATASETS = [
  { file: '/sample_ev_pack_healthy.csv', label: 'EV Pack — Healthy', desc: '16-cell pack, balanced cells, normal thermal behavior', packName: 'Sample EV Pack (Healthy)' },
  { file: '/sample_ev_pack_anomaly.csv', label: 'EV Pack — Cell Imbalance', desc: '16-cell pack with one weak cell and a thermal event', packName: 'Sample EV Pack (Anomaly)' },
  { file: '/sample_lab_cycling_degradation.csv', label: 'Lab Cycling — Degradation', desc: '60-cycle capacity fade / SOH trend dataset', packName: 'Sample Lab Cycling Pack' },
];

// Lightweight client-side signal detection for the pre-upload preview -
// deliberately simpler than csvParser.js's full processBatteryData (which
// is for computing analytics, not previewing a file about to be uploaded).
function detectSignals(headers) {
  const has = (kw) => headers.some((h) => h.toLowerCase().includes(kw));
  const cellCount = headers.filter((h) => /cell\s*\d+.*volt/i.test(h)).length;
  const thermistorCount = headers.filter((h) => /cell\s*\d+.*temp/i.test(h)).length;
  return {
    voltage: has('volt'),
    current: has('current'),
    soc: has('soc'),
    soh: has('soh'),
    cycle: has('cycle'),
    cellCount: cellCount || 16,
    thermistorCount: thermistorCount || 4,
    hasCellVoltage: cellCount > 0,
    hasCellTemp: thermistorCount > 0,
  };
}

function humanizeFilename(name) {
  return name.replace(/\.csv$/i, '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const SignalBadge = ({ ok, label }) => (
  <span className={`badge badge-${ok ? 'success' : 'neutral'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
    {ok ? <CheckCircle size={12} /> : <AlertTriangle size={12} />} {label}
  </span>
);

export default function DataIngestion() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNewBatteryMode = !id;

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null); // { rowCount, signals }
  const [packName, setPackName] = useState('');
  const [message, setMessage] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const { data: device } = useQuery({
    queryKey: ['device', id],
    queryFn: () => devicesApi.getDevice(id),
    enabled: !!id,
  });

  const parseFile = (f, defaultName) => {
    setFile(f);
    setPreview(null);
    setMessage(null);
    if (isNewBatteryMode) setPackName(defaultName || humanizeFilename(f.name));
    Papa.parse(f, {
      header: true,
      skipEmptyLines: true,
      preview: 2000, // cap client-side parse cost for a very large file - the real import runs server-side on the full file
      complete: (results) => {
        const headers = results.meta.fields || [];
        setPreview({ rowCount: results.data.length, signals: detectSignals(headers) });
      },
      error: () => setPreview(null),
    });
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) parseFile(e.target.files[0]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) parseFile(e.dataTransfer.files[0]);
  };

  const loadSample = async (sample) => {
    setMessage(null);
    try {
      const res = await fetch(sample.file);
      const blob = await res.blob();
      const f = new File([blob], sample.file.split('/').pop(), { type: 'text/csv' });
      parseFile(f, sample.packName);
    } catch {
      setMessage({ type: 'error', text: 'Failed to load the sample dataset.' });
    }
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    setMessage(null);
  };

  // Backfill an existing device's history (devices/:id/upload).
  const backfillMutation = useMutation({
    mutationFn: (f) => telemetryApi.importCsv(id, f),
    onSuccess: (data) => {
      setMessage({ type: 'success', text: data.message || 'File uploaded successfully.' });
      clearFile();
    },
    onError: (err) => {
      setMessage({ type: 'error', text: err.response?.data?.detail || err.message || 'Failed to upload file' });
    },
  });

  // Create a brand-new device from an uploaded CSV, then import it, then go
  // straight to its automated analytics report (app/upload, no :id yet).
  const createMutation = useMutation({
    mutationFn: async ({ f, name, signals }) => {
      const newDevice = await devicesApi.createDevice({
        serial_number: `BMS-${Date.now().toString(36).toUpperCase()}`,
        pack_name: name || humanizeFilename(f.name),
        chemistry: 'Li-ion',
        cell_count: signals?.cellCount || 16,
        thermistor_count: signals?.thermistorCount || 4,
        connection_type: 'SIMULATED',
      });
      await telemetryApi.importCsv(newDevice.id, f);
      return newDevice;
    },
    onSuccess: (newDevice) => {
      navigate(`/app/devices/${newDevice.id}/findings`);
    },
    onError: (err) => {
      setMessage({ type: 'error', text: err.response?.data?.detail || err.message || 'Failed to create a battery from this file' });
    },
  });

  const isSubmitting = isNewBatteryMode ? createMutation.isLoading : backfillMutation.isLoading;

  const handleSubmit = () => {
    if (!file) return;
    if (isNewBatteryMode) {
      createMutation.mutate({ f: file, name: packName, signals: preview?.signals });
    } else {
      backfillMutation.mutate(file);
    }
  };

  return (
    <div className="animate-in">
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Upload size={24} color="var(--accent-primary)" />
          {isNewBatteryMode ? 'Upload & Analyze' : 'Historical Data Ingestion'}
        </h2>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
          {isNewBatteryMode
            ? 'Upload a BMS CSV log to register a new battery and instantly generate its analytics report — no setup required.'
            : `Upload CSV files to backfill historical telemetry for ${device?.pack_name || 'this device'} (SN: ${device?.serial_number || ''})`}
        </div>
      </div>

      <div style={{ maxWidth: '680px', margin: '0 auto' }}>
        {isNewBatteryMode && (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-title" style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Sparkles size={16} color="var(--accent-primary)" /> Try a sample dataset
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              {SAMPLE_DATASETS.map((s) => (
                <button
                  key={s.file}
                  type="button"
                  onClick={() => loadSample(s)}
                  disabled={isSubmitting}
                  style={{
                    textAlign: 'left', padding: '0.85rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)', cursor: isSubmitting ? 'default' : 'pointer', transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={(e) => { if (!isSubmitting) e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>{s.label}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="card" style={{ textAlign: 'center', padding: '2.5rem 2rem' }}>
          <div
            style={{
              border: `2px dashed ${dragOver ? 'var(--accent-primary)' : 'var(--border-strong)'}`,
              borderRadius: 'var(--radius-lg)', padding: '2.5rem 2rem',
              background: dragOver ? 'var(--accent-light, var(--bg-secondary))' : 'var(--bg-secondary)',
              marginBottom: '1.25rem', position: 'relative', cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s',
            }}
            onClick={() => document.getElementById('csv-upload').click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <input id="csv-upload" type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileChange} />
            {file ? (
              <div>
                <FileText size={40} color="var(--accent-primary)" style={{ margin: '0 auto 0.75rem' }} />
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{file.name}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{(file.size / 1024).toFixed(0)} KB</div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); clearFile(); }}
                  style={{ marginTop: '0.75rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  <X size={12} /> Choose a different file
                </button>
              </div>
            ) : (
              <div>
                <Upload size={40} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem' }} />
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Drag &amp; drop a CSV file, or click to select</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Standard BMS telemetry format — see below</div>
              </div>
            )}
          </div>

          {preview && (
            <div style={{ textAlign: 'left', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.6rem' }}>
                Detected {preview.rowCount.toLocaleString()}{preview.rowCount >= 2000 ? '+' : ''} rows
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                <SignalBadge ok={preview.signals.voltage} label="Voltage" />
                <SignalBadge ok={preview.signals.current} label="Current" />
                <SignalBadge ok={preview.signals.soc} label="SOC" />
                <SignalBadge ok={preview.signals.soh} label="SOH" />
                <SignalBadge ok={preview.signals.cycle} label="Cycle number" />
                <SignalBadge ok={preview.signals.hasCellVoltage} label={`${preview.signals.cellCount} cells (voltage)`} />
                <SignalBadge ok={preview.signals.hasCellTemp} label={`${preview.signals.thermistorCount} thermistors`} />
              </div>
            </div>
          )}

          {isNewBatteryMode && file && (
            <div className="form-group" style={{ textAlign: 'left', marginBottom: '1.25rem' }}>
              <label className="form-label">Battery / Pack Name</label>
              <input type="text" className="form-input" value={packName} onChange={(e) => setPackName(e.target.value)} placeholder="e.g. Warehouse Forklift Pack A" />
            </div>
          )}

          {message && (
            <div className={`badge badge-${message.type === 'success' ? 'success' : 'danger'}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem', justifyContent: 'center', marginBottom: '1.25rem', width: '100%' }}>
              {message.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
              {message.text}
            </div>
          )}

          <button
            className="btn-primary"
            style={{ width: '100%', padding: '1rem', fontSize: '1rem' }}
            disabled={!file || isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting
              ? (isNewBatteryMode ? 'Creating & analyzing…' : 'Uploading…')
              : (isNewBatteryMode ? 'Create Battery & Analyze' : 'Start Import')}
          </button>

          <div style={{ marginTop: '2rem', textAlign: 'left', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <h4 style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Expected CSV Format</h4>
            <ul style={{ listStyle: 'disc', paddingLeft: '1.5rem' }}>
              <li><code>Timestamp</code> column with ISO dates</li>
              <li><code>Pack_Voltage</code> and <code>Pack_Current</code> columns</li>
              <li><code>SOC</code> and <code>SOH</code> percentage columns</li>
              <li>Optional: <code>Cell[1-N]_Voltage</code> (in V or mV)</li>
              <li>Optional: <code>Cell[1-N]_Temp</code> (in °C)</li>
              <li>Optional: <code>Cycle_Number</code> and <code>Capacity_Ah</code> for degradation trend analysis</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
