import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Map as MapIcon, Battery, MapPin } from 'lucide-react';
import { devicesApi } from '../api/endpoints';
import { LoadingState, ErrorState } from './common/StateViews';

// Admin-only multi-battery map. LocationTracker.jsx's single-device OSM
// iframe embed only supports one marker, so a real map library is needed
// here - Leaflet + the public OSM tile server keeps the same zero-API-key
// approach the rest of the app uses, just for N markers instead of one.
//
// A device is plotted at its latest telemetry lat/lng when available (a
// real GPS fix - e.g. from a CSV with Latitude/Longitude columns, see
// backend/routers/telemetry.py), falling back to its fixed
// home_latitude/home_longitude (set in Device Registry). Devices with
// neither are listed below the map instead of being plotted at (0,0).

const STATUS_COLOR = {
  active: '#22c55e',
  maintenance: '#f59e0b',
  fault: '#ef4444',
  inactive: '#94a3b8',
};

function resolveCoords(device) {
  const t = device.latest_telemetry;
  if (t && t.latitude != null && t.longitude != null) return [t.latitude, t.longitude, 'live'];
  if (device.home_latitude != null && device.home_longitude != null) return [device.home_latitude, device.home_longitude, 'home'];
  return null;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function deviceDivIcon(color) {
  return L.divIcon({
    className: 'fleet-map-marker',
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 0 3px ${color}40, 0 1px 3px rgba(0,0,0,0.3);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8],
  });
}

export default function FleetMap() {
  const navigate = useNavigate();
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  const { data: devices = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['devices'],
    queryFn: devicesApi.getDevices,
  });

  const located = useMemo(() => devices.filter((d) => resolveCoords(d)), [devices]);
  const unlocated = useMemo(() => devices.filter((d) => !resolveCoords(d)), [devices]);

  // Init the map once.
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, { scrollWheelZoom: true }).setView([20, 10], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Redraw markers whenever the device list changes.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const bounds = [];
    located.forEach((d) => {
      const [lat, lng, kind] = resolveCoords(d);
      bounds.push([lat, lng]);
      const color = STATUS_COLOR[d.status] || STATUS_COLOR.inactive;
      const marker = L.marker([lat, lng], { icon: deviceDivIcon(color) });
      marker.bindPopup(`
        <div style="font-size:0.8rem;line-height:1.5;min-width:160px;">
          <div style="font-weight:700;margin-bottom:0.15rem;">${escapeHtml(d.pack_name)}</div>
          <div style="color:#666;">SN: ${escapeHtml(d.serial_number)}</div>
          <div style="color:#666;text-transform:capitalize;">Status: ${escapeHtml(d.status || 'unknown')}</div>
          ${d.latest_telemetry?.soc != null ? `<div style="color:#666;">SOC: ${d.latest_telemetry.soc.toFixed(0)}%</div>` : ''}
          <div style="color:#999;font-size:0.7rem;margin-top:0.15rem;">${kind === 'live' ? 'Live GPS fix' : 'Home location'}</div>
          <button class="fleet-map-goto" data-href="/app/devices/${d.id}/realtime" style="margin-top:0.5rem;width:100%;padding:0.35rem;background:#0891b2;color:#fff;border:none;border-radius:4px;font-size:0.75rem;cursor:pointer;">View Live &rarr;</button>
        </div>
      `);
      marker.addTo(layer);
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    }

    // Popups are raw HTML strings, not React - wire the "View Live" button's
    // click after Leaflet inserts it into the DOM on open.
    const handlePopupOpen = (e) => {
      const btn = e.popup.getElement()?.querySelector('.fleet-map-goto');
      if (btn && !btn.dataset.wired) {
        btn.dataset.wired = '1';
        btn.addEventListener('click', () => navigate(btn.getAttribute('data-href')));
      }
    };
    map.on('popupopen', handlePopupOpen);
    return () => map.off('popupopen', handlePopupOpen);
  }, [located, navigate]);

  if (isLoading) return <LoadingState label="Loading fleet locations…" />;
  if (isError) return <ErrorState title="Couldn't load the fleet" message="The device list failed to load from the server." onRetry={refetch} />;

  return (
    <div className="animate-in">
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <MapIcon size={24} color="var(--accent-primary)" />
          Fleet Map
        </h2>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
          {located.length} of {devices.length} batteries have a plottable location — live GPS fix where available, otherwise the device's home location.
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '1.5rem' }}>
        <div ref={mapEl} style={{ height: '560px', width: '100%' }} />
      </div>

      {devices.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem', color: 'var(--text-muted)' }}>
          <Battery size={40} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
          <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>No batteries registered yet</p>
        </div>
      ) : unlocated.length > 0 && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <MapPin size={16} color="var(--text-muted)" /> No location set ({unlocated.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {unlocated.map((d) => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <Battery size={14} color="var(--text-muted)" /> {d.pack_name} <span style={{ color: 'var(--text-muted)' }}>· {d.serial_number}</span>
                </div>
                <button
                  onClick={() => navigate('/app/fleet/devices')}
                  style={{ fontSize: '0.72rem', padding: '0.3rem 0.6rem', background: 'transparent', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  Set home location
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
