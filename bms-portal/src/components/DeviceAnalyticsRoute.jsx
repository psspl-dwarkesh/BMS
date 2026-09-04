import { useParams } from 'react-router-dom';
import { useDeviceAnalytics } from '../hooks/useDeviceAnalytics';
import { LoadingState, EmptyState, ErrorState } from './common/StateViews';
import { FileSearch } from 'lucide-react';

// Wires one of the recent-window analytics pages (Degradation, Data Quality,
// Thermal, Reports, Findings) to a device's real telemetry history via
// utils/telemetryAdapter.js + csvParser's processBatteryData, instead of the
// old CSV-upload-only flow. `propName` matches whatever prop name the target
// component expects (most use `data`; DataQuality uses `analyticsData`).
export default function DeviceAnalyticsRoute({ component: Component, propName = 'data' }) {
  const { id } = useParams();
  const { data: analytics, isLoading, isError, refetch } = useDeviceAnalytics(id);

  if (isLoading) return <LoadingState label="Crunching telemetry history..." />;

  if (isError) {
    return (
      <ErrorState
        title="Couldn't load analytics"
        message="The device's telemetry history failed to load."
        onRetry={refetch}
      />
    );
  }

  if (!analytics) {
    return (
      <EmptyState
        icon={FileSearch}
        title="No telemetry history yet"
        message="This device hasn't reported any data yet, or its live/simulated telemetry hasn't started."
      />
    );
  }

  return (
    <>
      {analytics.isPartialWindow && (
        <div
          className="badge badge-neutral"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem', padding: '0.5rem 0.85rem' }}
          title="This device has more history than is shown here. Trends and totals below reflect only this recent window, not the device's full lifetime."
        >
          Showing the most recent {analytics.windowRowCount.toLocaleString()} samples — this device has more history than fits this view
        </div>
      )}
      <Component {...{ [propName]: analytics }} />
    </>
  );
}
