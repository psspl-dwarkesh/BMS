import { useState, useCallback } from 'react';
import { UploadCloud, File, AlertCircle } from 'lucide-react';
import { parseCSV } from '../utils/csvParser';

export default function FileUpload({ onDataProcessed }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const processFile = async (file) => {
    if (!file || !file.name.endsWith('.csv')) {
      setError('Please upload a valid CSV file.');
      return;
    }
    
    setError(null);
    setIsProcessing(true);
    
    try {
      const analyticsData = await parseCSV(file);
      onDataProcessed(analyticsData);
    } catch (err) {
      console.error(err);
      setError('Error parsing the CSV file. Please ensure it follows the BMS data format.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="upload-container animate-fade-in">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Upload BMS Data</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
          Upload your pack or cell-level CSV data to generate advanced battery analytics and diagnostics.
        </p>
      </div>

      <label 
        className="upload-zone"
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        style={{
          borderColor: isDragging ? 'var(--accent-primary)' : 'var(--border-glass)',
          background: isDragging ? 'rgba(59, 130, 246, 0.05)' : 'rgba(255, 255, 255, 0.02)'
        }}
      >
        <div className="upload-icon-wrapper">
          <UploadCloud size={48} />
        </div>
        
        <div>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>
            {isProcessing ? 'Processing Data...' : 'Drag & drop your CSV here'}
          </h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            or click to browse from your computer
          </p>
        </div>

        <input 
          type="file" 
          accept=".csv" 
          onChange={handleChange} 
          style={{ display: 'none' }} 
          disabled={isProcessing}
        />
        
        {isProcessing && (
          <div style={{ marginTop: '1rem', color: 'var(--accent-primary)' }}>
            <div style={{ 
              width: '40px', 
              height: '40px', 
              border: '3px solid rgba(59,130,246,0.3)', 
              borderTopColor: 'var(--accent-primary)', 
              borderRadius: '50%', 
              animation: 'spin 1s linear infinite',
              margin: '0 auto'
            }}></div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}
      </label>

      {error && (
        <div className="glass-card" style={{ marginTop: '1.5rem', borderColor: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
          <AlertCircle color="var(--danger)" />
          <span style={{ color: 'var(--danger)' }}>{error}</span>
        </div>
      )}
      
      <div className="glass-card" style={{ marginTop: '2rem', textAlign: 'left', width: '100%' }}>
        <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <File size={18} /> Required CSV Structure
        </h4>
        <ul style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6', paddingLeft: '1.5rem' }}>
          <li><strong>Pack-Level Data:</strong> Timestamp, Pack Voltage, Pack Current, SOC, Pack Temperature</li>
          <li><strong>Cell-Level Data (Optional):</strong> Cell1_Voltage, Cell2_Voltage, etc.</li>
        </ul>
      </div>
    </div>
  );
}
