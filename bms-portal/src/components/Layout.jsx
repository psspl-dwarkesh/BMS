import { useState, useRef, useEffect } from 'react';
import { Globe, LayoutDashboard, Battery, Activity, AlertTriangle, Thermometer, Upload, FileText, Search, Bell, Settings, X, LogOut, Zap, Menu, Shield, Database, UploadCloud, CheckCircle2, ChevronRight, Eye, EyeOff, Trash2, Plus } from 'lucide-react';
import { reprocessDatasets } from '../utils/csvParser';
import Dashboard from './Dashboard';
import CellAnalysis from './CellAnalysis';
import DataIngestion from './DataIngestion';
import ReportGenerator from './ReportGenerator';
import DataQuality from './DataQuality';
import DegradationAnalysis from './DegradationAnalysis';
import ThermalAnalysis from './ThermalAnalysis';
import AutomatedFindings from './AutomatedFindings';
import FleetDashboard from './FleetDashboard';

export default function Layout({ user, analyticsData, onDataProcessed, onUpdateDatasets, onBackToLanding }) {
  // Use window.location.hash if present, otherwise default to dashboard
  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    return hash || 'fleet';
  });
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showAccessControl, setShowAccessControl] = useState(false);
  const [showDatasetMenu, setShowDatasetMenu] = useState(false);
  
  // Real-time Anomaly WebSocket State
  const [liveAlerts, setLiveAlerts] = useState([]);
  const [unreadAlerts, setUnreadAlerts] = useState(false);
  
  // Custom Alert Rules
  const [customRules, setCustomRules] = useState([
    { id: 1, metric: 'Temperature', operator: '>', value: '55', duration: '10' }
  ]);
  const [newRule, setNewRule] = useState({ metric: 'Voltage', operator: '<', value: '', duration: '' });
  
  const profileRef = useRef(null);
  const notifRef = useRef(null);
  const wsRef = useRef(null);

  // Initialize WebSocket for real-time alerts
  useEffect(() => {
    // In a real app this would point to the deployed FastAPI backend
    wsRef.current = new WebSocket('ws://localhost:8000/ws/alerts');
    
    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'ANOMALY_ALERT') {
          setLiveAlerts(prev => [data, ...prev]);
          setUnreadAlerts(true);
        }
      } catch (e) {
        console.error("Failed to parse websocket message", e);
      }
    };

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // Sync hash with activeTab
  useEffect(() => {
    window.location.hash = activeTab;
  }, [activeTab]);

  // Listen to hash changes (e.g. back/forward buttons)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && tabTitles[hash]) setActiveTab(hash);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) setShowProfile(false);
      if (notifRef.current && !notifRef.current.contains(event.target)) setShowNotifications(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navItems = [
    { id: 'fleet', label: 'Fleet Overview', icon: <Globe size={18} /> },
    { id: 'dashboard', label: 'Single Pack Dashboard', icon: <LayoutDashboard size={18} /> },
    { id: 'quality', label: 'Data Quality', icon: <CheckCircle2 size={18} /> },
    { id: 'cells', label: 'Cell Analysis', icon: <Battery size={18} /> },
    { id: 'degradation', label: 'Degradation', icon: <Activity size={18} /> },
    { id: 'thermal', label: 'Thermal', icon: <Thermometer size={18} /> },
    { id: 'alerts', label: 'Alerts', icon: <AlertTriangle size={18} /> },
    { id: 'findings', label: 'Findings & Outputs', icon: <FileText size={18} /> },
  ];

  const isViewer = user?.role === 'Viewer';
  const isAdmin = user?.role === 'Admin';

  const toolItems = [
    ...(isViewer ? [] : [{ id: 'upload', label: 'Data Upload', icon: <Upload size={18} /> }]),
    { id: 'reports', label: 'Reports', icon: <FileText size={18} /> },
  ];

  const tabTitles = {
    dashboard: 'Dashboard',
    cells: 'Cell Analysis',
    degradation: 'Degradation Analysis',
    thermal: 'Thermal Analysis',
    alerts: 'Alerts & Anomalies',
    findings: 'Automated Findings & Outputs',
    upload: 'Data Ingestion',
    reports: 'Report Generation',
  };

  const handleNavClick = (tabId) => {
    setActiveTab(tabId);
    setSidebarOpen(false);
  };

  const handleToggleDataset = (index) => {
    if (!analyticsData || !analyticsData.datasets) return;
    const newDatasets = [...analyticsData.datasets];
    newDatasets[index].active = !newDatasets[index].active;
    onUpdateDatasets(newDatasets);
  };

  const handleRemoveDataset = (index) => {
    if (!analyticsData || !analyticsData.datasets) return;
    const newDatasets = analyticsData.datasets.filter((_, i) => i !== index);
    onUpdateDatasets(newDatasets);
    if (newDatasets.length === 0) setShowDatasetManager(false);
  };

  const renderContent = () => {
    if (!analyticsData && activeTab !== 'upload') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '4rem 2rem', textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'var(--bg-panel)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', border: '1px solid var(--border-default)' }}>
            <Upload size={28} color="var(--accent-primary)" />
          </div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>No Data Loaded</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', maxWidth: '400px' }}>
            Upload a BMS CSV dataset or load sample data to begin viewing analytics and diagnostics.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn-primary" onClick={() => setActiveTab('upload')}>
              <Upload size={16} /> Upload CSV Data
            </button>
            <button className="btn-secondary" onClick={async () => {
              try {
                const response = await fetch('/sample_bms_data.csv');
                const text = await response.text();
                const file = new File([text], 'sample_bms_data.csv', { type: 'text/csv' });
                const { parseCSV } = await import('../utils/csvParser');
                const data = await parseCSV(file);
                onDataProcessed(data);
              } catch (err) {
                console.error(err);
              }
            }}>
              Load Sample Data
            </button>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'fleet': return <FleetDashboard onSelectPack={() => setActiveTab('dashboard')} />;
      case 'dashboard': return <Dashboard data={analyticsData} />;
      case 'quality': return <DataQuality analyticsData={analyticsData} />;
      case 'cells': return <CellAnalysis data={analyticsData} />;
      case 'upload': return <DataIngestion onDataProcessed={(data, append) => { onDataProcessed(data, append); setActiveTab('dashboard'); }} analyticsData={analyticsData} onUpdateDatasets={onUpdateDatasets} />;
      case 'reports': return <ReportGenerator data={analyticsData} />;
      
      case 'degradation': return <DegradationAnalysis data={analyticsData} />;
      
      case 'thermal': return <ThermalAnalysis data={analyticsData} />;
      case 'findings': return <AutomatedFindings data={analyticsData} />;
      case 'alerts': {
        const fullAnomalies = analyticsData?.allAnomalies || analyticsData?.anomalies || [];
        const totalCount = analyticsData?.anomalySummary?.total ?? fullAnomalies.length;
        return (
          <div className="animate-fade-in">
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Detected Anomalies</div>
                  <div className="card-subtitle">System-generated alerts from analytics engine</div>
                </div>
                {analyticsData && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {analyticsData.anomalySummary?.critical > 0 && <span className="badge badge-danger">{analyticsData.anomalySummary.critical} critical</span>}
                    {analyticsData.anomalySummary?.warning > 0 && <span className="badge badge-warning">{analyticsData.anomalySummary.warning} warning</span>}
                    <span className="badge badge-neutral">{totalCount} total</span>
                  </div>
                )}
              </div>
              {analyticsData && fullAnomalies.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Severity</th>
                        <th>Type</th>
                        <th>Description</th>
                        <th>Component</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fullAnomalies.map((a, idx) => (
                        <tr key={idx}>
                          <td style={{ color: 'var(--text-secondary)' }}>{a.timestamp}</td>
                          <td><span className={`badge badge-${a.severity === 'Critical' ? 'danger' : 'warning'}`}>{a.severity}</span></td>
                          <td style={{ fontWeight: '500' }}>{a.type}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{a.description}</td>
                          <td>{a.affected}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  <AlertTriangle size={32} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
                  <p style={{ fontWeight: '500' }}>No anomalies detected</p>
                  <p style={{ fontSize: '0.8rem' }}>System is operating within normal parameters.</p>
                </div>
              )}
            </div>
          </div>
        );
      }
      default: return null;
    }
  };

  return (
    <div className="portal-container">
      {/* Mobile overlay */}
      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />

      <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <aside className={`portal-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand" style={{ cursor: 'pointer' }} onClick={() => window.location.hash = 'dashboard'}>
          <div className="sidebar-brand-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="6" y="4" width="12" height="18" rx="2" ry="2" />
              <line x1="10" y1="1" x2="10" y2="4" />
              <line x1="14" y1="1" x2="14" y2="4" />
              <line x1="9" y1="14" x2="15" y2="14" />
              <line x1="12" y1="11" x2="12" y2="17" />
            </svg>
          </div>
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-name">BMS Analytics</span>
            <span className="sidebar-brand-sub">{user?.role || 'Battery Portal'}</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Analytics</div>
          {navItems.map(item => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={`sidebar-nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); handleNavClick(item.id); }}
              style={{ textDecoration: 'none' }}
            >
              {item.icon}
              {item.label}
              {item.id === 'alerts' && analyticsData && analyticsData.anomalies.length > 0 && (
                <span className="nav-badge" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
                  {analyticsData.anomalies.length}
                </span>
              )}
            </a>
          ))}

          <div className="sidebar-section-label">Tools</div>
          {toolItems.map(item => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={`sidebar-nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); handleNavClick(item.id); }}
              style={{ textDecoration: 'none' }}
            >
              {item.icon}
              {item.label}
            </a>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user" onClick={() => setShowProfile(!showProfile)}>
            <div className="sidebar-user-avatar" style={{ background: 'var(--accent-primary)' }}>
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user?.name || 'User'}</span>
              <span className="sidebar-user-role">{user?.role || 'Engineer'}</span>
            </div>
          </div>
          
          {/* Profile Dropdown */}
          {showProfile && (
            <div ref={profileRef} className="dropdown-menu" style={{ bottom: '4rem', top: 'auto', left: '1rem', right: 'auto', width: '200px' }}>
              {!isViewer && (
                <div className="dropdown-item" onClick={() => setShowSettings(true)}>
                  <Settings size={16} /> System Settings
                </div>
              )}
              {isAdmin && (
                <div className="dropdown-item" onClick={() => setShowAccessControl(true)}>
                  <Shield size={16} /> Access Control (Admin)
                </div>
              )}
              <div className="dropdown-divider" />
              <div className="dropdown-item" onClick={() => setShowProfileModal(true)}>
                <Settings size={16} /> My Profile
              </div>
              <div className="dropdown-item" onClick={onBackToLanding} style={{ color: 'var(--danger)' }}>
                <LogOut size={16} /> Sign Out
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Area */}
      <div className="portal-main">
        {/* Top Bar */}
        <header className="portal-topbar">
          <div className="topbar-left">
            <h1 className="topbar-title">{tabTitles[activeTab]}</h1>
            {analyticsData && (
              <span className={`badge badge-${analyticsData.status === 'Healthy' ? 'success' : analyticsData.status === 'Warning' ? 'warning' : 'danger'}`}>
                {analyticsData.status}
              </span>
            )}
            {(analyticsData?.datasetNames?.length > 0 || analyticsData?.datasetName) && (
              <div style={{ position: 'relative' }}>
                <div 
                  title="View Datasets"
                  onClick={() => setShowDatasetMenu(!showDatasetMenu)}
                  style={{ marginLeft: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-panel)', padding: '0.25rem 0.75rem', borderRadius: '99px', fontSize: '0.75rem', color: 'var(--text-secondary)', cursor: 'pointer', border: '1px solid var(--border-light)', transition: 'border-color 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-light)'}
                >
                  <Database size={12} color="var(--accent-primary)" />
                  <span style={{ fontWeight: '500' }}>
                    {analyticsData.datasetNames?.length > 1 
                      ? `${analyticsData.datasetNames.length} Datasets Loaded` 
                      : (analyticsData.datasetNames?.[0] || analyticsData.datasetName || 'Dataset Loaded')}
                  </span>
                </div>
                {showDatasetMenu && (
                  <div className="dropdown-menu" style={{ width: '220px', padding: '0.5rem', left: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '0.5rem', padding: '0 0.5rem' }}>ACTIVE DATASETS</div>
                    {analyticsData.datasetNames ? analyticsData.datasetNames.map((name, idx) => (
                      <div key={idx} style={{ padding: '0.5rem', fontSize: '0.8rem', color: 'var(--text-primary)', borderBottom: idx < analyticsData.datasetNames.length - 1 ? '1px solid var(--border-light)' : 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FileText size={12} color="var(--text-muted)" />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                      </div>
                    )) : (
                      <div style={{ padding: '0.5rem', fontSize: '0.8rem' }}>{analyticsData.datasetName}</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="topbar-right">
            <div className="topbar-search">
              <Search size={14} color="var(--text-muted)" />
              <input type="text" placeholder="Search packs, cells..." />
            </div>
            
            {/* Notifications */}
            <div style={{ position: 'relative' }}>
              <button 
                className="topbar-icon-btn" 
                onClick={() => { setShowNotifications(!showNotifications); setUnreadAlerts(false); }}
              >
                <Bell size={16} className={unreadAlerts ? "animate-pulse" : ""} color={unreadAlerts ? "var(--danger)" : "currentColor"} />
                {(unreadAlerts || analyticsData?.anomalies?.length > 0) && (
                  <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: 'var(--danger)', width: '8px', height: '8px', borderRadius: '50%' }} />
                )}
              </button>
              
              {showNotifications && (
                <div ref={notifRef} className="dropdown-menu" style={{ width: '320px', padding: '1rem', maxHeight: '400px', overflowY: 'auto' }}>
                  <h4 style={{ fontSize: '0.875rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem' }}>Live Notifications</h4>
                  
                  {liveAlerts.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--danger)', fontWeight: '700', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Real-Time System Alerts (Worker Queue)</div>
                      {liveAlerts.map((a, i) => (
                        <div key={`live-${i}`} style={{ padding: '0.5rem', background: 'var(--danger-bg)', borderLeft: '3px solid var(--danger)', marginBottom: '0.5rem', fontSize: '0.8rem', borderRadius: '0 4px 4px 0' }}>
                          <div style={{ fontWeight: '700', color: 'var(--danger)' }}>{a.alert}</div>
                          <div style={{ color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                            <span>Value: {a.value}</span>
                            <span style={{ opacity: 0.7 }}>{new Date(a.timestamp).toLocaleTimeString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Dataset Batch Analytics</div>
                  {analyticsData?.anomalies?.length > 0 ? (
                    analyticsData.anomalies.map((a, i) => (
                      <div key={i} style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-light)', fontSize: '0.8rem' }}>
                        <div style={{ fontWeight: '600', color: a.severity === 'Critical' ? 'var(--danger)' : 'var(--warning)' }}>{a.type}</div>
                        <div style={{ color: 'var(--text-secondary)' }}>{a.description}</div>
                      </div>
                    ))
                  ) : (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>No batch anomalies detected</div>
                  )}
                </div>
              )}
            </div>

            {!isViewer && (
              <button className="topbar-icon-btn" onClick={() => setShowSettings(true)}>
                <Settings size={16} />
              </button>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="portal-content">
          {renderContent()}
        </main>
      </div>

      {/* Settings Modal */}
      <div className={`modal-backdrop ${showSettings ? 'open' : ''}`} onClick={() => setShowSettings(false)}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3 className="modal-title">Portal Settings</h3>
            <button className="modal-close" onClick={() => setShowSettings(false)}><X size={20} /></button>
          </div>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Alert Sensitivity Threshold</label>
              <select className="form-input" defaultValue="Medium (Standard ISO-26262)">
                <option>High (Detect micro-anomalies)</option>
                <option>Medium (Standard ISO-26262)</option>
                <option>Low (Only critical faults)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Default Export Format</label>
              <select className="form-input" defaultValue="PDF Document">
                <option>PDF Document</option>
                <option>CSV Raw Data</option>
                <option>JSON API Object</option>
              </select>
            </div>
            
            {/* Custom Alert Rules Engine */}
            <div className="form-group" style={{ marginTop: '2rem' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Custom Alert Rules</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>Enterprise Rules Engine</span>
              </label>
              
              <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                {customRules.map(rule => (
                  <div key={rule.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', marginBottom: '0.5rem' }}>
                    <div style={{ fontSize: '0.85rem' }}>
                      Alert if <span style={{ fontWeight: '600', color: 'var(--accent-primary)' }}>{rule.metric}</span> is <span style={{ fontWeight: '600' }}>{rule.operator} {rule.value}</span> for <span style={{ fontWeight: '600' }}>{rule.duration}s</span>
                    </div>
                    <button onClick={() => setCustomRules(prev => prev.filter(r => r.id !== rule.id))} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', opacity: 0.7 }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Metric</label>
                    <select className="form-input" value={newRule.metric} onChange={e => setNewRule({...newRule, metric: e.target.value})} style={{ padding: '0.5rem', fontSize: '0.85rem' }}>
                      <option>Temperature</option>
                      <option>Voltage</option>
                      <option>Current</option>
                      <option>SOH</option>
                    </select>
                  </div>
                  <div style={{ width: '60px' }}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Op</label>
                    <select className="form-input" value={newRule.operator} onChange={e => setNewRule({...newRule, operator: e.target.value})} style={{ padding: '0.5rem', fontSize: '0.85rem' }}>
                      <option>&gt;</option>
                      <option>&lt;</option>
                      <option>=</option>
                    </select>
                  </div>
                  <div style={{ width: '80px' }}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Value</label>
                    <input type="text" className="form-input" placeholder="e.g. 55" value={newRule.value} onChange={e => setNewRule({...newRule, value: e.target.value})} style={{ padding: '0.5rem', fontSize: '0.85rem' }} />
                  </div>
                  <div style={{ width: '80px' }}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Secs</label>
                    <input type="text" className="form-input" placeholder="e.g. 10" value={newRule.duration} onChange={e => setNewRule({...newRule, duration: e.target.value})} style={{ padding: '0.5rem', fontSize: '0.85rem' }} />
                  </div>
                  <button 
                    onClick={() => {
                      if(newRule.value && newRule.duration) {
                        setCustomRules(prev => [...prev, { ...newRule, id: Date.now() }]);
                        setNewRule({ metric: 'Voltage', operator: '<', value: '', duration: '' });
                      }
                    }}
                    style={{ background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </div>

            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1.5rem' }}>
              <input type="checkbox" id="emailNotifs" defaultChecked />
              <label htmlFor="emailNotifs" style={{ fontSize: '0.85rem' }}>Enable email notifications for Critical alerts</label>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn-secondary" onClick={() => setShowSettings(false)}>Cancel</button>
            <button className="btn-primary" onClick={() => setShowSettings(false)}>Save Preferences</button>
          </div>
        </div>
      </div>

      {/* Profile Management Modal */}
      <div className={`modal-backdrop ${showProfileModal ? 'open' : ''}`} onClick={() => setShowProfileModal(false)}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3 className="modal-title">Profile Management</h3>
            <button className="modal-close" onClick={() => setShowProfileModal(false)}><X size={20} /></button>
          </div>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input type="text" className="form-input" defaultValue={user?.name || ''} />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input type="email" className="form-input" defaultValue={user?.email || ''} readOnly style={{ opacity: 0.7 }} />
            </div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <input type="text" className="form-input" defaultValue={user?.role || ''} readOnly style={{ opacity: 0.7 }} />
            </div>
            <div className="form-group" style={{ marginTop: '1.5rem' }}>
              <button className="btn-secondary" style={{ width: '100%', borderColor: 'var(--danger)', color: 'var(--danger)' }}>Reset Password</button>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn-secondary" onClick={() => setShowProfileModal(false)}>Cancel</button>
            <button className="btn-primary" onClick={() => setShowProfileModal(false)}>Save Profile</button>
          </div>
        </div>
      </div>

      {/* Access Control Modal (Admin Only) */}
      {isAdmin && (
        <div className={`modal-backdrop ${showAccessControl ? 'open' : ''}`} onClick={() => setShowAccessControl(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Access Control Management</h3>
              <button className="modal-close" onClick={() => setShowAccessControl(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                Manage user permissions and platform access. Note: In this demo instance, adding/removing users is simulated.
              </p>
              
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: 'Dr. Alan Grant', email: 'admin@bms-analytics.com', role: 'Admin', status: 'Active' },
                    { name: 'Priya Sharma', email: 'engineer@bms-analytics.com', role: 'Engineer', status: 'Active' },
                    { name: 'Marcus Cole', email: 'viewer@bms-analytics.com', role: 'Viewer', status: 'Inactive' },
                  ].map((u, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{u.name}</td>
                      <td>{u.email}</td>
                      <td>
                        <span className={`badge badge-${u.role === 'Admin' ? 'danger' : u.role === 'Engineer' ? 'info' : 'neutral'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: u.status === 'Active' ? 'var(--success)' : 'var(--text-muted)' }}>
                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: u.status === 'Active' ? 'var(--success)' : 'var(--text-muted)' }} />
                          {u.status}
                        </span>
                      </td>
                      <td>
                        <button className="btn-ghost" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}>+ Invite User</button>
              </div>
            </div>
          </div>
        </div>
      )}



    </div>
  );
}
