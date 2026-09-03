// Adapts live/backend telemetry history rows into the flat, keyword-matched
// row shape `csvParser.js::processBatteryData()` already expects (it was
// built for PapaParse-parsed CSV rows and detects columns by keyword). This
// lets the analytics pages that were built against that engine (Degradation,
// Data Quality, Thermal, Reports, Findings) run for real against a device's
// backend history instead of permanently rendering an empty state.
//
// Design notes:
// - `history` from `telemetryApi.getHistory` is pack-level only (no per-cell
//   array — that stays on CellAnalysis's dedicated `/latest` + `/cells`
//   drill-down, to keep this list payload light). To still give the
//   imbalance/spread logic something real to work with, we synthesize two
//   "virtual cells" per row from the server-computed max/min columns that
//   *are* present on every Telemetry row (`max_cell_voltage`/
//   `min_cell_voltage`, `max_thermistor_temp`/`min_thermistor_temp`). These
//   are real measured extremes, not fabricated values — just reduced from
//   N cells down to 2 (max/min) for this pack-level view. Full per-cell
//   detail remains exclusively on the Cells page.
// - `processBatteryData` assumes chronologically-ascending rows (it
//   accumulates Ah throughput and degradation cycles forward in time); the
//   history endpoint returns newest-first, so this reverses it.
// - Its `time` column must be a monotonically increasing *number* (elapsed
//   seconds), not an ISO datetime string — `parseFloat` on an ISO string
//   only reads the leading digits, which would silently corrupt every
//   gap/duration calculation. We pass real elapsed seconds from the first
//   row instead.
// - `processBatteryData`'s charge/discharge split treats negative current as
//   charging; this app's live pages (DeviceRealtime) show positive current
//   as charging, so the sign is flipped here to keep that KPI meaningful.
export function adaptHistoryToRows(historyRows) {
  if (!historyRows || historyRows.length === 0) return [];

  const chronological = [...historyRows].reverse();
  const t0 = new Date(chronological[0].sample_time).getTime();

  return chronological.map((row) => {
    const csvRow = {
      Elapsed_Time_Seconds: (new Date(row.sample_time).getTime() - t0) / 1000,
      Pack_Voltage: row.pack_voltage,
      // Flip sign: csvParser treats current<0 as charging, this app treats current>0 as charging.
      Pack_Current: row.pack_current == null ? null : -row.pack_current,
      Temperature: row.avg_cell_temp,
      SOC: row.soc,
    };
    if (row.soh != null) csvRow.SOH = row.soh;
    if (row.max_cell_voltage != null) csvRow.Cell_Max_Voltage = row.max_cell_voltage;
    if (row.min_cell_voltage != null) csvRow.Cell_Min_Voltage = row.min_cell_voltage;
    if (row.max_thermistor_temp != null) csvRow.Cell_Max_Temp = row.max_thermistor_temp;
    if (row.min_thermistor_temp != null) csvRow.Cell_Min_Temp = row.min_thermistor_temp;
    return csvRow;
  });
}
