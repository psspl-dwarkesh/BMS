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

  // Anomalies
  const anomalies = [];

  const headers = Object.keys(data[0]);

  // Determine cell columns (assuming headers like 'Cell1_Voltage', 'Cell2_Voltage' or similar)
  const cellVoltageCols = headers.filter(k => k.toLowerCase().includes('cell') && k.toLowerCase().includes('voltage'));
  const cellTempCols = headers.filter(k => k.toLowerCase().includes('cell') && k.toLowerCase().includes('temp'));
  const cellHeaders = headers.filter(k => k.toLowerCase().includes('cell'));

  // Cell-level voltage imbalance analysis is only possible when the CSV actually
  // provides per-cell columns - we never invent per-cell readings.
  const hasCellData = cellVoltageCols.length > 0;

  // Resolve each required pack-level signal column once, up front. A null here
  // means the signal is genuinely absent from this CSV - it is surfaced as an
  // "insufficient data" state, never silently filled with a plausible-looking number.
  const vKey = findSignalKey(headers, 'volt', cellHeaders);
  const cKey = findSignalKey(headers, 'current', cellHeaders);
  const tKey = findSignalKey(headers, 'temp', cellHeaders);
  const sKey = findSignalKey(headers, 'soc', cellHeaders);
  const timeKey = findSignalKey(headers, 'time', []);

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

    // Cell calculations per row - only computed when the CSV actually
    // provides per-cell voltage columns. No cells are invented.
    let vSpread = null;
    if (hasCellData) {
      const cellVoltages = cellVoltageCols
        .map(col => parseFloat(row[col]))
        .filter(x => !isNaN(x));

      if (cellVoltages.length > 0) {
        const maxCellV = Math.max(...cellVoltages);
        const minCellV = Math.min(...cellVoltages);
        vSpread = maxCellV - minCellV;

        if (vSpread > 0.1 && anomalies.length < 50) { // Limit to 50 alerts
          anomalies.push({
            timestamp: time,
            type: 'Voltage Imbalance',
            severity: vSpread > 0.15 ? 'Critical' : 'Warning',
            description: `Cell voltage spread of ${(vSpread * 1000).toFixed(0)}mV exceeds threshold.`,
            affected: `Cell ${cellVoltages.indexOf(minCellV) + 1}`
          });
        }
      }
    }

    if (t !== null && t > 45 && anomalies.length < 50) {
      anomalies.push({
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
        vSpread: vSpread !== null ? vSpread * 1000 : null // in mV
      });
    }
  });

  const count = data.length;
  const lastDegradationPoint = degradationSeries.length > 0 ? degradationSeries[degradationSeries.length - 1] : null;

  // Energy Charged / Discharged (Wh -> kWh) and Charge/Discharge Efficiency
  const energyChargedKWh = chargeWh / 1000;
  const energyDischargedKWh = dischargeWh / 1000;
  const chargeDischargeEfficiency = chargeWh > 0 ? (dischargeWh / chargeWh) * 100 : null;

  // Operating / Charge / Discharge duration, reported in hours
  const operatingDurationHrs = operatingSeconds / 3600;
  const chargeDurationHrs = chargeSeconds / 3600;
  const dischargeDurationHrs = dischargeSeconds / 3600;

  return {
    kpis: {
      pack: {
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
        dischargeDurationHrs
      }
    },
    timeSeries,
    degradationSeries,
    anomalies: anomalies.reverse().slice(0, 5), // Top 5 recent anomalies
    status: anomalies.some(a => a.severity === 'Critical') ? 'Critical' : anomalies.length > 0 ? 'Warning' : 'Healthy',
    dataQuality,
    // Per-signal availability, for UI components that need to explain *why*
    // a KPI or chart is showing an "insufficient data" / "estimated" state.
    signalsAvailable: {
      voltage: !!vKey,
      current: !!cKey,
      temperature: !!tKey,
      soc: !!sKey,
      cellVoltage: hasCellData,
      capacity: !!capKey,
      soh: !!sohKey,
      cycle: !!cycleKey
    }
  };
};
