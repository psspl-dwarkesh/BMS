import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Papa from 'papaparse';
import { Upload, FileText, CheckCircle, AlertTriangle, Sparkles, Eye, EyeOff, Trash2, Battery, PlusCircle } from 'lucide-react';
import { telemetryApi, devicesApi } from '../api/endpoints';
import { importsQueryKey } from './UploadHistoryPanel';

// Bundled demo datasets (see backend/scripts/gen_sample_csvs.py for how
// they were generated) - let the "Upload & Analyze" flow work with zero
// setup, no user-supplied file required.
const SAMPLE_DATASETS = [
  { file: '/sample_ev_pack_healthy.csv', label: 'EV Pack — Healthy', desc: '16-cell pack, balanced cells, normal thermal behavior', packName: 'Sample EV Pack (Healthy)' },
  { file: '/sample_ev_pack_anomaly.csv', label: 'EV Pack — Cell Imbalance', desc: '16-cell pack with one weak cell and a thermal event', packName: 'Sample EV Pack (Anomaly)' },
  { file: '/sample_lab_cycling_degradation.csv', label: 'Lab Cycling — Degradation', desc: '60-cycle capacity fade / SOH trend dataset', packName: 'Sample Lab Cycling Pack' },
  { file: '/sample_full_demo_pack.csv', label: 'Comprehensive Demo — All Analytics', desc: '450 rows: cell imbalance, thermal event, degradation trend & GPS route in one file', packName: 'Comprehensive Demo Pack' },
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

let nextBatchId = 1;

const SignalBadge = ({ ok, label }) => (
  <span className={`badge badge-${ok ? 'success' : 'neutral'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
    {ok ? <CheckCircle size={12} /> : <AlertTriangle size={12} />} {label}
  </span>
);

// Upload & Analyze (app/upload). Two destinations for the files you add:
//   - "Append" to an already-registered battery (the primary/default choice
//     whenever you arrived here with one selected - see Layout.jsx's sidebar
//     link and UploadHistoryPanel's "Add more CSV data" shortcut, both of
//     which carry ?device=<id>). Every included file is imported into that
//     existing device as a new batch, alongside whatever it already has -
//     visible afterward in its Data Sources panel.
//   - "Create a new battery" (the only option when there's no device
//     context) - a brand-new device is registered, sized from the first
//     file's detected cell/thermistor count, then every included file is
//     imported into it.
// Either way, each file can be previewed, toggled in/out, or removed before
// anything is sent to the backend - reviewing a file without importing it is
// just leaving it selected without hitting the submit button.
export default function DataIngestion() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const requestedDeviceId = searchParams.get('device');

  // Reuses Layout's/FleetDashboard's cached ['devices'] query - no extra
  // network round trip just to resolve the target device's name.
  const { data: devices = [], isSuccess: devicesLoaded } = useQuery({
    queryKey: ['devices'],
    queryFn: devicesApi.getDevices,
  });
  const targetDevice = requestedDeviceId
    ? devices.find((d) => String(d.id) === String(requestedDeviceId))
    : null;

  // 'append' | 'create'. Defaults to append whenever a valid target device
  // is known - that's the common case (you were looking at a battery and
  // clicked "Add more data"/"Upload & Analyze") - and to create otherwise.
  const [mode, setMode] = useState(requestedDeviceId ? 'append' : 'create');
  useEffect(() => {
    if (devicesLoaded && targetDevice) setMode('append');
    else if (devicesLoaded && requestedDeviceId && !targetDevice) setMode('create'); // stale/inaccessible device id in the URL
  }, [devicesLoaded, targetDevice, requestedDeviceId]);

  // batch entries: { id, file, name, size, preview: {rowCount, signals}|null, included, expanded }
  const [batch, setBatch] = useState([]);
  const [activeId, setActiveId] = useState(null); // which entry's preview is currently expanded/"current"
  const [packName, setPackName] = useState('');
  const [message, setMessage] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadingFileId, setUploadingFileId] = useState(null);

  const addFiles = (fileList, defaultName) => {
    const files = Array.from(fileList || []).filter((f) => f);
    if (files.length === 0) return;
    setMessage(null);

    const entries = files.map((f) => ({
      id: nextBatchId++,
      file: f,
      name: f.name,
      size: f.size,
      preview: null,
      included: true,
      expanded: false,
    }));

    setBatch((prev) => {
      const next = [...prev, ...entries];
      // Default the pack name from the first file ever added.
      if (prev.length === 0) setPackName(defaultName || humanizeFilename(files[0].name));
      return next;
    });
    setActiveId(entries[entries.length - 1].id);

    entries.forEach((entry) => {
      Papa.parse(entry.file, {
        header: true,
        skipEmptyLines: true,
        preview: 2000, // cap client-side parse cost for a very large file - the real import runs server-side on the full file
        worker: true, // parse off the main thread so a big file doesn't visibly freeze the UI during preview
        complete: (results) => {
          const headers = results.meta.fields || [];
          const preview = { rowCount: results.data.length, signals: detectSignals(headers) };
          setBatch((prev) => prev.map((e) => (e.id === entry.id ? { ...e, preview } : e)));
        },
        error: () => {
          setBatch((prev) => prev.map((e) => (e.id === entry.id ? { ...e, preview: { rowCount: 0, signals: null, error: true } } : e)));
        },
      });
    });
  };

  const handleFileChange = (e) => {
    addFiles(e.target.files);
    e.target.value = ''; // allow re-selecting the same file(s) again
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  const loadSample = async (sample) => {
    setMessage(null);
    try {
      const res = await fetch(sample.file);
      const blob = await res.blob();
      const f = new File([blob], sample.file.split('/').pop(), { type: 'text/csv' });
      addFiles([f], sample.packName);
    } catch {
      setMessage({ type: 'error', text: 'Failed to load the sample dataset.' });
    }
  };

  const removeFile = (id) => {
    setBatch((prev) => prev.filter((e) => e.id !== id));
    setActiveId((cur) => (cur === id ? null : cur));
  };

  const toggleIncluded = (id) => {
    setBatch((prev) => prev.map((e) => (e.id === id ? { ...e, included: !e.included } : e)));
  };

  const toggleExpanded = (id) => {
    setBatch((prev) => prev.map((e) => (e.id === id ? { ...e, expanded: !e.expanded } : e)));
    setActiveId(id);
  };

  const clearAll = () => {
    setBatch([]);
    setActiveId(null);
    setMessage(null);
  };

  const includedFiles = batch.filter((e) => e.included);

  // Append mode: import every included file into the already-registered
  // target device, as additional batches alongside whatever it already has.
  // Create mode: register a brand-new device sized from the first included
  // file's detected signals, then import every included file into it.
  // Either way, land on the device's automated analytics report afterward.
  const createMutation = useMutation({
    mutationFn: async ({ files, name, mode: submitMode, deviceId }) => {
      let device;
      if (submitMode === 'append' && deviceId) {
        device = { id: deviceId };
      } else {
        const firstSignals = files.find((e) => e.preview?.signals)?.preview?.signals;
        device = await devicesApi.createDevice({
          serial_number: `BMS-${Date.now().toString(36).toUpperCase()}`,
          pack_name: name || humanizeFilename(files[0].file.name),
          chemistry: 'Li-ion',
          cell_count: firstSignals?.cellCount || 16,
          thermistor_count: firstSignals?.thermistorCount || 4,
          connection_type: 'SIMULATED',
        });
      }
      for (const entry of files) {
        setUploadingFileId(entry.id);
        await telemetryApi.importCsv(device.id, entry.file);
      }
      setUploadingFileId(null);
      return device;
    },
    onSuccess: (device) => {
      // Appended into an existing device: its Data Sources panel, Real-Time,
      // History, and every analytics tab need to see the new batch, not a
      // stale cached list from before this upload.
      queryClient.invalidateQueries({ queryKey: importsQueryKey(String(device.id)) });
      queryClient.invalidateQueries({ queryKey: ['telemetry-latest', String(device.id)] });
      queryClient.invalidateQueries({ queryKey: ['telemetry-history', String(device.id)] });
      queryClient.invalidateQueries({ queryKey: ['device-analytics', String(device.id)] });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      navigate(`/app/devices/${device.id}/findings`);
    },
    onError: (err) => {
      setUploadingFileId(null);
      setMessage({ type: 'error', text: err.response?.data?.detail || err.message || 'Failed to import these files' });
    },
  });

  const handleSubmit = () => {
    if (includedFiles.length === 0) return;
    if (mode === 'append' && !targetDevice) return; // guard: shouldn't be reachable, append UI only renders with a resolved target
    createMutation.mutate({ files: includedFiles, name: packName, mode, deviceId: targetDevice?.id });
  };

  return (
    <div className="animate-in">
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Upload size={24} color="var(--accent-primary)" />
          Upload &amp; Analyze
        </h2>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
          {mode === 'append' && targetDevice
            ? <>Add one or more BMS CSV logs to <strong>{targetDevice.pack_name}</strong> ({targetDevice.serial_number}) — they're imported as new batches, visible and manageable afterward in its Data Sources panel.</>
            : 'Upload one or more BMS CSV logs to register a new battery and instantly generate its analytics report — no setup required.'}
        </div>
      </div>

      <div style={{ maxWidth: '680px', margin: '0 auto' }}>
        {requestedDeviceId && targetDevice && (
          <div className="card" style={{ marginBottom: '1.5rem', padding: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setMode('append')}
                disabled={createMutation.isPending}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.65rem', fontSize: '0.82rem', fontWeight: 600,
                  borderRadius: 'var(--radius-md)', cursor: createMutation.isPending ? 'default' : 'pointer', border: `1.5px solid ${mode === 'append' ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                  background: mode === 'append' ? 'var(--accent-light)' : 'transparent', color: mode === 'append' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                }}
              >
                <Battery size={15} /> Append to {targetDevice.pack_name}
              </button>
              <button
                type="button"
                onClick={() => setMode('create')}
                disabled={createMutation.isPending}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.65rem', fontSize: '0.82rem', fontWeight: 600,
                  borderRadius: 'var(--radius-md)', cursor: createMutation.isPending ? 'default' : 'pointer', border: `1.5px solid ${mode === 'create' ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                  background: mode === 'create' ? 'var(--accent-light)' : 'transparent', color: mode === 'create' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                }}
              >
                <PlusCircle size={15} /> Create a new battery instead
              </button>
            </div>
          </div>
        )}

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
                disabled={createMutation.isPending}
                style={{
                  textAlign: 'left', padding: '0.85rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)', cursor: createMutation.isPending ? 'default' : 'pointer', transition: 'border-color 0.15s',
                }}
                onMouseEnter={(e) => { if (!createMutation.isPending) e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>{s.label}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.desc}</div>
              </button>
            ))}
          </div>
        </div>

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
            <input id="csv-upload" type="file" accept=".csv" multiple style={{ display: 'none' }} onChange={handleFileChange} />
            <Upload size={40} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem' }} />
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              Drag &amp; drop CSV file(s), or click to select
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              You can add multiple CSVs — each is imported into the same battery, like a real telemetry log arriving in batches.
            </div>
          </div>

          {batch.length > 0 && (
            <div style={{ textAlign: 'left', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {batch.length} file{batch.length > 1 ? 's' : ''} added — {includedFiles.length} will be imported
                </div>
                <button
                  type="button"
                  onClick={clearAll}
                  disabled={createMutation.isPending}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer' }}
                >
                  Clear all
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {batch.map((entry) => {
                  const isUploading = uploadingFileId === entry.id;
                  const isActive = activeId === entry.id;
                  return (
                    <div
                      key={entry.id}
                      style={{
                        border: `1px solid ${isActive ? 'var(--accent-primary)' : 'var(--border-light)'}`,
                        borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)', padding: '0.75rem',
                        opacity: entry.included ? 1 : 0.55, transition: 'opacity 0.15s, border-color 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <FileText size={18} color={isUploading ? 'var(--accent-primary)' : 'var(--text-muted)'} style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {entry.name}
                            {isUploading && <span style={{ marginLeft: '0.5rem', fontWeight: 500, color: 'var(--accent-primary)' }}>uploading…</span>}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {(entry.size / 1024).toFixed(0)} KB
                            {entry.preview ? ` · ${entry.preview.rowCount.toLocaleString()}${entry.preview.rowCount >= 2000 ? '+' : ''} rows` : ' · parsing…'}
                          </div>
                        </div>
                        <label
                          title={entry.included ? 'Included in import' : 'Excluded from import'}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}
                        >
                          <input type="checkbox" checked={entry.included} onChange={() => toggleIncluded(entry.id)} disabled={createMutation.isPending} />
                          Include
                        </label>
                        <button
                          type="button"
                          title={entry.expanded ? 'Hide details' : 'View details'}
                          onClick={() => toggleExpanded(entry.id)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem', flexShrink: 0 }}
                        >
                          {entry.expanded ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                        <button
                          type="button"
                          title="Remove file"
                          onClick={() => removeFile(entry.id)}
                          disabled={createMutation.isPending}
                          style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0.25rem', flexShrink: 0 }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {entry.expanded && (
                        <div style={{ marginTop: '0.65rem', paddingTop: '0.65rem', borderTop: '1px solid var(--border-light)' }}>
                          {entry.preview?.error ? (
                            <div style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>Couldn't parse this file as CSV.</div>
                          ) : entry.preview?.signals ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                              <SignalBadge ok={entry.preview.signals.voltage} label="Voltage" />
                              <SignalBadge ok={entry.preview.signals.current} label="Current" />
                              <SignalBadge ok={entry.preview.signals.soc} label="SOC" />
                              <SignalBadge ok={entry.preview.signals.soh} label="SOH" />
                              <SignalBadge ok={entry.preview.signals.cycle} label="Cycle number" />
                              <SignalBadge ok={entry.preview.signals.hasCellVoltage} label={`${entry.preview.signals.cellCount} cells (voltage)`} />
                              <SignalBadge ok={entry.preview.signals.hasCellTemp} label={`${entry.preview.signals.thermistorCount} thermistors`} />
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Parsing…</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {batch.length > 0 && mode === 'create' && (
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
            disabled={includedFiles.length === 0 || createMutation.isPending}
            onClick={handleSubmit}
          >
            {createMutation.isPending
              ? (mode === 'append' ? 'Adding & analyzing…' : 'Creating & analyzing…')
              : mode === 'append' && targetDevice
                ? `Add${includedFiles.length > 1 ? ` ${includedFiles.length} files` : ' Data'} to ${targetDevice.pack_name}`
                : `Create Battery & Analyze${includedFiles.length > 1 ? ` (${includedFiles.length} files)` : ''}`}
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
