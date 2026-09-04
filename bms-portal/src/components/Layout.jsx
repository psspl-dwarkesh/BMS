import { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Globe, Users, Battery, Activity, AlertTriangle, Thermometer, Upload, FileText, Search, Bell, Settings, X, LogOut, Menu, Shield, Zap, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { alertsApi, devicesApi } from '../api/endpoints';
import Select from './common/Select';

const WS_RECONNECT_BASE_MS = 1000;
const WS_RECONNECT_MAX_MS = 30000;

// WebSocket connection hook — reconnects with exponential backoff on an
// unexpected drop (network blip, server restart), instead of silently
// staying disconnected until a full page reload. A manual close (component
// unmount) sets `closedByUs` so onclose doesn't try to reconnect a socket
// that was intentionally torn down.
export function useLiveSocket() {
  const { user } = useAuth();
  const [liveAlerts, setLiveAlerts] = useState([]);
  const [unreadAlerts, setUnreadAlerts] = useState(false);
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!user) return;

    let ws = null;
    let closedByUs = false;
    let reconnectTimer = null;
    let attempt = 0;

    const connect = () => {
      const token = localStorage.getItem('bms_token');

      let baseWsUrl;
      if (import.meta.env.VITE_API_BASE_URL) {
        baseWsUrl = import.meta.env.VITE_API_BASE_URL.replace('http', 'ws');
      } else if (import.meta.env.DEV) {
        baseWsUrl = 'ws://localhost:8000';
      } else {
        baseWsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
      }

      const wsUrl = `${baseWsUrl}/ws/alerts?token=${token}`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('Live socket connected');
        attempt = 0;
        setConnected(true);
        setSocket(ws);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'ALERT') {
            setLiveAlerts(prev => [data, ...prev].slice(0, 50));
            setUnreadAlerts(true);
          } else if (data.type === 'ALERT_RESOLVED') {
            setLiveAlerts(prev => prev.filter(a => a.alert_id !== data.alert_id));
          }
        } catch (e) {
          console.error("Failed to parse websocket message", e);
        }
      };

      ws.onclose = () => {
        console.log('Live socket disconnected');
        setConnected(false);
        setSocket(null);
        if (closedByUs) return;
        // Exponential backoff, capped, so a persistently-unavailable server
        // doesn't spin a tight reconnect loop.
        const delay = Math.min(WS_RECONNECT_BASE_MS * 2 ** attempt, WS_RECONNECT_MAX_MS);
        attempt += 1;
        reconnectTimer = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        // onclose fires right after for a connection-level error - no
        // separate handling needed here beyond letting that path reconnect.
      };
    };

    connect();

    return () => {
      closedByUs = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [user]);

  return { socket, connected, liveAlerts, setLiveAlerts, unreadAlerts, setUnreadAlerts };
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');

  const profileRef = useRef(null);
  const notifRef = useRef(null);

  const { liveAlerts, unreadAlerts, setUnreadAlerts } = useLiveSocket();

  // Shared react-query cache for the sidebar's device list - was previously
  // a raw devicesApi.getDevices() call re-run on every route/tab navigation
  // (its effect depended on location.pathname), duplicating the independent
  // ['devices'] fetches FleetDashboard/DeviceManagement/UserManagement
  // already do. One cached fetch, shared across all of them, staying fresh
  // for 30s before a background refetch.
  const { data: devices = [] } = useQuery({
    queryKey: ['devices'],
    queryFn: devicesApi.getDevices,
    enabled: !!user,
    staleTime: 30000,
  });

  // Pick the selected device from the current URL, or default non-admins
  // straight to their (usually only) assigned device.
  useEffect(() => {
    if (!user || devices.length === 0) return;
    const match = location.pathname.match(/\/devices\/(\d+)/);
    if (match) {
      setSelectedDeviceId(match[1]);
    } else if (user.role !== 'admin') {
      setSelectedDeviceId(devices[0].id.toString());
    }
  }, [user, devices, location.pathname]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) setShowProfile(false);
      if (notifRef.current && !notifRef.current.contains(event.target)) setShowNotifications(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isAdmin = user?.role === 'admin';

  const handleDeviceChange = (newId) => {
    setSelectedDeviceId(newId);
    if (newId) {
      // Keep current tab, just change device
      const currentTab = location.pathname.split('/').pop();
      const validTabs = ['realtime', 'history', 'cells', 'location', 'degradation', 'quality', 'thermal', 'alerts', 'reports'];
      const targetTab = validTabs.includes(currentTab) ? currentTab : 'realtime';
      navigate(`/app/devices/${newId}/${targetTab}`);
    } else if (isAdmin) {
      navigate('/app/fleet');
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
        <div className="sidebar-brand" style={{ cursor: 'pointer' }} onClick={() => navigate(isAdmin ? '/app/fleet' : `/app/devices/${selectedDeviceId}/realtime`)}>
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
            <span className="sidebar-brand-sub">{user?.role === 'admin' ? 'Administrator' : 'Fleet User'}</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {isAdmin && (
            <>
              <div className="sidebar-section-label">Fleet Management</div>
              <NavLink to="/app/fleet" end className={({isActive}) => `sidebar-nav-item ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                <Globe size={18} /> Fleet Overview
              </NavLink>
              <NavLink to="/app/fleet/alerts" className={({isActive}) => `sidebar-nav-item ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                <AlertTriangle size={18} /> Fleet Alerts
              </NavLink>
              <NavLink to="/app/fleet/users" className={({isActive}) => `sidebar-nav-item ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                <Users size={18} /> User Management
              </NavLink>
              <NavLink to="/app/fleet/devices" className={({isActive}) => `sidebar-nav-item ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                <Shield size={18} /> Device Registry
              </NavLink>
              <NavLink to="/app/upload" className={({isActive}) => `sidebar-nav-item ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                <Upload size={18} /> Upload &amp; Analyze
              </NavLink>
            </>
          )}

          <div className="sidebar-section-label" style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span>Device View</span>
            <Select
              style={{ width: '100%' }}
              value={selectedDeviceId}
              onChange={handleDeviceChange}
              placeholder="Select a device..."
              options={[
                ...(isAdmin && selectedDeviceId ? [{ value: '', label: '— Select battery —' }] : []),
                ...devices.map(d => ({ value: String(d.id), label: `${d.serial_number} - ${d.pack_name}` })),
              ]}
            />
          </div>

          {selectedDeviceId && (
            <>
              <NavLink to={`/app/devices/${selectedDeviceId}/realtime`} className={({isActive}) => `sidebar-nav-item ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                <Activity size={18} /> Real-Time Live
              </NavLink>
              <NavLink to={`/app/devices/${selectedDeviceId}/history`} className={({isActive}) => `sidebar-nav-item ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                <FileText size={18} /> Device History
              </NavLink>
              <NavLink to={`/app/devices/${selectedDeviceId}/cells`} className={({isActive}) => `sidebar-nav-item ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                <Battery size={18} /> Cell Analysis
              </NavLink>
              <NavLink to={`/app/devices/${selectedDeviceId}/location`} className={({isActive}) => `sidebar-nav-item ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                <Globe size={18} /> GPS Tracking
              </NavLink>
              <NavLink to={`/app/devices/${selectedDeviceId}/degradation`} className={({isActive}) => `sidebar-nav-item ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                <Activity size={18} /> Degradation
              </NavLink>
              <NavLink to={`/app/devices/${selectedDeviceId}/quality`} className={({isActive}) => `sidebar-nav-item ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                <CheckCircle2 size={18} /> Data Quality
              </NavLink>
              <NavLink to={`/app/devices/${selectedDeviceId}/thermal`} className={({isActive}) => `sidebar-nav-item ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                <Thermometer size={18} /> Thermal
              </NavLink>
              <NavLink to={`/app/devices/${selectedDeviceId}/findings`} className={({isActive}) => `sidebar-nav-item ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                <FileText size={18} /> Findings
              </NavLink>
              <NavLink to={`/app/devices/${selectedDeviceId}/alerts`} className={({isActive}) => `sidebar-nav-item ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                <AlertTriangle size={18} /> Alerts
              </NavLink>

              <div className="sidebar-section-label">Tools</div>
              <NavLink to={`/app/devices/${selectedDeviceId}/reports`} className={({isActive}) => `sidebar-nav-item ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                <FileText size={18} /> Reports
              </NavLink>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user" onClick={() => setShowProfile(!showProfile)}>
            <div className="sidebar-user-avatar" style={{ background: 'var(--accent-primary)' }}>
              {user?.full_name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user?.full_name || 'User'}</span>
              <span className="sidebar-user-role">{user?.role || 'User'}</span>
            </div>
          </div>
          
          {/* Profile Dropdown */}
          {showProfile && (
            <div ref={profileRef} className="dropdown-menu" style={{ bottom: '4rem', top: 'auto', left: '1rem', right: 'auto', width: '200px' }}>
              <div className="dropdown-item" style={{ pointerEvents: 'none' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user?.email}</div>
              </div>
              <div className="dropdown-divider" />
              <div className="dropdown-item" onClick={logout} style={{ color: 'var(--danger)' }}>
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
            {/* Route title handled inside individual components or via breadcrumbs if needed */}
          </div>
          <div className="topbar-right">
            {/* Notifications */}
            <div style={{ position: 'relative' }}>
              <button 
                className="topbar-icon-btn" 
                onClick={() => { setShowNotifications(!showNotifications); setUnreadAlerts(false); }}
              >
                <Bell size={16} className={unreadAlerts ? "animate-pulse" : ""} color={unreadAlerts ? "var(--danger)" : "currentColor"} />
                {unreadAlerts && (
                  <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: 'var(--danger)', width: '8px', height: '8px', borderRadius: '50%' }} />
                )}
              </button>
              
              {showNotifications && (
                <div ref={notifRef} className="dropdown-menu" style={{ width: '320px', padding: '1rem', maxHeight: '400px', overflowY: 'auto' }}>
                  <h4 style={{ fontSize: '0.875rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem' }}>Live Alerts</h4>
                  
                  {liveAlerts.length > 0 ? (
                    <div>
                      {liveAlerts.map((a, i) => (
                        <div key={`live-${a.alert_id}-${i}`} style={{ padding: '0.75rem', background: a.severity === 'critical' ? 'var(--danger-bg)' : 'var(--warning-bg)', borderLeft: `3px solid ${a.severity === 'critical' ? 'var(--danger)' : 'var(--warning)'}`, marginBottom: '0.5rem', fontSize: '0.8rem', borderRadius: '0 4px 4px 0' }}>
                          <div style={{ fontWeight: '700', color: a.severity === 'critical' ? 'var(--danger)' : 'var(--warning)', textTransform: 'capitalize' }}>{a.alert_type.replace('_', ' ')}</div>
                          <div style={{ color: 'var(--text-primary)', marginTop: '0.25rem' }}>{a.message}</div>
                          <div style={{ color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.7rem' }}>
                            <span>Dev {a.device_id}</span>
                            <span style={{ opacity: 0.7 }}>{new Date(a.triggered_at).toLocaleTimeString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 1rem' }}>
                      <AlertTriangle size={32} style={{ marginBottom: '0.75rem', opacity: 0.2, margin: '0 auto' }} />
                      <p>No active real-time alerts</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="portal-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
