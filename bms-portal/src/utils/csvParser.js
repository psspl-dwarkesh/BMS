import Papa from 'papaparse';

export const parseCSV = (file) => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const data = results.data;
          const analytics = processBatteryData(data);
          analytics.datasets = [{ name: file.name, data: data, active: true }];
          resolve(analytics);
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => reject(error),
    });
  });
};

export const parseMultipleCSV = (files) => {
  return new Promise(async (resolve, reject) => {
    try {
      let allData = [];
      const datasets = [];

      for (const file of files) {
        const fileData = await new Promise((res, rej) => {
          Papa.parse(file, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: (results) => res(results.data),
            error: (err) => rej(err),
          });
        });
        datasets.push({ name: file.name, data: fileData, active: true });
        allData = allData.concat(fileData);
      }

      const analytics = processBatteryData(allData);
      analytics.datasetNames = Array.from(files).map(f => f.name);
      analytics.datasets = datasets;
      resolve(analytics);
    } catch (error) {
      reject(error);
    }
  });
};

export const reprocessDatasets = (datasets) => {
  const activeDatasets = datasets.filter(d => d.active !== false);
  let allData = [];
  activeDatasets.forEach(d => {
    allData = allData.concat(d.data);
  });

  if (allData.length === 0) return null;

  const analytics = processBatteryData(allData);
  analytics.datasets = datasets;
  analytics.datasetNames = activeDatasets.map(d => d.name);
  return analytics;
};

// Locate a signal column by keyword. Prefers an explicit "Pack <keyword>" header,
// falls back to any non-cell-level column containing the keyword, and returns
// null (never a guessed default) when the signal genuinely isn't in the CSV.
const findSignalKey = (headers, keyword, excludeHeaders = []) => {
  const isExcluded = (k) => excludeHeaders.includes(k);
  const packMatch = headers.find(k => !isExcluded(k) && k.toLowerCase().includes('pack') && k.toLowerCase().includes(keyword));
  if (packMatch) return packMatch;
  const looseMatch = headers.find(k => !isExcluded(k) && k.toLowerCase().includes(keyword));
  return looseMatch || null;
};

// Turns a per-cell column name (e.g. "Cell14_Voltage") into a short display
// label ("Cell 14"). Falls back to the raw column name if it carries no index.
const cellLabel = (col) => {
  const m = col.match(/\d+/);
  return m ? `Cell ${m[0]}` : col;
};

// Cap on how many anomaly rows we'll ever accumulate for one dataset - keeps a
// pathological CSV (e.g. every row out of range) from ballooning memory, while
// staying generous enough that the Alerts tab and reports show a real picture.
const ANOMALY_CAP = 300;

export const processBatteryData = (data) => {
  if (!data || data.length === 0) throw new Error("No data found in CSV");

  // Arrays to hold time-series data for charts
  const timeSeries = [];

  // Pack KPIs. These only accumulate over rows where the signal was actually
  // present and parsed cleanly - no fabricated values are ever mixed in.
  let totalVoltage = 0, voltageSamples = 0;
  let maxVoltage = -Infinity;
  let minVoltage = Infinity;

  let totalCurrent = 0, currentSamples = 0;
  let maxCurrent = -Infinity;
  let minCurrent = Infinity;

  let totalTemp = 0, tempSamples = 0;
  let maxTemp = -Infinity;
  let minTemp = Infinity;

  let totalSOC = 0, socSamples = 0;
  let maxSOC = -Infinity;
  let minSOC = Infinity;
  let firstSOC = null;
  let lastSOC = null;

  // Energy / duration accounting (charge vs discharge)
  let chargeAh = 0;
  let dischargeAh = 0;
  let chargeWh = 0;
  let dischargeWh = 0;
  let operatingSeconds = 0;
  let chargeSeconds = 0;
  let dischargeSeconds = 0;

  // Cell-level voltage aggregates (per-column, for weakest/strongest cell ID)
  // and the largest imbalance/spread ever observed across the dataset.
  const cellVoltageTotals = {};
  let maxVSpreadObserved = 0;

  // Cell-level temperature aggregates (only populated when the CSV actually
  // has Cell*_Temp columns).
  let totalCellTemp = 0, cellTempSamples = 0;
  let maxCellTemp = -Infinity, minCellTemp = Infinity;
  let maxCellTempSpreadObserved = 0;
  let totalCellTempSpread = 0, cellTempSpreadSamples = 0;

  // Anomalies - every entry here is triggered by a real parsed value crossing
  // an explicit, documented threshold. Nothing is invented to pad this list.
  const allAnomalies = [];

  const headers = Object.keys(data[0]);

  // Determine cell columns (assuming headers like 'Cell1_Voltage', 'Cell2_Voltage' or similar)
  const cellVoltageCols = headers.filter(k => k.toLowerCase().includes('cell') && k.toLowerCase().includes('voltage'));
  const cellTempCols = headers.filter(k => k.toLowerCase().includes('cell') && k.toLowerCase().includes('temp'));
  const cellHeaders = headers.filter(k => k.toLowerCase().includes('cell'));

  // Cell-level analysis is only possible when the CSV actually provides
  // per-cell columns - we never invent per-cell readings.
  const hasCellData = cellVoltageCols.length > 0;
  const hasCellTempData = cellTempCols.length > 0;
  cellVoltageCols.forEach(col => { cellVoltageTotals[col] = { total: 0, samples: 0 }; });

  // Resolve each required pack-level signal column once, up front. A null here
  // means the signal is genuinely absent from this CSV - it is surfaced as an
  // "insufficient data" state, never silently filled with a plausible-looking number.
  const vKey = findSignalKey(headers, 'volt', cellHeaders);
  const cKey = findSignalKey(headers, 'current', cellHeaders);
  const tKey = findSignalKey(headers, 'temp', cellHeaders);
  const sKey = findSignalKey(headers, 'soc', cellHeaders);
  const timeKey = findSignalKey(headers, 'time', []);

  // Pre-pass: dataset-wide current mean/std, used later to flag statistically
  // unusual current draw. A second lightweight pass keeps this deterministic -
  // every row is judged against the *whole* dataset's current profile rather
  // than a running average that would be unstable near the start of the file.
  let currentMeanPre = null, currentStdPre = null;
  if (cKey) {
    const currentVals = [];
    data.forEach(row => {
      const val = parseFloat(row[cKey]);
      if (!isNaN(val)) currentVals.push(val);
    });
    if (currentVals.length > 10) {
      const mean = currentVals.reduce((a, b) => a + b, 0) / currentVals.length;
      const variance = currentVals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / currentVals.length;
      currentMeanPre = mean;
      currentStdPre = Math.sqrt(variance);
    }
  }

  // Data Quality Metrics
  const dataQuality = {
    totalRows: data.length,
    availableSignals: headers,
    missingRequiredSignals: [],
    invalidValues: 0,
    missingTimestamps: 0,
    dataGaps: 0,
    score: 100
  };

  const reqSignals = ['voltage', 'current', 'temp', 'soc'];
  reqSignals.forEach(rs => {
    if (!headers.some(k => k.toLowerCase().includes(rs))) {
      dataQuality.missingRequiredSignals.push(rs);
      dataQuality.score -= 10;
    }
  });

  let prevTime = null;
  let totalAh = 0;
  const degradationSeries = [];

  // Extended Kalman Filter (EKF) State Variables for SOH/Capacity Estimation.
  // This pipeline only ever runs to fill in capacity/SOH/cycle when those
  // signals are not present in the CSV - every point it produces is tagged
  // isEstimate so the UI can mark it as modeled rather than measured.
  let ekf_x = 50.0; // Initial state: Estimated Capacity (Ah)
  let ekf_p = 1.0;  // Initial estimation error covariance
  const ekf_q = 0.0001; // Process noise covariance (capacity fades slowly)
  const ekf_r = 0.05;   // Measurement noise covariance (sensor noise)

  // Find specific cycling headers if they exist
  const cycleKey = headers.find(k => k.toLowerCase().includes('cycle'));
  const sohKey = headers.find(k => k.toLowerCase() === 'soh' || k.toLowerCase().includes('health'));
  const capKey = headers.find(k => k.toLowerCase().includes('capacity'));
  const statusKey = headers.find(k => k.toLowerCase().includes('status') || k.toLowerCase().includes('mode'));
  const cycleIsEstimate = !cycleKey;
  const capacityIsEstimate = !capKey;
  const sohIsEstimate = !sohKey;
  // Without current (for Coulomb counting) and without direct capacity/SOH
  // columns, there is no signal at all to base a degradation estimate on -
  // the EKF's initial priors alone are not a real estimate, so skip the
  // pipeline entirely rather than emit a fabricated single data point.
  const canDeriveDegradation = !!cKey || !!capKey || !!sohKey;
  let lastLoggedCycle = null;

  data.forEach((row, index) => {
    const vParsed = vKey ? parseFloat(row[vKey]) : NaN;
    const cParsed = cKey ? parseFloat(row[cKey]) : NaN;
    const tParsed = tKey ? parseFloat(row[tKey]) : NaN;
    const sParsed = sKey ? parseFloat(row[sKey]) : NaN;
    const time = timeKey ? parseFloat(row[timeKey]) : NaN;

    // null = signal genuinely unavailable for this row (missing column or
    // unparseable value). Never replaced with a fabricated fallback.
    const v = isNaN(vParsed) ? null : vParsed;
    const c = isNaN(cParsed) ? null : cParsed;
    const t = isNaN(tParsed) ? null : tParsed;
    const s = isNaN(sParsed) ? null : sParsed;

    // Quality check: only count as an "invalid value" when the column exists
    // but the value in it couldn't be parsed - a wholly missing column is
    // already reflected in dataQuality.missingRequiredSignals.
    if (vKey && v === null) dataQuality.invalidValues++;
    if (cKey && c === null) dataQuality.invalidValues++;
    if (tKey && t === null) dataQuality.invalidValues++;
    if (isNaN(time) || (timeKey && row[timeKey] === undefined)) dataQuality.missingTimestamps++;

    const validTime = isNaN(time) ? index : time;
    if (prevTime !== null) {
      const dtSeconds = validTime - prevTime;
      if (dtSeconds > 60) {
        dataQuality.dataGaps++;
        dataQuality.score -= 2;
      }
      const dtHours = dtSeconds / 3600;

      // Coulomb Counting: Integrate Current * dt (hours). Skipped when current
      // is unavailable for this interval rather than assuming 0A.
      if (c !== null) {
        totalAh += Math.abs(c) * dtHours;

        // Determine charge vs discharge for this interval: prefer an explicit
        // status signal if the CSV provides one, otherwise fall back to the
        // sign of current (negative = current flowing into the pack = charging).
        let isCharging;
        if (statusKey && row[statusKey] !== undefined && row[statusKey] !== null && row[statusKey] !== '') {
          const statusVal = String(row[statusKey]).toLowerCase();
          if (statusVal.includes('discharg')) isCharging = false;
          else if (statusVal.includes('charg')) isCharging = true;
        }
        if (isCharging === undefined) isCharging = c < 0;

        if (dtSeconds > 0) {
          operatingSeconds += dtSeconds;
          if (c !== 0) {
            // Energy for this interval (Wh) needs voltage too; if voltage is
            // unavailable for this row we still track Ah, just not Wh/efficiency.
            const wh = v !== null ? Math.abs(v * c) * dtHours : 0;
            if (isCharging) {
              chargeAh += Math.abs(c) * dtHours;
              chargeWh += wh;
              chargeSeconds += dtSeconds;
            } else {
              dischargeAh += Math.abs(c) * dtHours;
              dischargeWh += wh;
              dischargeSeconds += dtSeconds;
            }
          }
        }
      }
    }
    prevTime = validTime;

    // Build degradation profile (skipped entirely if there's no signal to base it on)
    const cycle = cycleKey ? row[cycleKey] : Math.floor(totalAh / 50) + 1; // Assuming 50Ah nominal if no cycles provided
    if (canDeriveDegradation && cycle !== lastLoggedCycle && (cycleKey || Math.floor(totalAh) % 5 === 0)) {

      // Extended Kalman Filter (EKF) - Prediction & Update Steps
      // 1. Prediction Step
      let x_pred = ekf_x; // State prediction (Capacity remains relatively constant short-term)
      let p_pred = ekf_p + ekf_q; // Covariance prediction

      // 2. Measurement Update Step
      // Observe capacity via Coulomb counting throughput vs expected nominal drop.
      // This is a modeled estimate (assumes 50Ah nominal capacity) - not a sensor
      // reading - so no artificial noise is injected to make it look measured.
      const measurement_z = Math.max(0, 50 - (totalAh / 200));
      const kalman_gain = p_pred / (p_pred + ekf_r); // Compute Kalman Gain

      // 3. State Update
      ekf_x = x_pred + kalman_gain * (measurement_z - x_pred);
      ekf_p = (1 - kalman_gain) * p_pred;

      const cap = capKey ? parseFloat(row[capKey]) : ekf_x;
      const soh = sohKey ? parseFloat(row[sohKey]) : (ekf_x / 50.0) * 100; // SOH is current capacity / nominal capacity (50Ah)

      degradationSeries.push({
        cycle: cycle,
        soh: soh,
        capacity: cap,
        ahThroughput: totalAh.toFixed(1),
        ekfVariance: ekf_p.toFixed(4), // Exposing filter variance for validation
        // Per-point flags: true when this value had to be modeled because the
        // CSV didn't carry that signal, rather than read directly from it.
        cycleIsEstimate,
        capacityIsEstimate,
        sohIsEstimate,
        isEstimate: cycleIsEstimate || capacityIsEstimate || sohIsEstimate
      });
      lastLoggedCycle = cycle;
    }

    if (v !== null) {
      totalVoltage += v; voltageSamples++;
      if (v > maxVoltage) maxVoltage = v;
      if (v < minVoltage) minVoltage = v;
    }

    if (c !== null) {
      totalCurrent += c; currentSamples++;
      if (c > maxCurrent) maxCurrent = c;
      if (c < minCurrent) minCurrent = c;

      // Unusual current behavior: statistical outlier against the dataset's
      // own current profile (>4 sigma), so the threshold adapts to whatever
      // C-rate this pack/dataset actually runs at instead of a guessed amp figure.
      if (currentStdPre !== null && currentStdPre > 0) {
        const z = Math.abs(c - currentMeanPre) / currentStdPre;
        if (z > 4 && allAnomalies.length < ANOMALY_CAP) {
          allAnomalies.push({
            timestamp: time,
            type: 'Unusual Current Behavior',
            severity: z > 6 ? 'Critical' : 'Warning',
            description: `Current of ${c.toFixed(1)}A is a statistical outlier (${z.toFixed(1)}σ from the dataset mean of ${currentMeanPre.toFixed(1)}A).`,
            affected: 'Pack'
          });
        }
      }
    }

    if (t !== null) {
      totalTemp += t; tempSamples++;
      if (t > maxTemp) maxTemp = t;
      if (t < minTemp) minTemp = t;
    }

    if (s !== null) {
      totalSOC += s; socSamples++;
      if (s > maxSOC) maxSOC = s;
      if (s < minSOC) minSOC = s;
      if (firstSOC === null) firstSOC = s;
      lastSOC = s;
    }

    // Cell voltage calculations per row - only computed when the CSV actually
    // provides per-cell voltage columns. No cells are invented.
    let vSpread = null;
    if (hasCellData) {
      const cellReadings = cellVoltageCols
        .map(col => ({ col, val: parseFloat(row[col]) }))
        .filter(r => !isNaN(r.val));

      if (cellReadings.length > 0) {
        cellReadings.forEach(r => {
          cellVoltageTotals[r.col].total += r.val;
          cellVoltageTotals[r.col].samples++;
        });

        const voltages = cellReadings.map(r => r.val);
        const maxCellV = Math.max(...voltages);
        const minCellV = Math.min(...voltages);
        vSpread = maxCellV - minCellV;
        if (vSpread > maxVSpreadObserved) maxVSpreadObserved = vSpread;

        if (vSpread > 0.1 && allAnomalies.length < ANOMALY_CAP) {
          const weakestReading = cellReadings.find(r => r.val === minCellV);
          allAnomalies.push({
            timestamp: time,
            type: 'Voltage Imbalance',
            severity: vSpread > 0.15 ? 'Critical' : 'Warning',
            description: `Cell voltage spread of ${(vSpread * 1000).toFixed(0)}mV exceeds threshold.`,
            affected: cellLabel(weakestReading.col)
          });
        }

        // Over/Under-Voltage: absolute Li-ion safe range (2.5V-4.25V), the
        // same bounds the backend's ISO-26262 checker uses for consistency.
        cellReadings.forEach(r => {
          if ((r.val > 4.25 || r.val < 2.5) && allAnomalies.length < ANOMALY_CAP) {
            allAnomalies.push({
              timestamp: time,
              type: r.val > 4.25 ? 'Over-Voltage' : 'Under-Voltage',
              severity: 'Critical',
              description: `${cellLabel(r.col)} reading of ${r.val.toFixed(3)}V is outside the safe 2.5V-4.25V operating range.`,
              affected: cellLabel(r.col)
            });
          }
        });
      }
    }

    // Cell temperature calculations per row - only when Cell*_Temp columns exist.
    let cellTempSpread = null;
    if (hasCellTempData) {
      const temps = cellTempCols.map(col => parseFloat(row[col])).filter(x => !isNaN(x));
      if (temps.length > 0) {
        temps.forEach(tv => {
          totalCellTemp += tv; cellTempSamples++;
          if (tv > maxCellTemp) maxCellTemp = tv;
          if (tv < minCellTemp) minCellTemp = tv;
        });

        const maxT = Math.max(...temps);
        const minT = Math.min(...temps);
        cellTempSpread = maxT - minT;
        totalCellTempSpread += cellTempSpread; cellTempSpreadSamples++;
        if (cellTempSpread > maxCellTempSpreadObserved) maxCellTempSpreadObserved = cellTempSpread;

        if (cellTempSpread > 8 && allAnomalies.length < ANOMALY_CAP) {
          allAnomalies.push({
            timestamp: time,
            type: 'Cell Temperature Imbalance',
            severity: cellTempSpread > 12 ? 'Critical' : 'Warning',
            description: `Cell-to-cell temperature difference of ${cellTempSpread.toFixed(1)}°C exceeds the 8°C consistency threshold.`,
            affected: 'Cell Pack'
          });
        }

        const excessive = temps.filter(tv => tv > 45);
        if (excessive.length > 0 && allAnomalies.length < ANOMALY_CAP) {
          allAnomalies.push({
            timestamp: time,
            type: 'Cell Over-Temperature',
            severity: 'Critical',
            description: `${excessive.length} cell(s) exceeded 45°C (max ${Math.max(...excessive).toFixed(1)}°C).`,
            affected: 'Cell Pack'
          });
        }
      }
    }

    if (t !== null && t > 45 && allAnomalies.length < ANOMALY_CAP) {
      allAnomalies.push({
        timestamp: time,
        type: 'Over-Temperature',
        severity: 'Critical',
        description: `Pack temperature reached ${t.toFixed(1)}°C.`,
        affected: 'Pack'
      });
    }

    // Push to time series (limit to every Nth row if dataset is huge, but here we'll take up to 1000 points for charts)
    if (index % Math.ceil(data.length / 500) === 0) {
      timeSeries.push({
        time,
        voltage: v,
        current: c,
        temperature: t,
        soc: s,
        vSpread: vSpread !== null ? vSpread * 1000 : null, // in mV
        cellTempSpread // in °C, null when no cell temp columns
      });
    }
  });

  // Abnormal degradation pattern: only checked against a *measured* SOH column
  // (never our own EKF curve, which is monotonic by construction and would
  // just be flagging itself). A real cell shouldn't recover SOH meaningfully,
  // nor fall off a cliff in one logged step.
  if (sohKey) {
    for (let i = 1; i < degradationSeries.length; i++) {
      const prev = degradationSeries[i - 1];
      const curr = degradationSeries[i];
      if (typeof prev.soh === 'number' && typeof curr.soh === 'number' && !isNaN(prev.soh) && !isNaN(curr.soh)) {
        const delta = curr.soh - prev.soh;
        if (delta > 1 && allAnomalies.length < ANOMALY_CAP) {
          allAnomalies.push({
            timestamp: `Cycle ${curr.cycle}`,
            type: 'Abnormal Degradation Pattern',
            severity: 'Warning',
            description: `Measured SOH rose from ${prev.soh.toFixed(1)}% to ${curr.soh.toFixed(1)}% between cycles - unexpected for a degrading cell.`,
            affected: 'Pack'
          });
        } else if (delta < -8 && allAnomalies.length < ANOMALY_CAP) {
          allAnomalies.push({
            timestamp: `Cycle ${curr.cycle}`,
            type: 'Abnormal Degradation Pattern',
            severity: 'Critical',
            description: `Measured SOH dropped sharply from ${prev.soh.toFixed(1)}% to ${curr.soh.toFixed(1)}% in a single logged step.`,
            affected: 'Pack'
          });
        }
      }
    }
  }

  const count = data.length;
  const lastDegradationPoint = degradationSeries.length > 0 ? degradationSeries[degradationSeries.length - 1] : null;

  // Energy Charged / Discharged (Wh -> kWh) and Charge/Discharge Efficiency.
  // A real pack can never discharge more energy than it was charged, so a
  // raw ratio above 100% doesn't mean "super-efficient" - it means the
  // logged window caught a discharge that started from energy stored before
  // the log began (e.g. a drive-cycle log with little or no charging
  // captured). Rather than show a physically impossible percentage, treat
  // that case as insufficient data for this KPI.
  const energyChargedKWh = chargeWh / 1000;
  const energyDischargedKWh = dischargeWh / 1000;
  const rawEfficiency = chargeWh > 0 ? (dischargeWh / chargeWh) * 100 : null;
  const chargeDischargeEfficiency = (rawEfficiency !== null && rawEfficiency <= 100) ? rawEfficiency : null;

  // Operating / Charge / Discharge duration, reported in hours
  const operatingDurationHrs = operatingSeconds / 3600;
  const chargeDurationHrs = chargeSeconds / 3600;
  const dischargeDurationHrs = dischargeSeconds / 3600;

  // Weakest/strongest cell identification, from the same per-cell voltage
  // totals accumulated above - only ever populated from real CSV columns.
  let weakestCell = null, strongestCell = null;
  if (hasCellData) {
    const cellAverages = Object.entries(cellVoltageTotals)
      .filter(([, agg]) => agg.samples > 0)
      .map(([col, agg]) => ({ name: cellLabel(col), avgVoltage: agg.total / agg.samples }));
    if (cellAverages.length > 0) {
      weakestCell = cellAverages.reduce((a, b) => (b.avgVoltage < a.avgVoltage ? b : a));
      strongestCell = cellAverages.reduce((a, b) => (b.avgVoltage > a.avgVoltage ? b : a));
    }
  }

  // The score so far only penalizes whole missing columns and time gaps - a
  // column that's *present* but full of unparseable values (invalidValues)
  // hadn't cost anything, which could let a badly corrupted signal still
  // register as "Good". Dock points proportional to how much of the dataset
  // that invalid rate actually represents, capped so a handful of bad rows
  // in a huge file doesn't tank the score disproportionately.
  if (dataQuality.invalidValues > 0 && dataQuality.totalRows > 0) {
    const invalidRate = dataQuality.invalidValues / dataQuality.totalRows;
    dataQuality.score -= Math.min(40, Math.round(invalidRate * 100));
  }
  dataQuality.score = Math.max(0, Math.min(100, dataQuality.score));

  // Data-quality tier - a plain-language read on the numeric score, per the
  // "Good / Limited / Insufficient" categories the requirement doc asks for.
  dataQuality.tier = dataQuality.score >= 85 ? 'Good' : dataQuality.score >= 60 ? 'Limited' : 'Insufficient';
  if (dataQuality.tier !== 'Good' && allAnomalies.length < ANOMALY_CAP) {
    allAnomalies.push({
      timestamp: 'N/A',
      type: 'Data Quality Issue',
      severity: dataQuality.tier === 'Limited' ? 'Warning' : 'Critical',
      description: `Data quality is ${dataQuality.tier} (${dataQuality.score}%) - ${dataQuality.invalidValues} invalid values, ${dataQuality.missingTimestamps} missing timestamps, ${dataQuality.dataGaps} time gaps. Results should be interpreted with caution.`,
      affected: 'Dataset'
    });
  }

  // Most-recent-first ordering for display; the full list backs reports and
  // the Alerts tab, while a short "recent" slice backs compact widgets.
  const sortedAnomalies = [...allAnomalies].reverse();
  const anomalySummary = {
    total: allAnomalies.length,
    critical: allAnomalies.filter(a => a.severity === 'Critical').length,
    warning: allAnomalies.filter(a => a.severity === 'Warning').length,
    byType: allAnomalies.reduce((acc, a) => { acc[a.type] = (acc[a.type] || 0) + 1; return acc; }, {})
  };
  const status = anomalySummary.critical > 0 ? 'Critical' : anomalySummary.total > 0 ? 'Warning' : 'Healthy';

  const pack = {
    avgVoltage: voltageSamples > 0 ? totalVoltage / voltageSamples : null,
    maxVoltage: voltageSamples > 0 ? maxVoltage : null,
    minVoltage: voltageSamples > 0 ? minVoltage : null,
    voltageSamples,
    avgCurrent: currentSamples > 0 ? totalCurrent / currentSamples : null,
    maxCurrent: currentSamples > 0 ? maxCurrent : null,
    minCurrent: currentSamples > 0 ? minCurrent : null,
    currentSamples,
    avgTemp: tempSamples > 0 ? totalTemp / tempSamples : null,
    maxTemp: tempSamples > 0 ? maxTemp : null,
    minTemp: tempSamples > 0 ? minTemp : null,
    tempSamples,
    avgSOC: socSamples > 0 ? totalSOC / socSamples : null,
    initialSOC: firstSOC,
    finalSOC: lastSOC,
    minSOC: isFinite(minSOC) ? minSOC : null,
    maxSOC: isFinite(maxSOC) ? maxSOC : null,
    socRange: (isFinite(maxSOC) && isFinite(minSOC)) ? maxSOC - minSOC : null,
    socSamples,
    totalRows: count,
    // SOH is only ever a real reading when the CSV supplies a SOH/health
    // column directly; otherwise it's the last EKF/Coulomb-counting
    // estimate (or null when there isn't even enough throughput data to
    // produce one) - estimatedSOHIsEstimate tells the UI which it is.
    estimatedSOH: lastDegradationPoint ? Number(lastDegradationPoint.soh).toFixed(1) : null,
    estimatedSOHIsEstimate: lastDegradationPoint ? lastDegradationPoint.sohIsEstimate : null,
    energyChargedKWh,
    energyDischargedKWh,
    chargeDischargeEfficiency, // % — null when no charging interval was found
    operatingDurationHrs,
    chargeDurationHrs,
    dischargeDurationHrs,
    // Cell-level pack KPIs (null when the CSV has no per-cell columns)
    maxCellVoltageSpread: hasCellData ? maxVSpreadObserved : null,
    weakestCell,
    strongestCell,
    avgCellTemp: cellTempSamples > 0 ? totalCellTemp / cellTempSamples : null,
    maxCellTemp: cellTempSamples > 0 ? maxCellTemp : null,
    minCellTemp: cellTempSamples > 0 ? minCellTemp : null,
    maxCellTempSpread: hasCellTempData ? maxCellTempSpreadObserved : null,
    avgCellTempSpread: cellTempSpreadSamples > 0 ? totalCellTempSpread / cellTempSpreadSamples : null
  };

  const signalsAvailable = {
    voltage: !!vKey,
    current: !!cKey,
    temperature: !!tKey,
    soc: !!sKey,
    cellVoltage: hasCellData,
    cellTemperature: hasCellTempData,
    capacity: !!capKey,
    soh: !!sohKey,
    cycle: !!cycleKey
  };

  // Automated findings - short, plain-language statements built entirely from
  // the numbers computed above. Nothing here is a template with blanks filled
  // by guesswork; each line either reports a real measurement or explicitly
  // says the signal needed to make that assessment isn't in the source CSV.
  const findings = [];

  if (degradationSeries.length >= 2) {
    const first = degradationSeries[0];
    const last = degradationSeries[degradationSeries.length - 1];
    const sohDelta = last.soh - first.soh;
    const basis = last.sohIsEstimate ? 'estimated via Coulomb-counting/EKF' : 'measured from the source CSV';
    if (Math.abs(sohDelta) < 0.5) {
      findings.push({ category: 'Degradation', severity: 'info', text: `SOH held steady around ${last.soh.toFixed(1)}% across ${degradationSeries.length} logged cycles (${basis}) — no significant fade observed in this dataset.` });
    } else {
      findings.push({ category: 'Degradation', severity: sohDelta < -5 ? 'warning' : 'info', text: `SOH ${sohDelta < 0 ? 'declined' : 'rose'} from ${first.soh.toFixed(1)}% to ${last.soh.toFixed(1)}% over ${degradationSeries.length} logged cycles (${basis}).` });
    }
  } else {
    findings.push({ category: 'Degradation', severity: 'info', text: 'Not enough multi-cycle data (no Cycle Number column or repeated charge/discharge coverage) to establish a degradation trend.' });
  }

  if (hasCellData) {
    if (maxVSpreadObserved > 0.1) {
      findings.push({ category: 'Cell Imbalance', severity: maxVSpreadObserved > 0.15 ? 'critical' : 'warning', text: `Peak cell voltage spread of ${(maxVSpreadObserved * 1000).toFixed(0)}mV was observed (weakest cell: ${weakestCell ? weakestCell.name : 'n/a'}), exceeding the 100mV imbalance threshold.` });
    } else {
      findings.push({ category: 'Cell Imbalance', severity: 'info', text: `Cell voltages stayed balanced — peak spread of ${(maxVSpreadObserved * 1000).toFixed(0)}mV stayed under the 100mV threshold.` });
    }
  } else {
    findings.push({ category: 'Cell Imbalance', severity: 'info', text: 'No per-cell voltage columns in this CSV — cell imbalance could not be assessed.' });
  }

  if (tempSamples > 0) {
    if (maxTemp > 45) {
      findings.push({ category: 'Thermal', severity: 'critical', text: `Pack temperature reached ${maxTemp.toFixed(1)}°C, exceeding the 45°C safe-operating threshold.` });
    } else {
      findings.push({ category: 'Thermal', severity: 'info', text: `Pack temperature stayed within a normal range (max ${maxTemp.toFixed(1)}°C).` });
    }
    if (hasCellTempData && maxCellTempSpreadObserved > 8) {
      findings.push({ category: 'Thermal', severity: 'warning', text: `Cell-to-cell temperature difference reached ${maxCellTempSpreadObserved.toFixed(1)}°C, above the 8°C consistency threshold.` });
    } else if (!hasCellTempData) {
      findings.push({ category: 'Thermal', severity: 'info', text: 'No per-cell temperature columns in this CSV — cell-to-cell temperature difference could not be assessed.' });
    }
  } else {
    findings.push({ category: 'Thermal', severity: 'info', text: 'No temperature signal found in this CSV — thermal behavior could not be assessed.' });
  }

  findings.push({
    category: 'Anomalies',
    severity: anomalySummary.critical > 0 ? 'critical' : anomalySummary.total > 0 ? 'warning' : 'info',
    text: anomalySummary.total > 0
      ? `${anomalySummary.total} anomal${anomalySummary.total === 1 ? 'y' : 'ies'} detected (${anomalySummary.critical} critical, ${anomalySummary.warning} warning).`
      : 'No anomalies detected across the dataset.'
  });

  const affectedCounts = {};
  allAnomalies.forEach(a => { affectedCounts[a.affected] = (affectedCounts[a.affected] || 0) + 1; });
  const topAffected = Object.entries(affectedCounts).sort((a, b) => b[1] - a[1])[0];
  if (topAffected && topAffected[1] >= 2) {
    findings.push({ category: 'Investigation', severity: 'warning', text: `${topAffected[0]} was flagged in ${topAffected[1]} of ${anomalySummary.total} anomalies — recommended focus area for engineering investigation.` });
  }

  findings.push({
    category: 'Data Quality',
    severity: dataQuality.tier === 'Good' ? 'info' : dataQuality.tier === 'Limited' ? 'warning' : 'critical',
    text: `Data quality: ${dataQuality.tier} (${dataQuality.score}%). ${dataQuality.missingRequiredSignals.length > 0 ? 'Missing base signal keywords: ' + dataQuality.missingRequiredSignals.join(', ') + '.' : 'All required base signals were mapped.'}`
  });

  return {
    kpis: { pack },
    timeSeries,
    degradationSeries,
    anomalies: sortedAnomalies.slice(0, 5), // compact "recent" view for dashboard widgets
    allAnomalies: sortedAnomalies, // full list, for the Alerts tab and exported reports
    anomalySummary,
    status,
    dataQuality,
    findings,
    // Per-signal availability, for UI components that need to explain *why*
    // a KPI or chart is showing an "insufficient data" / "estimated" state.
    signalsAvailable
  };
};
