"""
Central telemetry ingestion pipeline.

Both the device simulator (source="simulator") and the CSV-import endpoint
(source="csv_import") call `ingest_telemetry_row()`.  A future real-hardware
handler becomes a third caller (source="device") with zero pipeline changes.

Alert logic
-----------
We keep ONE open alert per (device, alert_type[, cell_number]).  On each
ingest we check thresholds and:
  - If a violation is NEW  → insert Alert row, return it as "new_alert".
  - If a violation is OPEN → do nothing (avoid the old noisy re-broadcast bug).
  - If a violation CLEARED → set resolved_at on the open alert, return it as
    "resolved_alert".

Callers are responsible for broadcasting over WebSocket; this function is
purely DB work and returns the alert rows it created/resolved so the caller
can decide what to broadcast.
"""
import datetime
from typing import Any

from sqlalchemy.orm import Session

from models import (
    Alert, AlertSeverity, AlertType,
    CellReading, Device, Telemetry, TelemetrySource,
)

# ── Thresholds ────────────────────────────────────────────────────────────────

THRESHOLDS = {
    "high_voltage_v":        4.25,   # V per cell
    "low_voltage_v":         2.80,   # V per cell
    "high_pack_voltage_v":   68.0,   # V pack (16S × 4.25)
    "high_temp_c":           55.0,   # °C
    "low_soc_pct":           15.0,   # %
    "cell_imbalance_mv":     150.0,  # mV spread between max and min cell
    "overcurrent_a":         100.0,  # A absolute value
}


def _mv_to_v(mv: float) -> float:
    return mv / 1000.0


def _open_alert(
    db: Session,
    device_id: int,
    alert_type: AlertType,
    cell_number: int | None = None,
) -> Alert | None:
    """Return the currently-open (unresolved) alert for this key, or None."""
    q = (
        db.query(Alert)
        .filter(
            Alert.device_id == device_id,
            Alert.type == alert_type,
            Alert.resolved_at.is_(None),
        )
    )
    if cell_number is not None:
        q = q.filter(Alert.cell_number == cell_number)
    else:
        q = q.filter(Alert.cell_number.is_(None))
    return q.first()


def _open_alert_for_type(db: Session, device_id: int, alert_type: AlertType) -> Alert | None:
    return _open_alert(db, device_id, alert_type, cell_number=None)


def _check_and_manage(
    db: Session,
    device_id: int,
    telemetry_id: int,
    alert_type: AlertType,
    severity: AlertSeverity,
    message: str,
    value: float | None,
    threshold: float | None,
    is_violation: bool,
    cell_number: int | None = None,
) -> tuple[Alert | None, Alert | None]:
    """
    Returns (new_alert | None, resolved_alert | None).
    Exactly one of the two will be non-None (or both None if no state change).
    """
    existing = _open_alert(db, device_id, alert_type, cell_number)

    if is_violation and existing is None:
        # New violation — open an alert
        alert = Alert(
            device_id=device_id,
            telemetry_id=telemetry_id,
            type=alert_type,
            severity=severity,
            cell_number=cell_number,
            message=message,
            value=value,
            threshold=threshold,
            triggered_at=datetime.datetime.utcnow(),
        )
        db.add(alert)
        db.flush()   # get the id without committing
        return alert, None

    elif not is_violation and existing is not None:
        # Condition cleared — resolve the alert
        existing.resolved_at = datetime.datetime.utcnow()
        db.flush()
        return None, existing

    return None, None   # No state change


def ingest_telemetry_row(
    db: Session,
    device: Device,
    sample_time: datetime.datetime,
    fields: dict[str, Any],
    cell_readings_data: list[dict],   # [{"cell_number": N, "voltage_mv": V, "temperature_c": T}]
    source: TelemetrySource = TelemetrySource.simulator,
) -> tuple[Telemetry, list[Alert], list[Alert]]:
    """
    Insert one Telemetry row + its CellReading rows, bump device.last_seen_at,
    run threshold checks, and return:
      (telemetry_row, new_alerts, resolved_alerts)

    Does NOT commit — the caller should commit after handling the WS broadcast
    so that a failed broadcast doesn't leave the DB in an inconsistent state.

    Parameters
    ----------
    db               : Active SQLAlchemy session.
    device           : ORM Device instance (will be mutated: last_seen_at).
    sample_time      : The real device/CSV timestamp for this row.
    fields           : Dict of pack-level values (keys match Telemetry columns).
    cell_readings_data : List of per-cell dicts.
    source           : TelemetrySource enum value.
    """
    # ── 1. Build Telemetry row ─────────────────────────────────────────────
    trow = Telemetry(
        device_id        = device.id,
        sample_time      = sample_time,
        source           = source,
        pack_voltage     = fields.get("pack_voltage"),
        pack_current     = fields.get("pack_current"),
        soc              = fields.get("soc"),
        soh              = fields.get("soh"),
        avg_cell_voltage = fields.get("avg_cell_voltage"),
        avg_cell_temp    = fields.get("avg_cell_temp"),
        internal_temp    = fields.get("internal_temp"),
        fet_temp         = fields.get("fet_temp"),
        max_cell_voltage          = fields.get("max_cell_voltage"),
        max_cell_voltage_cell_num = fields.get("max_cell_voltage_cell_num"),
        min_cell_voltage          = fields.get("min_cell_voltage"),
        min_cell_voltage_cell_num = fields.get("min_cell_voltage_cell_num"),
        max_thermistor_temp       = fields.get("max_thermistor_temp"),
        max_thermistor_num        = fields.get("max_thermistor_num"),
        min_thermistor_temp       = fields.get("min_thermistor_temp"),
        min_thermistor_num        = fields.get("min_thermistor_num"),
        latitude         = fields.get("latitude"),
        longitude        = fields.get("longitude"),
    )
    db.add(trow)
    db.flush()   # populate trow.id before inserting child rows

    # ── 2. Insert CellReading rows ─────────────────────────────────────────
    for cr in cell_readings_data:
        db.add(CellReading(
            telemetry_id  = trow.id,
            cell_number   = cr["cell_number"],
            voltage_mv    = cr.get("voltage_mv"),
            temperature_c = cr.get("temperature_c"),
        ))

    # ── 3. Bump device.last_seen_at ────────────────────────────────────────
    device.last_seen_at = datetime.datetime.utcnow()

    # ── 4. Threshold checks ────────────────────────────────────────────────
    T = THRESHOLDS
    new_alerts:      list[Alert] = []
    resolved_alerts: list[Alert] = []

    def _track(new_a, res_a):
        if new_a:      new_alerts.append(new_a)
        if res_a: resolved_alerts.append(res_a)

    # Pack-level: high voltage
    pack_v = fields.get("pack_voltage")
    if pack_v is not None:
        n, r = _check_and_manage(
            db, device.id, trow.id,
            AlertType.high_voltage, AlertSeverity.critical,
            f"Pack voltage {pack_v:.2f}V exceeds {T['high_pack_voltage_v']}V limit",
            pack_v, T["high_pack_voltage_v"],
            pack_v > T["high_pack_voltage_v"],
        )
        _track(n, r)

    # Pack-level: low SOC
    soc = fields.get("soc")
    if soc is not None:
        n, r = _check_and_manage(
            db, device.id, trow.id,
            AlertType.low_soc, AlertSeverity.warning,
            f"SOC {soc:.1f}% below {T['low_soc_pct']}% threshold",
            soc, T["low_soc_pct"],
            soc < T["low_soc_pct"],
        )
        _track(n, r)

    # Pack-level: overcurrent
    current = fields.get("pack_current")
    if current is not None:
        n, r = _check_and_manage(
            db, device.id, trow.id,
            AlertType.overcurrent, AlertSeverity.critical,
            f"Pack current |{current:.1f}A| exceeds {T['overcurrent_a']}A limit",
            abs(current), T["overcurrent_a"],
            abs(current) > T["overcurrent_a"],
        )
        _track(n, r)

    # Pack-level: high temperature
    avg_temp = fields.get("avg_cell_temp")
    if avg_temp is not None:
        n, r = _check_and_manage(
            db, device.id, trow.id,
            AlertType.high_temp, AlertSeverity.critical,
            f"Average cell temperature {avg_temp:.1f}°C exceeds {T['high_temp_c']}°C limit",
            avg_temp, T["high_temp_c"],
            avg_temp > T["high_temp_c"],
        )
        _track(n, r)

    # Cell imbalance (spread between max and min cell voltage)
    max_cv = fields.get("max_cell_voltage")
    min_cv = fields.get("min_cell_voltage")
    if max_cv is not None and min_cv is not None:
        spread_mv = (max_cv - min_cv) * 1000
        n, r = _check_and_manage(
            db, device.id, trow.id,
            AlertType.cell_imbalance, AlertSeverity.warning,
            f"Cell voltage spread {spread_mv:.0f}mV exceeds {T['cell_imbalance_mv']}mV threshold",
            spread_mv, T["cell_imbalance_mv"],
            spread_mv > T["cell_imbalance_mv"],
        )
        _track(n, r)

    # Per-cell: over/under voltage
    for cr in cell_readings_data:
        cell_n = cr["cell_number"]
        v_mv   = cr.get("voltage_mv")
        if v_mv is None:
            continue
        v = _mv_to_v(v_mv)

        # Over-voltage
        n, r = _check_and_manage(
            db, device.id, trow.id,
            AlertType.high_voltage, AlertSeverity.critical,
            f"Cell {cell_n} voltage {v_mv:.0f}mV exceeds {T['high_voltage_v']*1000:.0f}mV limit",
            v_mv, T["high_voltage_v"] * 1000,
            v > T["high_voltage_v"],
            cell_number=cell_n,
        )
        _track(n, r)

        # Under-voltage
        n, r = _check_and_manage(
            db, device.id, trow.id,
            AlertType.low_voltage, AlertSeverity.critical,
            f"Cell {cell_n} voltage {v_mv:.0f}mV below {T['low_voltage_v']*1000:.0f}mV limit",
            v_mv, T["low_voltage_v"] * 1000,
            v < T["low_voltage_v"],
            cell_number=cell_n,
        )
        _track(n, r)

    # ── 5. Return — caller commits ─────────────────────────────────────────
    return trow, new_alerts, resolved_alerts
