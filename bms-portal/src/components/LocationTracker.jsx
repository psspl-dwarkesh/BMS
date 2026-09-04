import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Route as RouteIcon } from 'lucide-react';
import { telemetryApi, devicesApi, locationApi } from '../api/endpoints';
import { LoadingState, EmptyState } from './common/StateViews';

// Zero-dependency map: an embedded OSM iframe (no Leaflet/API-key needed) for
// the live current-position pin. The OSM embed endpoint only supports a
// single marker, not a rendered path, so the historical trail is instead
// shown below the map as a real, scrollable point-by-point list backed by
// GET /devices/:id/location/history - it was previously fetched nowhere in
// this component despite the backend already supporting it.
export default function LocationTracker() {
  const { id } = useParams();

  const { data: latest, isLoading } = useQuery({
    queryKey: ['telemetry-latest', id],
    queryFn: () => telemetryApi.getLatest(id),
    refetchInterval: 2000,
    enabled: !!id
  });

  const { data: device } = useQuery({
    queryKey: ['device', id],
    queryFn: () => devicesApi.getDevice(id),
    enabled: !!id
  });

  const { data: trail, isLoading: trailLoading } = useQuery({
    queryKey: ['location-history', id],
    queryFn: () => locationApi.getHistory(id),
    enabled: !!id
  });

  if (isLoading) {
    return <LoadingState label="Loading location data..." />;
  }

  const lat = latest?.latitude;
  const lng = latest?.longitude;
  const hasLocation = lat !== null && lng !== null && lat !== undefined && lng !== undefined;

  return (
    <div className="animate-in">
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>{device?.pack_name || 'Battery Pack'} - GPS Tracking</h2>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>SN: {device?.serial_number}</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden', height: '500px', display: 'flex', flexDirection: 'column' }}>
        {hasLocation ? (
          <>
            <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                <MapPin size={18} color="var(--accent-primary)" />
                Current Location
              </div>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <span>Lat: {lat.toFixed(6)}</span>
                <span>Lng: {lng.toFixed(6)}</span>
              </div>
              <div style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Updated: {new Date(latest.sample_time).toLocaleTimeString()}
              </div>
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
              {/* Using OSM embedded iframe for zero-dependency map */}
              <iframe
                width="100%"
                height="100%"
                frameBorder="0"
                scrolling="no"
                marginHeight="0"
                marginWidth="0"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01}%2C${lat - 0.01}%2C${lng + 0.01}%2C${lat + 0.01}&layer=mapnik&marker=${lat}%2C${lng}`}
                style={{ border: 'none' }}
              ></iframe>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            <MapPin size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
            <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No GPS coordinates available</p>
            <p style={{ maxWidth: '400px' }}>This device is not reporting latitude/longitude telemetry data.</p>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">
          <div>
            <div className="card-title"><RouteIcon size={16} style={{ verticalAlign: '-2px', marginRight: '0.4rem' }} />Trace Record</div>
            <div className="card-subtitle">GPS history for this device, most recent first</div>
          </div>
          {trail && <span className="badge badge-neutral">{trail.length} point{trail.length === 1 ? '' : 's'}</span>}
        </div>
        {trailLoading ? (
          <LoadingState label="Loading GPS trail..." />
        ) : !trail || trail.length === 0 ? (
          <EmptyState icon={RouteIcon} title="No location history yet" message="Points will appear here as this device reports GPS coordinates over time." />
        ) : (
          <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr><th>Time</th><th>Latitude</th><th>Longitude</th></tr>
              </thead>
              <tbody>
                {[...trail].reverse().map((p, idx) => (
                  <tr key={idx}>
                    <td style={{ color: 'var(--text-secondary)' }}>{new Date(p.sample_time).toLocaleString()}</td>
                    <td>{p.latitude?.toFixed(6)}</td>
                    <td>{p.longitude?.toFixed(6)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
