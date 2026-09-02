import { useState, useCallback } from 'react';
import { UploadCloud, FileText, Database, Check, ChevronRight, X, AlertCircle, Eye, EyeOff, Trash2 } from 'lucide-react';
import { parseMultipleCSV } from '../utils/csvParser';

export default function DataIngestion({ onDataProcessed, analyticsData, onUpdateDatasets }) {
  const [files, setFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState(null);
  const [datasetPreview, setDatasetPreview] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setIsDragging(true);
    else if (e.type === 'dragleave') setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      const newFiles = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.csv'));
      if (newFiles.length > 0) setFiles(prev => [...prev, ...newFiles]);
    }
  }, []);

  const handleChange = (e) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).filter(f => f.name.endsWith('.csv'));
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index) => setFiles(files.filter((_, i) => i !== index));

  const processAllFiles = async (append = false) => {
    setIsProcessing(true);
    setError(null);
    try {
      const parsedData = await parseMultipleCSV(files);
      
      // Validate schema compatibility before appending
      if (append && analyticsData && analyticsData.datasets && analyticsData.datasets.length > 0) {
        const existingKeys = Object.keys(analyticsData.datasets[0].data[0] || {}).sort().join(',');
        const newKeys = Object.keys(parsedData.datasets[0].data[0] || {}).sort().join(',');
        
        if (existingKeys !== newKeys) {
          setError('Column mismatch! Cannot append a dataset with different structures. Please use "Replace Data" instead.');
          setIsProcessing(false);
          return;
        }
      }

      onDataProcessed(parsedData, append);
      setFiles([]); // clear queue on success
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to parse the CSV file. Please check the format.');
    } finally {
      setIsProcessing(false);
    }
  };

  const loadValidationCase = async (caseId) => {
    setIsProcessing(true);
    setError(null);
    try {
      const fileName = caseId === 1 ? 'ev_battery_validation.csv' : 'lab_cycling_validation.csv';
      const response = await fetch(`/${fileName}`);
      if (!response.ok) throw new Error(`Failed to load ${fileName}`);
      const text = await response.text();
      const file = new File([text], fileName, { type: 'text/csv' });
      setFiles([file]);
    } catch (err) {
      console.error(err);
      setError('Error loading validation dataset. File might not exist.');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const hasDatasets = analyticsData && analyticsData.datasets && analyticsData.datasets.length > 0;

  return (
    <div className="animate-in" style={{ padding: '0 1rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.35rem' }}>Data Ingestion</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Upload new CSV files or manage currently active datasets.</p>
      </div>

      {error && (
        <div className="card" style={{ borderColor: 'var(--danger)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem' }}>
          <AlertCircle size={18} color="var(--danger)" />
          <span style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{error}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: hasDatasets ? '2fr 1fr' : '1fr', gap: '2rem', alignItems: 'flex-start', transition: 'all 0.3s' }}>
        {/* Left Side: Upload Zone */}
        <div className="card" style={{ maxWidth: hasDatasets ? '100%' : '720px', margin: hasDatasets ? '0' : '0 auto', width: '100%' }}>
          <label
            htmlFor="csv-upload"
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`upload-zone ${isDragging ? 'dragging' : ''}`}
            style={{ marginBottom: files.length > 0 ? '1.5rem' : 0 }}
          >
            <UploadCloud size={40} color={isDragging ? 'var(--accent-primary)' : 'var(--text-muted)'} />
            <div>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>Drag & drop CSV files here</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>or click to browse from your computer</p>
            </div>
            <input id="csv-upload" type="file" multiple accept=".csv" onChange={handleChange} style={{ display: 'none' }} />
          </label>

          {files.length === 0 && (
            <div style={{ marginTop: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ height: '1px', flex: 1, background: 'var(--border-default)' }} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Predefined Validation Cases</span>
                <div style={{ height: '1px', flex: 1, background: 'var(--border-default)' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', cursor: 'pointer', transition: 'border-color 0.2s', border: '1px solid var(--border-default)' }} onClick={() => loadValidationCase(1)} onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent-primary)'} onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-default)'}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--accent-primary)' }}>
                    <AlertCircle size={16} />
                    <span style={{ fontWeight: '600', fontSize: '0.85rem' }}>EV Battery Anomaly</span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem', flex: 1 }}>Demonstrates cell imbalance and a severe thermal anomaly detection (ISO 26262 warnings).</p>
                  <button className="btn-secondary" style={{ width: '100%', fontSize: '0.75rem', padding: '0.4rem' }}>Load Case 1</button>
                </div>
                
                <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', cursor: 'pointer', transition: 'border-color 0.2s', border: '1px solid var(--border-default)' }} onClick={() => loadValidationCase(2)} onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent-primary)'} onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-default)'}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--warning)' }}>
                    <Database size={16} />
                    <span style={{ fontWeight: '600', fontSize: '0.85rem' }}>Lab Cycling Degradation</span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem', flex: 1 }}>700-cycle lab dataset demonstrating long-term capacity fade and SOH estimation curves.</p>
                  <button className="btn-secondary" style={{ width: '100%', fontSize: '0.75rem', padding: '0.4rem' }}>Load Case 2</button>
                </div>
              </div>
            </div>
          )}

          {files.length > 0 && (
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                Files Queued for Import ({files.length})
              </div>
              {files.map((f, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.6rem 0.75rem', marginBottom: '0.35rem',
                  background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <FileText size={16} color="var(--text-secondary)" />
                    <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>{f.name}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{formatSize(f.size)}</span>
                  </div>
                  <button className="btn-ghost" onClick={() => removeFile(i)} style={{ padding: '0.25rem' }}>
                    <X size={14} />
                  </button>
                </div>
              ))}
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-light)' }}>
                <button 
                  className="btn-secondary" 
                  onClick={() => {
                    if (hasDatasets) {
                      setShowConfirm(true);
                    } else {
                      processAllFiles(false);
                    }
                  }} 
                  disabled={isProcessing}
                  style={{ color: hasDatasets ? 'var(--danger)' : 'inherit', borderColor: hasDatasets ? 'var(--danger)' : '' }}
                >
                  {isProcessing ? 'Processing...' : (hasDatasets ? 'Replace Data' : 'Process Data')}
                </button>
                {hasDatasets && (
                  <button className="btn-primary" onClick={() => processAllFiles(true)} disabled={isProcessing}>
                    {isProcessing ? 'Processing...' : 'Append Data'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Active Datasets */}
        {hasDatasets && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="card">
              <div className="card-header" style={{ marginBottom: '1rem' }}>
                <div>
                  <div className="card-title" style={{ fontSize: '1rem' }}>Active Datasets</div>
                  <div className="card-subtitle" style={{ fontSize: '0.75rem' }}>Manage files loaded in memory</div>
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {analyticsData.datasets.map((d, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Database size={14} color={d.active !== false ? 'var(--accent-primary)' : 'var(--text-muted)'} />
                        <span style={{ fontWeight: '500', fontSize: '0.85rem', color: d.active !== false ? 'var(--text-primary)' : 'var(--text-muted)' }}>{d.name}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {/* Real Toggle Component */}
                        <label className="toggle-switch" title="Toggle Dataset">
                          <input 
                            type="checkbox" 
                            checked={d.active !== false} 
                            onChange={() => {
                              const newDatasets = [...analyticsData.datasets];
                              newDatasets[i].active = !newDatasets[i].active;
                              onUpdateDatasets(newDatasets);
                            }}
                          />
                          <span className="slider round"></span>
                        </label>
                        <button className="btn-ghost" title="Remove" onClick={() => {
                          const newDatasets = analyticsData.datasets.filter((_, idx) => idx !== i);
                          onUpdateDatasets(newDatasets);
                        }} style={{ padding: '0.25rem', color: 'var(--danger)' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    
                    <button className="btn-ghost" onClick={() => setDatasetPreview(datasetPreview?.name === d.name ? null : d)} style={{ width: '100%', fontSize: '0.7rem', padding: '0.35rem', display: 'flex', justifyContent: 'center', background: 'var(--bg-panel)' }}>
                      {datasetPreview?.name === d.name ? 'Hide Content' : 'View Content'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Dataset Preview Panel */}
            {datasetPreview && (
              <div className="card animate-fade-in" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ fontWeight: '600', fontSize: '0.8rem', color: 'var(--text-primary)' }}>{datasetPreview.name} Preview</div>
                  <button className="btn-ghost" onClick={() => setDatasetPreview(null)} style={{ padding: '0' }}><X size={14} /></button>
                </div>
                {datasetPreview.data && datasetPreview.data.length > 0 ? (
                  <div style={{ fontSize: '0.7rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', background: 'var(--bg-panel)', padding: '0.5rem', borderRadius: '4px', maxHeight: '300px', overflowY: 'auto' }}>
                    {JSON.stringify(datasetPreview.data.slice(0, 3), null, 2)}
                    {datasetPreview.data.length > 3 && `\n\n... and ${datasetPreview.data.length - 3} more rows.`}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No parseable data found.</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Custom Confirmation Modal */}
      <div className={`modal-backdrop ${showConfirm ? 'open' : ''}`} onClick={() => setShowConfirm(false)}>
        <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
          <div className="modal-header">
            <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)' }}>
              <AlertCircle size={18} /> Replace All Data?
            </h3>
            <button className="modal-close" onClick={() => setShowConfirm(false)}><X size={20} /></button>
          </div>
          <div className="modal-body">
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Are you sure you want to replace all currently active datasets? This action will clear your session and overwrite your dashboard with the new files.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button className="btn-secondary" onClick={() => setShowConfirm(false)}>
                Cancel
              </button>
              <button className="btn-primary" style={{ background: 'var(--danger)' }} onClick={() => {
                setShowConfirm(false);
                processAllFiles(false);
              }}>
                Replace Data
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
