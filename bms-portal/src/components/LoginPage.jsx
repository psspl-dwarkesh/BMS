import { useState } from 'react';
import { Mail, Lock, ArrowRight, ShieldCheck, Battery, Zap, Activity } from 'lucide-react';

const STATIC_USERS = [
  { role: 'Admin', email: 'admin@bms-analytics.com', password: 'admin123', name: 'Rajesh Kumar', desc: 'Full system access, user management, configuration' },
  { role: 'Engineer', email: 'engineer@bms-analytics.com', password: 'eng123', name: 'Priya Sharma', desc: 'Analytics, diagnostics, data upload, reports' },
  { role: 'Viewer', email: 'viewer@bms-analytics.com', password: 'view123', name: 'Amit Patel', desc: 'Read-only dashboard and report access' },
];

export default function LoginPage({ onLogin, onBack }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRoleClick = (user) => {
    setSelectedRole(user.role);
    setEmail(user.email);
    setPassword(user.password);
    setError('');
  };

  // Helper to generate a mock JWT for SSO testing
  const generateMockJWT = (userData) => {
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = btoa(JSON.stringify({
      ...userData,
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24), // 24 hours
      iat: Math.floor(Date.now() / 1000),
      iss: "bms-sso-provider"
    }));
    const signature = btoa("mock-signature-do-not-use-in-production");
    return `${header}.${payload}.${signature}`;
  };

  const handleSSOLogin = (provider) => {
    setError('');
    setLoading(provider);
    setTimeout(() => {
      // Mock OAuth callback containing a JWT
      const mockUser = { role: 'Engineer', email: `engineer@${provider.toLowerCase()}.com`, name: `${provider} SSO User` };
      const jwt = generateMockJWT(mockUser);
      onLogin(jwt);
    }, 1200);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    const matchedUser = STATIC_USERS.find(u => u.email === email && u.password === password);
    if (!matchedUser) {
      setError('Invalid credentials. Click a role card below to auto-fill.');
      return;
    }
    setLoading('local');
    setTimeout(() => {
      const jwt = generateMockJWT({ email: matchedUser.email, role: matchedUser.role, name: matchedUser.name });
      onLogin(jwt);
    }, 600);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      {/* Left panel */}
      <div style={{
        flex: '0 0 45%', 
        background: 'url("/login_bg.png") center/cover no-repeat',
        color: '#fff', display: 'flex', flexDirection: 'column', padding: '3rem',
        position: 'relative', overflow: 'hidden'
      }}>
        {/* Dark overlay for readability */}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(8, 17, 34, 0.75)', zIndex: 0 }} />
        
        {/* Top logo */}
        <div style={{ zIndex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }} onClick={onBack}>
          <div style={{ width: '42px', height: '42px', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
            {/* Custom BMS Battery SVG Logo */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="6" y="4" width="12" height="18" rx="2" ry="2" />
              <line x1="10" y1="1" x2="10" y2="4" />
              <line x1="14" y1="1" x2="14" y2="4" />
              <line x1="9" y1="14" x2="15" y2="14" />
              <line x1="12" y1="11" x2="12" y2="17" />
            </svg>
          </div>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '700', fontSize: '1.25rem', letterSpacing: '-0.02em' }}>
            BMS Analytics
          </span>
        </div>

        {/* Main content */}
        <div style={{ zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: '420px' }}>
          <h1 style={{ fontSize: '2.75rem', marginBottom: '1.25rem', lineHeight: '1.15', fontWeight: '700', letterSpacing: '-0.03em' }}>
            Enterprise Battery Intelligence
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1.05rem', lineHeight: '1.65', marginBottom: '2.5rem' }}>
            Monitor cell health, predict degradation, and detect thermal anomalies across your entire fleet — all from one secure portal.
          </p>
          
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            {[
              { icon: <Battery size={18} />, val: '96-Cell', label: 'Monitoring' },
              { icon: <Activity size={18} />, val: 'Real-Time', label: 'Analytics' },
              { icon: <Zap size={18} />, val: 'ISO 26262', label: 'Compliant' },
            ].map((s, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '1rem', textAlign: 'center' }}>
                <div style={{ marginBottom: '0.35rem', opacity: 0.8 }}>{s.icon}</div>
                <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>{s.val}</div>
                <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Decorative glow */}
        <div style={{ position: 'absolute', bottom: '-30%', right: '-15%', width: '60%', height: '60%', background: 'radial-gradient(circle, rgba(8,145,178,0.4) 0%, transparent 70%)', filter: 'blur(80px)', zIndex: 0 }} />
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '40%', height: '40%', background: 'radial-gradient(circle, rgba(16,185,129,0.2) 0%, transparent 70%)', filter: 'blur(60px)', zIndex: 0 }} />
      </div>

      {/* Right panel - Login Form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'var(--bg-primary)' }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Welcome back</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Sign in to access your battery fleet dashboard.</p>
          </div>

          {/* Quick role select cards */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label className="form-label" style={{ marginBottom: '0.5rem' }}>Quick Login — Select Role</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              {STATIC_USERS.map((u) => (
                <div
                  key={u.role}
                  onClick={() => handleRoleClick(u)}
                  style={{
                    padding: '0.75rem 0.5rem', textAlign: 'center', cursor: 'pointer',
                    border: `2px solid ${selectedRole === u.role ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                    background: selectedRole === u.role ? 'var(--accent-light)' : 'var(--bg-primary)',
                    borderRadius: 'var(--radius-md)', transition: 'all 0.2s',
                    transform: selectedRole === u.role ? 'scale(1.03)' : 'scale(1)',
                    boxShadow: selectedRole === u.role ? '0 4px 12px rgba(8,145,178,0.15)' : 'none',
                  }}
                >
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', margin: '0 auto 0.35rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: selectedRole === u.role ? 'var(--accent-primary)' : 'var(--bg-panel)', color: selectedRole === u.role ? '#fff' : 'var(--text-secondary)', fontWeight: '700', fontSize: '0.75rem', transition: 'all 0.2s' }}>
                    {u.role[0]}
                  </div>
                  <div style={{ fontWeight: '600', fontSize: '0.8rem', color: selectedRole === u.role ? 'var(--accent-primary)' : 'var(--text-primary)' }}>{u.role}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.15rem', lineHeight: '1.3' }}>{u.desc.split(',')[0]}</div>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
                <input type="email" className="form-input" style={{ paddingLeft: '2.5rem' }} placeholder="admin@bms-analytics.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
                <input type="password" className="form-input" style={{ paddingLeft: '2.5rem' }} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            </div>

            {error && (
              <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', marginBottom: '1rem', border: '1px solid rgba(239,68,68,0.15)' }}>
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary" disabled={loading !== false} style={{ width: '100%', padding: '0.8rem', fontSize: '0.95rem' }}>
              {loading === 'local' ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                  <span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} />
                  Authenticating...
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>Sign In to Portal <ArrowRight size={16} /></span>
              )}
            </button>
          </form>

          {/* SSO Integration */}
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ height: '1px', flex: 1, background: 'var(--border-light)' }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Or continue with SSO</span>
              <div style={{ height: '1px', flex: 1, background: 'var(--border-light)' }} />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <button 
                className="btn-secondary" 
                onClick={() => handleSSOLogin('Google')}
                disabled={loading !== false}
                style={{ padding: '0.75rem', display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center', background: '#fff', border: '1px solid #d1d5db', color: '#374151' }}
              >
                {loading === 'Google' ? (
                  <span style={{ width: '16px', height: '16px', border: '2px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                )}
                <span style={{ fontWeight: '500' }}>Google</span>
              </button>

              <button 
                className="btn-secondary" 
                onClick={() => handleSSOLogin('Microsoft')}
                disabled={loading !== false}
                style={{ padding: '0.75rem', display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center', background: '#fff', border: '1px solid #d1d5db', color: '#374151' }}
              >
                {loading === 'Microsoft' ? (
                  <span style={{ width: '16px', height: '16px', border: '2px solid #e5e7eb', borderTopColor: '#00a4ef', borderRadius: '50%', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
                    <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                    <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                    <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                    <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
                  </svg>
                )}
                <span style={{ fontWeight: '500' }}>Microsoft</span>
              </button>
            </div>
          </div>

          <div style={{ marginTop: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            <ShieldCheck size={14} />
            Secure Enterprise SSO Enabled · Demo Instance
          </div>
        </div>
      </div>
    </div>
  );
}
