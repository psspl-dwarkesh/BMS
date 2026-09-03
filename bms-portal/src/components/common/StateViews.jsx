import { Loader2, AlertCircle, Inbox, RefreshCw } from 'lucide-react';

// Shared loading/empty/error presentation for every data-fetching page -
// replaces raw unstyled text (e.g. FleetDashboard's old plain "Failed to
// load fleet data" string) and pages that silently rendered nothing at all
// when a query failed (no isError handling).

export function LoadingState({ label = 'Loading...' }) {
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
      <Loader2 size={28} style={{ marginBottom: '1rem', opacity: 0.5, animation: 'spin 0.9s linear infinite' }} />
      <p style={{ fontSize: '0.9rem' }}>{label}</p>
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title = 'No data yet', message, action }) {
  return (
    <div className="card animate-fade-in" style={{ textAlign: 'center', padding: '3rem 2rem', color: 'var(--text-muted)' }}>
      <Icon size={40} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
      <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: message ? '0.35rem' : 0 }}>{title}</p>
      {message && <p style={{ fontSize: '0.85rem' }}>{message}</p>}
      {action && <div style={{ marginTop: '1rem' }}>{action}</div>}
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', message = 'Please try again.', onRetry }) {
  return (
    <div className="card animate-fade-in" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
      <AlertCircle size={40} color="var(--danger)" style={{ margin: '0 auto 1rem', opacity: 0.8 }} />
      <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>{title}</p>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: onRetry ? '1.25rem' : 0 }}>{message}</p>
      {onRetry && (
        <button className="btn-secondary" onClick={onRetry} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <RefreshCw size={14} /> Retry
        </button>
      )}
    </div>
  );
}
