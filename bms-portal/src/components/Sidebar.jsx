import { Activity, Battery, AlertTriangle, FileText, Settings, LayoutDashboard } from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab }) {
  const navItems = [
    { id: 'overview', label: 'System Overview', icon: <LayoutDashboard size={20} /> },
    { id: 'cells', label: 'Cell Analysis', icon: <Battery size={20} /> },
    { id: 'degradation', label: 'Degradation', icon: <Activity size={20} /> },
    { id: 'alerts', label: 'Anomalies & Alerts', icon: <AlertTriangle size={20} /> },
    { id: 'reports', label: 'Export Reports', icon: <FileText size={20} /> },
  ];

  return (
    <div className="sidebar">
      <div className="brand">
        <Battery className="brand-icon" size={28} />
        <h2 style={{ fontSize: '1.25rem', letterSpacing: '0.05em' }}>BMS <span className="text-gradient">Portal</span></h2>
      </div>
      
      <div style={{ flex: 1, marginTop: '1rem' }}>
        {navItems.map(item => (
          <div 
            key={item.id}
            className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => setActiveTab(item.id)}
          >
            {item.icon}
            {item.label}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }}>
        <div className="nav-item">
          <Settings size={20} />
          Settings
        </div>
      </div>
    </div>
  );
}
