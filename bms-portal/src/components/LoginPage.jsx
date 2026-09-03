import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight, ShieldCheck, Battery, Zap, Activity } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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
        background: 'url("/login_bg.png") center/cover no-repeat',
        color: '#fff', display: 'flex', flexDirection: 'column', padding: '3rem',
        position: 'relative', overflow: 'hidden'
      }}>
        {/* Dark overlay for readability */}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(8, 17, 34, 0.75)', zIndex: 0 }} />
        
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
          
          {/* Quick Login Section */}
          <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', textAlign: 'center' }}>Quick Login (Demo)</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <button 
                type="button"
                onClick={() => handleQuickLogin('admin@bms.local', 'admin123')}
                className="btn-secondary" 
                style={{ fontSize: '0.85rem', padding: '0.5rem' }}
                disabled={loading}
              >
                Admin Role
              </button>
              <button 
                type="button"
                onClick={() => handleQuickLogin('user@bms.local', 'user123')}
                className="btn-secondary" 
                style={{ fontSize: '0.85rem', padding: '0.5rem' }}
                disabled={loading}
              >
                Engineer Role
              </button>
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
