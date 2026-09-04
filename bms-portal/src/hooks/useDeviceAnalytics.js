import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { telemetryApi } from '../api/endpoints';
import { adaptHistoryToRows } from '../utils/telemetryAdapter';
import { processBatteryData } from '../utils/csvParser';

// How long to keep polling a device with no data yet before giving up -
// long enough for a CSV import's background task or the first simulator
// tick to land, short enough that a device that will legitimately never
// produce telemetry (misconfigured connection, deleted mid-import) doesn't
// poll every 2s for the lifetime of the mounted tab.
const NO_DATA_POLL_TIMEOUT_MS = 60000;

// Bounded recent-window aggregate analytics for a device, reusing the same
// engine CSV-imported data runs through (see utils/telemetryAdapter.js for
// why). Deliberately capped (not the device's entire history) - this feeds
// full recompute-on-every-call analytics (EKF, anomaly scan), not a raw
// ledger, so an unbounded fetch would be wasteful and get slower over time
// as a device accumulates history.
export function useDeviceAnalytics(deviceId, { pageSize = 500 } = {}) {
  const pollStartedAtRef = useRef(Date.now());
  // Reset the polling window whenever we start watching a different device.
  useEffect(() => {
    pollStartedAtRef.current = Date.now();
  }, [deviceId]);

  return useQuery({
    queryKey: ['device-analytics', deviceId, pageSize],
    queryFn: async () => {
      const history = await telemetryApi.getHistory(deviceId, { page: 1, pageSize });
      const rows = history?.items || [];
      if (rows.length === 0) return null;
      const csvRows = adaptHistoryToRows(rows);
      const analytics = processBatteryData(csvRows);
      // Flag when this device's real history is bigger than the window we
      // actually fetched, so the UI can say so instead of silently
      // presenting a recent-window trend as if it were the full history.
      analytics.isPartialWindow = (history?.total ?? rows.length) > rows.length;
      analytics.windowRowCount = rows.length;
      return analytics;
    },
    enabled: !!deviceId,
    // A CSV import (or the very first simulator tick) finishes in a background
    // task shortly after this page mounts, not before - poll briefly until
    // real data shows up (rather than the page looking permanently broken
    // right after "Create Battery & Analyze"), then stop - either because
    // data arrived, or because NO_DATA_POLL_TIMEOUT_MS elapsed with none.
    refetchInterval: (query) => {
      if (query.state.data) return false;
      if (Date.now() - pollStartedAtRef.current > NO_DATA_POLL_TIMEOUT_MS) return false;
      return 2000;
    },
  });
}
