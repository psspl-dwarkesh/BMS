import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Upload, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import { telemetryApi, devicesApi } from '../api/endpoints';

export default function DataIngestion() {
  const { id } = useParams();
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState(null);

  const { data: device } = useQuery({
    queryKey: ['device', id],
    queryFn: () => devicesApi.getDevice(id),
    enabled: !!id
  });

  const uploadMutation = useMutation({
    mutationFn: (file) => telemetryApi.importCsv(id, file),
    onSuccess: (data) => {
      setMessage({ type: 'success', text: data.message || 'File uploaded successfully. Processing in background.' });
      setFile(null);
    },
    onError: (err) => {
      setMessage({ type: 'error', text: err.response?.data?.detail || err.message || 'Failed to upload file' });
    }
  });

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setMessage(null);
    }
  };

  const handleUpload = () => {
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  return (
    <div className="animate-in">
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Upload size={24} color="var(--accent-primary)" />
          Historical Data Ingestion
        </h2>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
          Upload CSV files to backfill historical telemetry for {device?.pack_name || 'this device'} (SN: {device?.serial_number})
        </div>
      </div>

      <div className="card" style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center', padding: '3rem 2rem' }}>
        <div 
          style={{ 
            border: '2px dashed var(--border-strong)', 
            borderRadius: 'var(--radius-lg)', 
            padding: '3rem 2rem', 
            background: 'var(--bg-secondary)',
            marginBottom: '1.5rem',
            position: 'relative',
            cursor: 'pointer'
          }}
          onClick={() => document.getElementById('csv-upload').click()}
        >
          <input 
            id="csv-upload" 
            type="file" 
            accept=".csv" 
            style={{ display: 'none' }} 
            onChange={handleFileChange}
          />
          {file ? (
            <div>
              <FileText size={48} color="var(--accent-primary)" style={{ margin: '0 auto 1rem' }} />
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{file.name}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</div>
            </div>
          ) : (
            <div>
              <Upload size={48} color="var(--text-muted)" style={{ margin: '0 auto 1rem' }} />
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Click to select a CSV file</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Supports standard BMS telemetry formats</div>
            </div>
          )}
        </div>

        {message && (
          <div className={`badge badge-${message.type === 'success' ? 'success' : 'danger'}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem', justifyContent: 'center', marginBottom: '1.5rem', width: '100%' }}>
            {message.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
            {message.text}
          </div>
        )}

        <button 
          className="btn-primary" 
          style={{ width: '100%', padding: '1rem', fontSize: '1rem' }} 
          disabled={!file || uploadMutation.isLoading}
          onClick={handleUpload}
        >
          {uploadMutation.isLoading ? 'Uploading...' : 'Start Import'}
        </button>

        <div style={{ marginTop: '2rem', textAlign: 'left', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <h4 style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Expected CSV Format</h4>
          <ul style={{ listStyle: 'disc', paddingLeft: '1.5rem' }}>
            <li><code>Timestamp</code> column with ISO dates</li>
            <li><code>Pack_Voltage</code> and <code>Pack_Current</code> columns</li>
            <li><code>SOC</code> and <code>SOH</code> percentage columns</li>
            <li>Optional: <code>Cell[1-N]_Voltage</code> (in V or mV)</li>
            <li>Optional: <code>Cell[1-N]_Temp</code> (in °C)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
