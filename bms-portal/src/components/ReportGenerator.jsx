import { useState } from 'react';
import { FileText, Download, CheckCircle2, File, Calendar, Database } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function ReportGenerator({ data }) {
  const [generating, setGenerating] = useState(false);
  const [complete, setComplete] = useState(false);
  const [reportType, setReportType] = useState('full');

  const generatePDF = () => {
    if (!data) return;
    setGenerating(true);
    setComplete(false);

    setTimeout(() => {
      const doc = new jsPDF();
      const { kpis, timeSeries, anomalies, status } = data;
      const pack = kpis.pack;
      const now = new Date();

      // Header
      doc.setFillColor(12, 25, 41);
      doc.rect(0, 0, 210, 40, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('BMS Analytics Report', 15, 20);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated: ${now.toLocaleString()}  |  Status: ${status}`, 15, 30);

      // KPIs Section
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Pack-Level KPIs', 15, 55);
      
      const n = (v, d = 1) => (v === null || v === undefined || isNaN(v)) ? 'N/A' : `${v.toFixed(d)}`;

      autoTable(doc, {
        startY: 60,
        head: [['Metric', 'Value', 'Min', 'Max']],
        body: [
          ['Avg Voltage', `${n(pack.avgVoltage, 2)} V`, `${n(pack.minVoltage)} V`, `${n(pack.maxVoltage)} V`],
          ['Avg Current', `${n(pack.avgCurrent, 2)} A`, `${n(pack.minCurrent)} A`, `${n(pack.maxCurrent)} A`],
          ['Temperature', `${n(pack.avgTemp)} °C`, `${n(pack.minTemp)} °C`, `${n(pack.maxTemp)} °C`],
          ['State of Charge', `${n(pack.finalSOC)} %`, pack.minSOC !== null ? `${pack.minSOC.toFixed(1)} %` : '-', pack.maxSOC !== null ? `${pack.maxSOC.toFixed(1)} %` : '-'],
          ['SOC Operating Range', pack.socRange !== null ? `${pack.socRange.toFixed(1)} %` : 'N/A', '-', '-'],
          ['Est. SOH', pack.estimatedSOH === null ? 'Insufficient data' : `${pack.estimatedSOH} % (${pack.estimatedSOHIsEstimate ? 'estimated' : 'measured'})`, '-', '-'],
          ['Energy Charged', `${pack.energyChargedKWh.toFixed(2)} kWh`, '-', '-'],
          ['Energy Discharged', `${pack.energyDischargedKWh.toFixed(2)} kWh`, '-', '-'],
          ['Charge/Discharge Efficiency', pack.chargeDischargeEfficiency !== null ? `${pack.chargeDischargeEfficiency.toFixed(1)} %` : 'N/A', '-', '-'],
          ['Operating Duration', `${pack.operatingDurationHrs.toFixed(1)} h`, '-', '-'],
          ['Charge Duration', `${pack.chargeDurationHrs.toFixed(1)} h`, '-', '-'],
          ['Discharge Duration', `${pack.dischargeDurationHrs.toFixed(1)} h`, '-', '-'],
        ],
        headStyles: { fillColor: [8, 145, 178], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [240, 249, 255] },
        styles: { fontSize: 9 },
      });

      // Anomalies Section
      if (reportType === 'full' && anomalies.length > 0) {
        const anomalyY = doc.lastAutoTable.finalY + 15;
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Detected Anomalies', 15, anomalyY);

        autoTable(doc, {
          startY: anomalyY + 5,
          head: [['Time', 'Type', 'Severity', 'Description', 'Component']],
          body: anomalies.map(a => [
            String(a.timestamp), a.type, a.severity, a.description, a.affected
          ]),
          headStyles: { fillColor: [239, 68, 68], textColor: 255 },
          styles: { fontSize: 8 },
        });
      }

      // Time-series table (summary)
      if (reportType === 'full') {
        const tsY = doc.lastAutoTable.finalY + 15;
        if (tsY < 250) {
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.text('Time-Series Summary (sampled)', 15, tsY);
          
          const sampleRows = timeSeries.filter((_, i) => i % Math.max(1, Math.floor(timeSeries.length / 10)) === 0);
          const nRow = (v) => (v === null || v === undefined || isNaN(v)) ? 'N/A' : v.toFixed(1);
          autoTable(doc, {
            startY: tsY + 5,
            head: [['Time', 'Voltage (V)', 'Current (A)', 'Temp (°C)', 'SOC (%)', 'Cell Spread (mV)']],
            body: sampleRows.map(r => [
              String(r.time), nRow(r.voltage), nRow(r.current),
              nRow(r.temperature), nRow(r.soc), r.vSpread === null ? 'N/A (no cell data)' : nRow(r.vSpread)
            ]),
            headStyles: { fillColor: [8, 145, 178], textColor: 255 },
            alternateRowStyles: { fillColor: [240, 249, 255] },
            styles: { fontSize: 8 },
          });
        }
      }

      // Footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`BMS Analytics — Confidential  |  Page ${i} of ${pageCount}`, 15, 285);
      }

      doc.save(`BMS-Report-${now.toISOString().split('T')[0]}.pdf`);
      setGenerating(false);
      setComplete(true);
    }, 800);
  };
  
  const generateCSV = () => {
    if (!data) return;
    const { kpis, anomalies, status } = data;
    const pack = kpis.pack;
    
    const n = (v, d = 1) => (v === null || v === undefined || isNaN(v)) ? 'N/A' : v.toFixed(d);

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "BMS Analytics Summary Report\n\n";
    csvContent += `Generated,${new Date().toISOString()}\n`;
    csvContent += `Overall Status,${status}\n\n`;

    csvContent += "--- PACK KPIs ---\n";
    csvContent += "Metric,Value,Unit\n";
    csvContent += `Average Voltage,${n(pack.avgVoltage, 2)},V\n`;
    csvContent += `Max Voltage,${n(pack.maxVoltage)},V\n`;
    csvContent += `Min Voltage,${n(pack.minVoltage)},V\n`;
    csvContent += `Average Current,${n(pack.avgCurrent, 2)},A\n`;
    csvContent += `Max Current,${n(pack.maxCurrent)},A\n`;
    csvContent += `Average Temp,${n(pack.avgTemp)},C\n`;
    csvContent += `Initial SOC,${pack.initialSOC !== null && pack.initialSOC !== undefined ? Number(pack.initialSOC).toFixed(1) : 'N/A'},%\n`;
    csvContent += `Final SOC,${n(pack.finalSOC)},%\n`;
    csvContent += `SOC Operating Range,${pack.socRange !== null ? pack.socRange.toFixed(1) : 'N/A'},%\n`;
    csvContent += `Estimated SOH,${pack.estimatedSOH === null ? 'Insufficient data' : pack.estimatedSOH},%\n`;
    csvContent += `SOH Basis,${pack.estimatedSOH === null ? 'N/A' : (pack.estimatedSOHIsEstimate ? 'Estimated (Coulomb-counting/EKF - no SOH/capacity column in source CSV)' : 'Measured (from CSV SOH/health column)')}\n`;
    csvContent += `Energy Charged,${pack.energyChargedKWh.toFixed(2)},kWh\n`;
    csvContent += `Energy Discharged,${pack.energyDischargedKWh.toFixed(2)},kWh\n`;
    csvContent += `Charge/Discharge Efficiency,${pack.chargeDischargeEfficiency !== null ? pack.chargeDischargeEfficiency.toFixed(1) : 'N/A'},%\n`;
    csvContent += `Operating Duration,${pack.operatingDurationHrs.toFixed(1)},hours\n`;
    csvContent += `Charge Duration,${pack.chargeDurationHrs.toFixed(1)},hours\n`;
    csvContent += `Discharge Duration,${pack.dischargeDurationHrs.toFixed(1)},hours\n\n`;
    
    csvContent += "--- ANOMALIES ---\n";
    csvContent += "Time,Severity,Type,Description,Component\n";
    if (anomalies && anomalies.length > 0) {
      anomalies.forEach(a => {
        csvContent += `${a.timestamp},${a.severity},${a.type},"${a.description}",${a.affected}\n`;
      });
    } else {
      csvContent += "No anomalies detected.\n";
    }
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `BMS-Summary-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'grid', gridTemplateColumns: data ? '1fr 1fr' : '1fr', gap: '1.5rem', maxWidth: '800px' }}>
        {/* Report config */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Report Configuration</div>
              <div className="card-subtitle">Select report type and generate</div>
            </div>
            <FileText size={20} color="var(--accent-primary)" />
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">Report Type</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {[
                { id: 'full', label: 'Full Diagnostic', icon: <File size={14} /> },
                { id: 'summary', label: 'KPI Summary', icon: <Calendar size={14} /> },
              ].map(rt => (
                <div
                  key={rt.id}
                  onClick={() => setReportType(rt.id)}
                  style={{
                    flex: 1, padding: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
                    border: `2px solid ${reportType === rt.id ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                    background: reportType === rt.id ? 'var(--accent-light)' : 'var(--bg-primary)',
                    color: reportType === rt.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '500', transition: 'all 0.15s'
                  }}
                >
                  {rt.icon} {rt.label}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button className="btn-primary" onClick={generatePDF} disabled={!data || generating} style={{ width: '100%', padding: '0.8rem' }}>
              {generating ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} />
                  Compiling PDF...
                </span>
              ) : (
                <><Download size={16} /> {data ? 'Generate & Download PDF' : 'Load Data First'}</>
              )}
            </button>
            <button className="btn-secondary" onClick={generateCSV} disabled={!data || generating} style={{ width: '100%', padding: '0.8rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
              <Database size={16} /> {data ? 'Export CSV Summary' : 'Load Data First'}
            </button>
          </div>
          
          {!data && <p style={{ color: 'var(--danger)', fontSize: '0.78rem', marginTop: '0.75rem', textAlign: 'center' }}>Upload or load a dataset to generate reports.</p>}
        </div>

        {/* Report preview */}
        {data && (
          <div className="card" style={{ background: complete ? 'var(--success-bg)' : 'var(--bg-secondary)', borderColor: complete ? 'var(--success)' : undefined }}>
            {complete ? (
              <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                <CheckCircle2 size={48} color="var(--success)" style={{ marginBottom: '1rem' }} />
                <h3 style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>Report Downloaded</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>Your PDF has been saved.</p>
                <button className="btn-secondary" onClick={() => setComplete(false)}>Generate Another</button>
              </div>
            ) : (
              <div>
                <div className="card-title" style={{ marginBottom: '1rem' }}>Report Preview</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div>📊 Pack KPIs: Voltage, Current, Temperature, SOC, SOH, Energy, Efficiency, Duration</div>
                  <div>⚠️ Anomalies: {data.anomalies?.length || 0} detected events</div>
                  <div>📈 Time-series: {data.timeSeries?.length || 0} sampled data points</div>
                  <div>🔋 Cell Analysis: 4-cell voltage distribution</div>
                  {reportType === 'full' && <div>📋 Full tables with sampled row data</div>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
