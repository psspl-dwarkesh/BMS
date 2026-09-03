"""
Device telemetry simulator.

Runs as an in-process asyncio background task started from FastAPI's
lifespan context manager.  Gated by SIMULATOR_ENABLED env flag.

Architecture
------------
- One asyncio coroutine per SIMULATED device (started at app startup).
- Each tick writes through ingest_telemetry_row() in a thread-pool executor
  (SQLAlchemy is synchronous; run_in_executor keeps the asyncio loop free).
- Broadcasts TELEMETRY_UPDATE and ALERT messages over the shared WebSocket
  manager after each successful ingest.

Physics model
-------------
Modeled loosely on references/LiionPro-DT/lithium_battery_dataset_generator.py
OCV/IR/joule-heat approach:

  OCV(SOC)  : piecewise-linear approximation of a Li-ion OCV curve
  V_pack    : OCV(SOC) * cell_count  -  I * R_internal  + jitter
  V_cell_n  : V_pack / cell_count  +  persistent_bias[n]  +  jitter
  T_cell_n  : T_ambient  +  k_joule * I²  +  temp_bias[n]  +  jitter
  lat/lng   : mean-reverting random walk around device home coordinate

Honest labeling
---------------
- Startup log: "Simulator: ENABLED — writing synthetic telemetry for N devices (source=simulator)"
- Every Telemetry row has source='simulator'.
- The source field is queryable and surfaced in the frontend's History table.
"""
import asyncio
import datetime
import logging
import math
import random

from sqlalchemy.orm import Session

from database import SessionLocal
from models import Device, ConnectionType, TelemetrySource
from ingestion import ingest_telemetry_row
from ws_manager import manager

log = logging.getLogger(__name__)

# ── Physics constants ────────────────────────────────────────────────────────

R_INTERNAL    = 0.05     # Ohm — approximate pack internal resistance
K_JOULE       = 0.008    # °C per A²  — joule heating coefficient
T_AMBIENT     = 25.0     # °C baseline
RATED_CAP_AH  = 50.0     # Ah  — nominal pack capacity for SOC random-walk

# OCV curve: list of (SOC%, V/cell) breakpoints — simple 4-point Li-ion approx
OCV_CURVE = [
    (0,   3.00),
    (20,  3.50),
    (80,  3.90),
    (100, 4.15),
]


def _ocv_from_soc(soc_pct: float) -> float:
    """Interpolate OCV (V/cell) from SOC% using piecewise linear curve."""
    for i in range(len(OCV_CURVE) - 1):
        s0, v0 = OCV_CURVE[i]
        s1, v1 = OCV_CURVE[i + 1]
        if s0 <= soc_pct <= s1:
            t = (soc_pct - s0) / (s1 - s0)
            return v0 + t * (v1 - v0)
    return OCV_CURVE[-1][1] if soc_pct >= 100 else OCV_CURVE[0][1]


# ── Fault injection ──────────────────────────────────────────────────────────

class FaultState:
    """Tracks an active transient fault — lasts for a random number of ticks."""
    def __init__(self, fault_type: str, magnitude: float, duration_ticks: int):
        self.fault_type     = fault_type
        self.magnitude      = magnitude
        self.remaining      = duration_ticks


# ── Per-device simulator coroutine ───────────────────────────────────────────

async def _simulate_device(device_id: int, cell_count: int, thermistor_count: int,
                            home_lat: float, home_lng: float,
                            tick_seconds: float) -> None:
    """
    Runs forever until cancelled.  Each tick generates one telemetry snapshot
    and writes it through the shared ingestion pipeline.
    """
    log.info("Simulator: starting coroutine for device_id=%d (%d cells)", device_id, cell_count)

    # ── Persistent per-cell biases (seeded by device_id for reproducibility) ─
    rng = random.Random(device_id * 31337)
    # Cell voltage bias: most cells ±5mV, 1-2 cells biased lower by up to -40mV
    cell_v_bias = [rng.uniform(-0.005, 0.005) for _ in range(cell_count)]
    weak_cells  = rng.sample(range(cell_count), k=min(2, cell_count))
    for wc in weak_cells:
        cell_v_bias[wc] -= rng.uniform(0.020, 0.045)   # persistently weaker

    # Thermistor bias: ±3°C
    therm_bias = [rng.gauss(0, 1.5) for _ in range(thermistor_count)]

    # ── Mutable state ─────────────────────────────────────────────────────────
    soc        = rng.uniform(40.0, 90.0)   # start somewhere in the middle
    charging   = soc < 50.0
    lat        = home_lat + rng.uniform(-0.001, 0.001)
    lng        = home_lng + rng.uniform(-0.001, 0.001)
    active_fault: FaultState | None = None

    loop = asyncio.get_event_loop()

    while True:
        jitter = rng.uniform(-tick_seconds * 0.1, tick_seconds * 0.1)
        await asyncio.sleep(max(1.0, tick_seconds + jitter))

        # ── SOC random-walk ───────────────────────────────────────────────
        rate = rng.uniform(0.08, 0.18)   # % per tick
        if charging:
            soc = min(100.0, soc + rate)
            if soc >= 98.0:
                charging = False
        else:
            soc = max(5.0, soc - rate)
            if soc <= 12.0:
                charging = True

        # ── Fault injection (~1% chance per tick) ─────────────────────────
        if active_fault is None and rng.random() < 0.01:
            fault_choices = ["cell_overvolt", "cell_undervolt", "high_temp", "overcurrent"]
            ft = rng.choice(fault_choices)
            active_fault = FaultState(ft, 1.0, rng.randint(20, 80))
            log.debug("Simulator: injecting fault '%s' on device %d for %d ticks",
                      ft, device_id, active_fault.remaining)

        if active_fault is not None:
            active_fault.remaining -= 1
            if active_fault.remaining <= 0:
                active_fault = None

        # ── Current (A) ───────────────────────────────────────────────────
        base_current = rng.uniform(8, 25)
        if active_fault and active_fault.fault_type == "overcurrent":
            current = 105.0 + rng.uniform(0, 10)
        elif charging:
            current = +base_current
        else:
            current = -base_current

        # ── Pack voltage ──────────────────────────────────────────────────
        ocv_cell = _ocv_from_soc(soc)
        v_drop   = current * R_INTERNAL / cell_count  # per-cell drop
        pack_v   = (ocv_cell - v_drop) * cell_count + rng.gauss(0, 0.05)
        if active_fault and active_fault.fault_type == "cell_overvolt":
            pack_v += 2.0

        # ── Per-cell voltages ─────────────────────────────────────────────
        v_cell_base = pack_v / cell_count
        cell_voltages_v = []
        for i in range(cell_count):
            bias = cell_v_bias[i]
            if active_fault and active_fault.fault_type == "cell_overvolt" and i == 0:
                bias += 0.15
            if active_fault and active_fault.fault_type == "cell_undervolt" and i in weak_cells:
                bias -= 0.30
            cv = v_cell_base + bias + rng.gauss(0, 0.002)
            cell_voltages_v.append(max(2.5, min(4.5, cv)))

        max_cv_idx = max(range(cell_count), key=lambda i: cell_voltages_v[i])
        min_cv_idx = min(range(cell_count), key=lambda i: cell_voltages_v[i])
        max_cv = cell_voltages_v[max_cv_idx]
        min_cv = cell_voltages_v[min_cv_idx]
        avg_cv = sum(cell_voltages_v) / cell_count

        # ── Temperatures ──────────────────────────────────────────────────
        joule_heat = K_JOULE * (current ** 2)
        cell_temps = []
        for i in range(cell_count):
            t = T_AMBIENT + joule_heat + cell_v_bias[i] * -2 + rng.gauss(0, 0.5)
            if active_fault and active_fault.fault_type == "high_temp":
                t += 15.0
            cell_temps.append(t)
        avg_temp = sum(cell_temps) / cell_count

        # Thermistor readings (sampled from cell temps, positional)
        therm_temps = []
        for j in range(thermistor_count):
            idx = int(j * cell_count / thermistor_count)
            tt  = cell_temps[idx] + therm_bias[j] + rng.gauss(0, 0.3)
            therm_temps.append(tt)
        max_t_idx = max(range(thermistor_count), key=lambda i: therm_temps[i])
        min_t_idx = min(range(thermistor_count), key=lambda i: therm_temps[i])

        # Internal / FET temperatures
        internal_temp = avg_temp + rng.gauss(2.0, 0.5)
        fet_temp      = avg_temp + rng.gauss(4.0, 0.8)

        # SOH: slowly degrades over time (cosmetic — no real cycle count here)
        soh = max(70.0, 98.0 - rng.gauss(0, 0.3))

        # ── Location random walk ──────────────────────────────────────────
        lat += rng.gauss(0, 0.0001) + (home_lat - lat) * 0.01
        lng += rng.gauss(0, 0.0001) + (home_lng - lng) * 0.01

        # ── Build payload dicts ───────────────────────────────────────────
        fields = {
            "pack_voltage"              : round(pack_v, 3),
            "pack_current"              : round(current if not charging else current, 3),
            "soc"                       : round(soc, 2),
            "soh"                       : round(soh, 2),
            "avg_cell_voltage"          : round(avg_cv, 4),
            "avg_cell_temp"             : round(avg_temp, 2),
            "internal_temp"             : round(internal_temp, 2),
            "fet_temp"                  : round(fet_temp, 2),
            "max_cell_voltage"          : round(max_cv, 4),
            "max_cell_voltage_cell_num" : max_cv_idx + 1,
            "min_cell_voltage"          : round(min_cv, 4),
            "min_cell_voltage_cell_num" : min_cv_idx + 1,
            "max_thermistor_temp"       : round(therm_temps[max_t_idx], 2),
            "max_thermistor_num"        : max_t_idx + 1,
            "min_thermistor_temp"       : round(therm_temps[min_t_idx], 2),
            "min_thermistor_num"        : min_t_idx + 1,
            "latitude"                  : round(lat, 6),
            "longitude"                 : round(lng, 6),
        }

        cell_readings_data = [
            {
                "cell_number" : i + 1,
                "voltage_mv"  : round(cell_voltages_v[i] * 1000, 1),
                "temperature_c": round(cell_temps[i], 2),
            }
            for i in range(cell_count)
        ]

        # ── Write to DB (in executor — SQLite is synchronous) ─────────────
        try:
            trow, new_alerts, resolved_alerts = await loop.run_in_executor(
                None,
                _ingest_sync,
                device_id,
                datetime.datetime.utcnow(),
                fields,
                cell_readings_data,
            )
        except Exception as exc:
            log.error("Simulator: ingest error for device %d: %s", device_id, exc)
            continue

        # ── Broadcast over WebSocket ──────────────────────────────────────
        snapshot = {**fields, "id": trow.id, "sample_time": trow.sample_time.isoformat()}

        await manager.broadcast_to_scoped(
            {"type": "TELEMETRY_UPDATE", "device_id": device_id, "snapshot": snapshot},
            device_id=device_id,
        )

        for alert in new_alerts:
            await manager.broadcast_to_scoped(
                {
                    "type"      : "ALERT",
                    "device_id" : device_id,
                    "alert_id"  : alert.id,
                    "alert_type": alert.type.value,
                    "severity"  : alert.severity.value,
                    "message"   : alert.message,
                    "value"     : alert.value,
                    "triggered_at": alert.triggered_at.isoformat(),
                },
                device_id=device_id,
            )

        for alert in resolved_alerts:
            await manager.broadcast_to_scoped(
                {
                    "type"       : "ALERT_RESOLVED",
                    "device_id"  : device_id,
                    "alert_id"   : alert.id,
                    "alert_type" : alert.type.value,
                    "resolved_at": alert.resolved_at.isoformat(),
                },
                device_id=device_id,
            )


def _ingest_sync(
    device_id: int,
    sample_time: datetime.datetime,
    fields: dict,
    cell_readings_data: list,
):
    """Synchronous wrapper called via run_in_executor."""
    db: Session = SessionLocal()
    try:
        device = db.query(Device).filter(Device.id == device_id).first()
        if device is None:
            raise RuntimeError(f"Device {device_id} not found")
        trow, new_alerts, resolved_alerts = ingest_telemetry_row(
            db, device, sample_time, fields, cell_readings_data, TelemetrySource.simulator
        )
        db.commit()
        # Refresh so callers can read auto-set attributes like trow.id
        db.refresh(trow)
        for a in new_alerts + resolved_alerts:
            db.refresh(a)
        return trow, new_alerts, resolved_alerts
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


# ── Public API ───────────────────────────────────────────────────────────────

_tasks: list[asyncio.Task] = []


async def start_simulator(tick_seconds: float = 5.0) -> None:
    """
    Query all SIMULATED devices and spawn one coroutine per device.
    Called from FastAPI lifespan on startup.
    """
    db: Session = SessionLocal()
    try:
        devices = (
            db.query(Device)
            .filter(Device.connection_type == ConnectionType.SIMULATED)
            .all()
        )
    finally:
        db.close()

    if not devices:
        log.info("Simulator: ENABLED but no SIMULATED devices found — nothing to do.")
        return

    log.info(
        "Simulator: ENABLED — writing synthetic telemetry for %d device(s) "
        "(source=simulator, tick=%.1fs)",
        len(devices), tick_seconds,
    )

    for dev in devices:
        home_lat = dev.home_latitude  or 12.9716
        home_lng = dev.home_longitude or 77.5946
        task = asyncio.create_task(
            _simulate_device(
                device_id       = dev.id,
                cell_count      = dev.cell_count,
                thermistor_count = dev.thermistor_count,
                home_lat        = home_lat,
                home_lng        = home_lng,
                tick_seconds    = tick_seconds,
            ),
            name=f"sim-device-{dev.id}",
        )
        _tasks.append(task)


async def stop_simulator() -> None:
    """Cancel all simulator tasks. Called from FastAPI lifespan on shutdown."""
    for task in _tasks:
        task.cancel()
    if _tasks:
        await asyncio.gather(*_tasks, return_exceptions=True)
    _tasks.clear()
    log.info("Simulator: stopped.")
