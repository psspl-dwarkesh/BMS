import { Activity, ArrowRight, CheckCircle2, XCircle, Database, TrendingUp, AlertTriangle, Shield, Cpu, Zap, BarChart3, Thermometer, FileText, Battery, ChevronRight, Upload, Eye, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Live-looking battery pack: 8 cell bars pulsing at staggered offsets (as if
// reporting real voltage), a moving current-trace line, and two status
// dots - all CSS-driven (see .hero-cell-bar/.hero-trace-path/.hero-status-dot
// keyframes in index.css), no chart library needed for a decorative visual.
function HeroBatteryVisual() {
  const cellHeights = [58, 74, 66, 80, 62, 70, 76, 64];
  const barWidth = 26;
  const gap = 12;
  const chartLeft = 40;
  const baseline = 190;
  return (
    <svg viewBox="0 0 480 240" width="100%" style={{ maxWidth: '460px', display: 'block', margin: '0 auto' }} role="img" aria-label="Animated battery pack telemetry visual">
      <rect x="14" y="14" width="452" height="212" rx="18" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.14)" strokeWidth="1.5" />
      <text x="34" y="42" fill="rgba(255,255,255,0.55)" fontSize="11" fontFamily="monospace" letterSpacing="0.05em">PACK-01 · 8S LI-ION</text>
      <circle className="hero-status-dot" cx="424" cy="36" r="4" fill="#34d399" />
      <text x="434" y="40" fill="#6ee7b7" fontSize="10" fontFamily="monospace">LIVE</text>

      {cellHeights.map((h, i) => {
        const x = chartLeft + i * (barWidth + gap);
        const y = baseline - h;
        const color = h < 65 ? '#fbbf24' : '#22d3ee';
        return (
          <g key={i}>
            <rect x={x} y="60" width={barWidth} height={baseline - 60} rx="4" fill="rgba(255,255,255,0.05)" />
            <rect
              className="hero-cell-bar"
              x={x} y={y} width={barWidth} height={h} rx="4"
              fill={color}
              opacity="0.9"
              style={{ animationDelay: `${i * 0.18}s` }}
            />
          </g>
        );
      })}

      <text x={chartLeft} y="203" fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="monospace">PACK CURRENT</text>

      {/* Moving current-trace sparkline */}
      <polyline
        className="hero-trace-path"
        points="40,220 80,217 110,221 150,214 190,219 230,213 270,218 310,212 350,217 390,211 440,216"
        fill="none"
        stroke="#34d399"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  
  const onEnter = () => navigate('/login');
  const onDocs = () => navigate('/docs');

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="landing-wrapper">
      {/* Header */}
      <header className="landing-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }} onClick={() => window.scrollTo(0, 0)}>
          <div style={{ width: '36px', height: '36px', background: 'var(--accent-primary)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="6" y="4" width="12" height="18" rx="2" ry="2" />
              <line x1="10" y1="1" x2="10" y2="4" />
              <line x1="14" y1="1" x2="14" y2="4" />
              <line x1="9" y1="14" x2="15" y2="14" />
              <line x1="12" y1="11" x2="12" y2="17" />
            </svg>
          </div>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '700', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
            BMS Analytics
          </span>
        </div>
        <nav style={{ display: 'flex', gap: '2rem', fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: '500' }}>
          <span onClick={() => scrollTo('how-it-works')} style={{ cursor: 'pointer', transition: 'color 0.15s' }}>How It Works</span>
          <span onClick={() => scrollTo('overview')} style={{ cursor: 'pointer', transition: 'color 0.15s' }}>Platform</span>
          <span onClick={() => scrollTo('capabilities')} style={{ cursor: 'pointer', transition: 'color 0.15s' }}>Analytics</span>
          <span onClick={() => scrollTo('integration')} style={{ cursor: 'pointer', transition: 'color 0.15s' }}>Integration</span>
          <span onClick={onDocs} style={{ cursor: 'pointer', transition: 'color 0.15s' }}>Documentation</span>
        </nav>
        <button className="btn-primary" onClick={onEnter}>
          Open Portal <ArrowRight size={16} />
        </button>
      </header>

      {/* Hero */}
      <section className="landing-hero">
        <div className="hero-content">
          <div className="hero-tag">
            <Battery size={14} />
            BMS BATTERY ANALYTICS PLATFORM
          </div>
          <h1 className="hero-title">
            From raw BMS logs to<br /><span className="hero-title-accent">actionable battery insights.</span>
          </h1>
          <p className="hero-subtitle">
            Enterprise-grade intelligence layer for battery fleets. Upload one or more BMS CSV logs, predict degradation, detect thermal anomalies, and optimize cell performance — all in one platform, with a full report generated automatically.
          </p>
          <div className="hero-actions">
            <button className="btn-primary" onClick={onEnter} style={{ padding: '0.85rem 2rem', fontSize: '1rem' }}>
              Launch Portal <ArrowRight size={18} />
            </button>
            <button className="btn-secondary" onClick={onDocs} style={{ padding: '0.85rem 2rem', fontSize: '1rem', background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.18)', color: '#fff' }}>
              <FileText size={18} /> View Documentation
            </button>
          </div>

          {/* Animated KPI ticker */}
          <div style={{ display: 'flex', gap: '2rem', marginTop: '3rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            {[
              { label: 'Cells Monitored', value: '96+', color: '#22d3ee' },
              { label: 'Data Points / Pack', value: '50k+', color: '#34d399' },
              { label: 'Anomaly Types', value: '9+', color: '#fbbf24' },
              { label: 'Response Time', value: '<100ms', color: '#38bdf8' },
            ].map((kpi, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.5rem', fontWeight: '700', color: kpi.color }}>{kpi.value}</div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', fontWeight: '500' }}>{kpi.label}</div>
              </div>
            ))}
          </div>

          <div className="hero-battery-visual">
            <HeroBatteryVisual />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="landing-section">
        <div style={{ width: '92%', maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <div className="section-tag" style={{ color: 'var(--accent-primary)' }}>Upload &amp; Analyze</div>
            <h2 className="section-title">From CSV to diagnostic report, no setup required.</h2>
            <p className="section-subtitle" style={{ maxWidth: '640px', margin: '0.75rem auto 0' }}>
              This is the platform's primary flow. No battery has to be registered ahead of time — and a real battery's telemetry rarely lives in a single file, so it accepts more than one CSV at once.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
            {[
              { step: '1', icon: <Upload size={20} />, title: 'Add your CSV(s)', desc: 'Drag & drop one or several BMS telemetry logs, or start instantly with a bundled sample dataset.' },
              { step: '2', icon: <Eye size={20} />, title: 'Preview & choose', desc: 'Each file is previewed for its detected signals — voltage, current, SOC, SOH, cell count — before anything uploads. Include, inspect, or drop any file.' },
              { step: '3', icon: <Battery size={20} />, title: 'Battery created automatically', desc: 'A new device is registered and sized from the data itself, then every included file is imported into it.' },
              { step: '4', icon: <Sparkles size={20} />, title: 'Instant analytics report', desc: 'Land straight on the automated findings — KPIs, anomalies, degradation, and thermal health — ready to export as a PDF.' },
            ].map((s, i) => (
              <div key={i} className="card" style={{ position: 'relative', paddingTop: '2rem' }}>
                <div style={{
                  position: 'absolute', top: '-14px', left: '1.25rem', width: '32px', height: '32px', borderRadius: '50%',
                  background: 'var(--accent-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: '700', fontSize: '0.85rem', fontFamily: "'Outfit', sans-serif", boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                }}>
                  {s.step}
                </div>
                <div style={{ color: 'var(--accent-primary)', marginBottom: '0.75rem' }}>{s.icon}</div>
                <h3 style={{ fontSize: '1rem', marginBottom: '0.4rem' }}>{s.title}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.5', margin: 0 }}>{s.desc}</p>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
            <button className="btn-primary" onClick={onEnter} style={{ padding: '0.85rem 2rem', fontSize: '1rem' }}>
              Try Upload &amp; Analyze <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* Platform Overview */}
      <section id="overview" className="landing-section alt">
        <div style={{ width: '92%', maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '5rem', alignItems: 'center' }}>
            <div>
              <div className="section-tag" style={{ color: 'var(--accent-primary)' }}>Platform Overview</div>
              <h2 className="section-title">
                One intelligence layer for your entire battery fleet.
              </h2>
              <p className="section-subtitle" style={{ marginBottom: '2rem' }}>
                Upload standard BMS logs directly. Our analytics engine instantly extracts insights — transforming raw voltage and current data into state-of-health predictions and safety warnings.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                {[
                  { icon: <Cpu size={20} color="var(--accent-primary)" />, label: 'Hardware Agnostic' },
                  { icon: <Shield size={20} color="var(--accent-primary)" />, label: 'ISO 26262 Aligned' },
                  { icon: <Database size={20} color="var(--accent-primary)" />, label: 'Multi-CSV Ingestion' },
                  { icon: <BarChart3 size={20} color="var(--accent-primary)" />, label: 'Real-time Analytics' },
                ].map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {f.icon}
                    <span style={{ fontWeight: '600', fontSize: '0.875rem' }}>{f.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[
                { icon: <Database size={22} color="var(--accent-primary)" />, title: 'Data Validation & Cleansing', desc: 'Identify missing signals, invalid values, and synchronize timestamps across logs.', bg: 'var(--accent-light)' },
                { icon: <TrendingUp size={22} color="var(--success)" />, title: 'SOH & Degradation Models', desc: 'Track capacity fade, predict end-of-life, and estimate true State of Health.', bg: 'var(--success-bg)' },
                { icon: <AlertTriangle size={22} color="var(--warning)" />, title: 'Anomaly & Thermal Detection', desc: 'Detect voltage imbalances and thermal events before they become critical.', bg: 'var(--warning-bg)' },
              ].map((item, idx) => (
                <div key={idx} className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', borderLeft: '4px solid transparent', transition: 'all 0.2s' }}>
                  <div style={{ background: item.bg, padding: '0.75rem', borderRadius: '10px', flexShrink: 0 }}>
                    {item.icon}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1rem', marginBottom: '0.35rem' }}>{item.title}</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.5', margin: 0 }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section id="capabilities" className="landing-section">
        <div style={{ width: '92%', maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <div className="section-tag" style={{ color: 'var(--accent-primary)' }}>Integration Scope</div>
            <h2 className="section-title">Capabilities & Boundaries</h2>
          </div>
          <div id="integration" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="card" style={{ borderTop: '3px solid var(--success)' }}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 color="var(--success)" size={22} /> What We Do
              </h3>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {['Process raw CSV logs (Timestamp, Voltage, Current, SOC)', 'Generate Performance KPIs and health metrics', 'Analyze cell-level data and voltage deviations', 'Provide dashboards for calibration evaluation', 'Detect thermal anomalies and cell imbalances', 'Generate downloadable PDF diagnostic reports'].map((t, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                    <CheckCircle2 color="var(--success)" size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="card" style={{ borderTop: '3px solid var(--danger)' }}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <XCircle color="var(--danger)" size={22} /> Out of Scope
              </h3>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {['Real-time Vehicle Control Unit operations', 'Complex hardware installations required', 'Storage of sensitive PII data', 'Direct battery charging/discharging control'].map((t, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                    <XCircle color="var(--danger)" size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-grid">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
              <div style={{ background: 'var(--accent-primary)', width: '28px', height: '28px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="6" y="4" width="12" height="18" rx="2" ry="2" />
                  <line x1="10" y1="1" x2="10" y2="4" />
                  <line x1="14" y1="1" x2="14" y2="4" />
                  <line x1="9" y1="14" x2="15" y2="14" />
                  <line x1="12" y1="11" x2="12" y2="17" />
                </svg>
              </div>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '700', color: '#fff' }}>BMS Analytics</span>
            </div>
            <p style={{ fontSize: '0.85rem', lineHeight: '1.7', maxWidth: '280px', color: 'rgba(255,255,255,0.5)' }}>
              Enterprise battery analytics platform for modern fleets and vehicle systems.
            </p>
          </div>
          {[
            { title: 'Platform', items: [
              { label: 'Dashboard', action: onEnter },
              { label: 'Cell Analysis', action: onEnter },
              { label: 'Degradation', action: onEnter },
              { label: 'Thermal', action: onEnter },
            ]},
            { title: 'Product', items: [
              { label: 'Upload & Analyze', action: () => scrollTo('how-it-works') },
              { label: 'Reports', action: onEnter },
              { label: 'Fleet Monitoring', action: () => scrollTo('overview') },
              { label: 'API', action: onDocs },
            ]},
            { title: 'Resources', items: [
              { label: 'Documentation', action: onDocs },
              { label: 'Support', action: () => window.open('mailto:support@bms-analytics.com') },
              { label: 'Architecture', action: () => scrollTo('capabilities') },
              { label: 'Contact', action: () => window.open('mailto:contact@bms-analytics.com') },
            ]},
          ].map((col, i) => (
            <div key={i}>
              <h4 style={{ color: '#fff', fontSize: '0.8rem', marginBottom: '1rem', fontWeight: '600' }}>{col.title}</h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.8rem' }}>
                {col.items.map((item, j) => (
                  <li key={j} onClick={item.action} style={{ cursor: 'pointer', transition: 'color 0.15s', color: 'rgba(255,255,255,0.45)' }}>{item.label}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="footer-bottom">
          <span>© 2026 BMS Battery Analytics — Demo Instance</span>
          <span>All operational data shown is illustrative.</span>
        </div>
      </footer>
    </div>
  );
}
