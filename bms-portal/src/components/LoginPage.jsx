import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight, ShieldCheck, Battery, Zap, Activity, Shield, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Matches backend/seed.py exactly - the two accounts that actually exist
// after `python seed.py`. The previous version of this panel pointed at
// admin@bms.local/adminpass and engineer@bms.local/engpass: a wrong
// password for the real admin account, and an "Engineer" account/role that
// was never seeded and doesn't exist in the two-role (admin/user) model at
// all - so both buttons always failed. Keep this in sync with seed.py if the
// demo accounts ever change.
const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@bms.local', password: 'admin123', desc: 'Full fleet access', icon: Shield },
  { role: 'User', email: 'user@bms.local', password: 'user123', desc: 'Assigned devices only', icon: User },
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    const res = await login(email, password);
    if (res.success) {
      navigate('/app');
    } else {
      setError(res.error || 'Invalid credentials');
      setLoading(false);
    }
  };

  const handleQuickLogin = async (quickEmail, quickPassword) => {
    setEmail(quickEmail);
    setPassword(quickPassword);
    setError('');
    setLoading(true);
    
    const res = await login(quickEmail, quickPassword);
    if (res.success) {
      navigate('/app');
    } else {
      setError(res.error || 'Invalid credentials');
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      {/* Left panel */}
      <div style={{
        flex: '0 0 45%',
        background: 'url("/login-hero.jpg") center/cover no-repeat',
        color: '#fff', display: 'flex', flexDirection: 'column', padding: '3rem',
        position: 'relative', overflow: 'hidden'
      }}>
        {/* Dark overlay for readability - the new compressed hero photo is
            busier/higher-contrast than the old one, so the flat 0.75 tint
            alone left the headline hard to read against it; a bottom-heavy
            gradient plus the h1's own text-shadow below picks up the slack
            without darkening the image everywhere. */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(8,17,34,0.72) 0%, rgba(8,17,34,0.82) 55%, rgba(8,17,34,0.88) 100%)', zIndex: 0 }} />
        
        {/* Top logo */}
        <div style={{ zIndex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }} onClick={() => navigate('/')}>
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

        {/* Main content - centered horizontally in the panel (was pinned to
            the left edge: a flex item with maxWidth inside a stretch-aligned
            column container sizes to its cap but still aligns at flex-start
            unless told otherwise). Text itself stays left-aligned within the
            centered block. */}
        <div style={{ zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignSelf: 'center', maxWidth: '420px' }}>
          <h1 style={{ fontSize: '2.75rem', marginBottom: '1.25rem', lineHeight: '1.15', fontWeight: '700', letterSpacing: '-0.03em', textShadow: '0 2px 16px rgba(0,0,0,0.45)' }}>
            Enterprise Battery Intelligence
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1.05rem', lineHeight: '1.65', marginBottom: '2.5rem' }}>
            Monitor cell health, predict degradation, and detect thermal anomalies across your entire fleet — all from one secure portal.
          </p>
          
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            {[
              { icon: <Battery size={18} />, val: 'Cell-level', label: 'Monitoring' },
              { icon: <Activity size={18} />, val: 'Real-Time', label: 'Analytics' },
              { icon: <Zap size={18} />, val: 'Live Telemetry', label: 'Processing' },
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
        <div style={{ width: '100%', maxWidth: '380px' }}>
          <div style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Welcome back</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Sign in to access your battery fleet dashboard.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
                <input type="email" className="form-input" style={{ paddingLeft: '2.5rem' }} placeholder="admin@bms.local" value={email} onChange={(e) => setEmail(e.target.value)} required />
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

            <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', padding: '0.8rem', fontSize: '0.95rem' }}>
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                  <span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} />
                  Authenticating...
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>Sign In to Portal <ArrowRight size={16} /></span>
              )}
            </button>
          </form>
          
          {/* Quick Login Section — seeded demo accounts only (see backend/seed.py) */}
          <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border-default)', paddingTop: '1.5rem' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.85rem', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Quick Login — Demo Accounts
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {DEMO_ACCOUNTS.map(({ role, email: demoEmail, password: demoPassword, desc, icon: Icon }) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => handleQuickLogin(demoEmail, demoPassword)}
                  disabled={loading}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem',
                    padding: '0.85rem 0.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)', cursor: loading ? 'default' : 'pointer', transition: 'border-color 0.15s, transform 0.15s',
                    opacity: loading ? 0.6 : 1,
                  }}
                  onMouseEnter={(e) => { if (!loading) e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
                >
                  <Icon size={18} color="var(--accent-primary)" />
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{role}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{desc}</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{demoEmail}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            <ShieldCheck size={14} />
            Secure Authentication via API
          </div>
        </div>
      </div>
    </div>
  );
}
