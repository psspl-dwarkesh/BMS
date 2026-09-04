import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, FileText, Eye, EyeOff, Trash2, Clock, CheckCircle, AlertTriangle, Loader2, Database, Plus } from 'lucide-react';
import { telemetryApi } from '../api/endpoints';
import { LoadingState, EmptyState } from './common/StateViews';

// "Data Sources" panel - the persistent record of every CSV imported into
// the currently-selected device, separate from DataIngestion.jsx's
// pre-upload preview (which only ever applies to files not yet submitted).
// This is what answers "which CSV is currently feeding the dashboard, and
// which isn't" after the fact: upload timestamp, row counts, an
// include/exclude toggle that hides a batch's rows from every analytics
// view without deleting them, and a real delete.
//
// Opened from a topbar icon in Layout.jsx (only visible once a device is
// selected) - a slide-in panel rather than a new tab/route, so it stays
// reachable no matter which device-scoped page you're on.

function relativeTime(iso) {
  const then = new Date(iso).getTime();
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString();
}

const STATUS_BADGE = {
  processing: { label: 'Processing', cls: 'badge-warning', icon: Loader2 },
  completed:  { label: 'Completed',  cls: 'badge-success', icon: CheckCircle },
  failed:     { label: 'Failed',     cls: 'badge-danger',  icon: AlertTriangle },
};

// Shared query key so Layout.jsx's topbar badge and this panel read the same
// cached list without issuing duplicate requests.
export function importsQueryKey(deviceId) {
  return ['device-imports', deviceId];
}

export function useDeviceImports(deviceId) {
  return useQuery({
    queryKey: importsQueryKey(deviceId),
    queryFn: () => telemetryApi.getImports(deviceId),
    enabled: !!deviceId,
    staleTime: 15000,
  });
}

function ImportRow({ deviceId, imp }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { data: preview, isLoading: previewLoading } = useQuery({
    queryKey: ['import-preview', deviceId, imp.id],
    queryFn: () => telemetryApi.previewImport(deviceId, imp.id),
    enabled: expanded,
  });

  const invalidateEverything = () => {
    // A toggle/delete here changes what every analytics endpoint returns
    // (see backend's _visible_telemetry_query), so refresh both this panel's
    // own list and every device-scoped query that reads telemetry/history.
    queryClient.invalidateQueries({ queryKey: importsQueryKey(deviceId) });
    queryClient.invalidateQueries({ queryKey: ['telemetry-latest', deviceId] });
    queryClient.invalidateQueries({ queryKey: ['telemetry-history', deviceId] });
    queryClient.invalidateQueries({ queryKey: ['device-analytics', deviceId] });
    queryClient.invalidateQueries({ queryKey: ['location-history', deviceId] });
  };

  const toggleMutation = useMutation({
    mutationFn: () => telemetryApi.toggleImport(deviceId, imp.id, !imp.included),
    onSuccess: invalidateEverything,
  });

  const deleteMutation = useMutation({
    mutationFn: () => telemetryApi.deleteImport(deviceId, imp.id),
    onSuccess: invalidateEverything,
  });

  const status = STATUS_BADGE[imp.status] || STATUS_BADGE.completed;
  const StatusIcon = status.icon;

  return (
    <div
      style={{
        border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)',
        background: 'var(--bg-secondary)', padding: '0.75rem', marginBottom: '0.6rem',
        opacity: imp.included ? 1 : 0.55, transition: 'opacity 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
        <FileText size={16} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {imp.filename}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.15rem', flexWrap: 'wrap' }}>
            <Clock size={11} /> {relativeTime(imp.uploaded_at)}
            <span>·</span>
            <span>{imp.row_count.toLocaleString()} row{imp.row_count === 1 ? '' : 's'}{imp.rows_skipped ? ` (${imp.rows_skipped} skipped)` : ''}</span>
          </div>
          <div style={{ marginTop: '0.35rem', display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            <span className={`badge ${status.cls}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <StatusIcon size={10} className={imp.status === 'processing' ? 'animate-pulse' : ''} /> {status.label}
            </span>
            {!imp.included && <span className="badge badge-neutral">Hidden from dashboard</span>}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem' }}>
        <button
          type="button"
          onClick={() => toggleMutation.mutate()}
          disabled={toggleMutation.isPending}
          title={imp.included ? 'Hide this file\'s data from the dashboard' : 'Include this file\'s data in the dashboard'}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', padding: '0.4rem', fontSize: '0.72rem', background: 'var(--bg-primary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-secondary)' }}
        >
          {imp.included ? <EyeOff size={13} /> : <Eye size={13} />} {imp.included ? 'Exclude' : 'Include'}
        </button>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          title="View this file's data"
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', padding: '0.4rem', fontSize: '0.72rem', background: 'var(--bg-primary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-secondary)' }}
        >
          <Eye size={13} /> {expanded ? 'Hide' : 'View'}
        </button>
        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          title="Delete this file's data permanently"
          style={{ padding: '0.4rem 0.6rem', fontSize: '0.72rem', background: 'var(--bg-primary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--danger)' }}
        >
          <Trash2 size={13} />
        </button>
      </div>

      {confirmingDelete && (
        <div style={{ marginTop: '0.6rem', padding: '0.6rem', background: 'var(--danger-bg)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--danger)', marginBottom: '0.5rem' }}>
            Permanently delete "{imp.filename}" and every telemetry row it wrote? This can't be undone.
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              type="button"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              style={{ flex: 1, padding: '0.35rem', fontSize: '0.72rem', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete permanently'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              style={{ padding: '0.35rem 0.6rem', fontSize: '0.72rem', background: 'transparent', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {expanded && (
        <div style={{ marginTop: '0.65rem', paddingTop: '0.65rem', borderTop: '1px solid var(--border-light)' }}>
          {previewLoading ? (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Loading preview…</div>
          ) : preview ? (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.6rem' }}>
                {preview.signals.voltage && <span className="badge badge-success">Voltage</span>}
                {preview.signals.current && <span className="badge badge-success">Current</span>}
                {preview.signals.soc && <span className="badge badge-success">SOC</span>}
                {preview.signals.soh && <span className="badge badge-success">SOH</span>}
                {preview.signals.cell_voltage && <span className="badge badge-success">{preview.signals.cell_count} cells</span>}
                {preview.signals.location && <span className="badge badge-success">GPS</span>}
              </div>
              <div style={{ maxHeight: '200px', overflow: 'auto' }}>
                <table className="data-table" style={{ fontSize: '0.68rem', width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Time</th><th>Voltage</th><th>SOC</th><th>SOH</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sample_rows.slice(0, 20).map((r) => (
                      <tr key={r.id}>
                        <td>{new Date(r.sample_time).toLocaleString()}</td>
                        <td>{r.pack_voltage != null ? r.pack_voltage.toFixed(2) : '—'}</td>
                        <td>{r.soc != null ? `${r.soc.toFixed(0)}%` : '—'}</td>
                        <td>{r.soh != null ? `${r.soh.toFixed(0)}%` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>No preview available.</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function UploadHistoryPanel({ deviceId, open, onClose }) {
  const navigate = useNavigate();
  const { data: imports = [], isLoading } = useDeviceImports(deviceId);

  const goAddData = () => {
    onClose();
    navigate(`/app/upload?device=${deviceId}`);
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(8,17,34,0.35)', zIndex: 60,
          opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none', transition: 'opacity 0.2s',
        }}
      />
      <aside
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: '360px', maxWidth: '90vw',
          background: 'var(--bg-primary)', borderLeft: '1px solid var(--border-default)',
          boxShadow: '-8px 0 24px rgba(0,0,0,0.12)', zIndex: 61, display: 'flex', flexDirection: 'column',
          transform: open ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.22s ease',
        }}
      >
        <div style={{ padding: '1.1rem 1.25rem', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Database size={17} color="var(--accent-primary)" /> Data Sources
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
              Every CSV imported into this battery — data from the live
              simulator, or imported before this panel existed, won't appear
              here since it isn't tied to a CSV batch.
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem', flexShrink: 0 }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border-light)' }}>
          <button
            type="button"
            onClick={goAddData}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.55rem', fontSize: '0.8rem', fontWeight: 600, background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
          >
            <Plus size={15} /> Add more CSV data to this battery
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem' }}>
          {isLoading ? (
            <LoadingState label="Loading upload history…" />
          ) : imports.length === 0 ? (
            <EmptyState icon={FileText} title="No CSVs imported yet" message="Files imported via Upload & Analyze will show up here with a timestamp, an include/exclude toggle, and a delete option." />
          ) : (
            imports.map((imp) => <ImportRow key={imp.id} deviceId={deviceId} imp={imp} />)
          )}
        </div>
      </aside>
    </>
  );
}
