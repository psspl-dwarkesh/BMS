import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapPin, AlertTriangle } from 'lucide-react';
import { telemetryApi, devicesApi } from '../api/endpoints';

export default function LocationTracker() {
  const { id } = useParams();
  
  // We would normally use react-leaflet, but since we didn't install it, we can use an iframe to OpenStreetMap
  // or a simple generic map placeholder, or we can install leaflet. 
  // Let's use a simple HTML5 geolocation / OSM static map or iframe for this implementation, 
  // or instruct the user to install leaflet if they want a real interactive map.
  // Actually, since this is a React app, using a raw Leaflet Map without React-Leaflet requires direct DOM manipulation.
  
  const { data: latest, isLoading } = useQuery({
    queryKey: ['telemetry-latest-loc', id],
    queryFn: () => telemetryApi.getLatest(id),
    refetchInterval: 2000,
    enabled: !!id
  });

  const { data: device } = useQuery({
    queryKey: ['device', id],
    queryFn: () => devicesApi.getDevice(id),
    enabled: !!id
  });

  if (isLoading) {
    return <div className="p-8 text-center">Loading location data...</div>;
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
    </div>
  );
}
