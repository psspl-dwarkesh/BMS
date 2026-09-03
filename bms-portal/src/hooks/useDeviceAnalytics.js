import { useQuery } from '@tanstack/react-query';
import { telemetryApi } from '../api/endpoints';
import { adaptHistoryToRows } from '../utils/telemetryAdapter';
import { processBatteryData } from '../utils/csvParser';

// Bounded recent-window aggregate analytics for a device, reusing the same
// engine CSV-imported data runs through (see utils/telemetryAdapter.js for
// why). Deliberately capped (not the device's entire history) - this feeds
// full recompute-on-every-call analytics (EKF, anomaly scan), not a raw
// ledger, so an unbounded fetch would be wasteful and get slower over time
// as a device accumulates history.
export function useDeviceAnalytics(deviceId, { pageSize = 500 } = {}) {
  return useQuery({
    queryKey: ['device-analytics', deviceId, pageSize],
    queryFn: async () => {
      const history = await telemetryApi.getHistory(deviceId, { page: 1, pageSize });
      const rows = history?.items || [];
      if (rows.length === 0) return null;
      const csvRows = adaptHistoryToRows(rows);
      return processBatteryData(csvRows);
    },
    enabled: !!deviceId,
  });
}
