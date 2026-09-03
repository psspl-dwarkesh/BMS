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
        message="This device hasn't reported any data yet, or its live/simulated telemetry hasn't started. Check back shortly, or import a historical CSV from the Data Ingestion tab."
      />
    );
  }

  return <Component {...{ [propName]: analytics }} />;
}
