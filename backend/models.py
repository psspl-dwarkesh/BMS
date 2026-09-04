"""
SQLAlchemy ORM models — clean-slate replacement.

Previous models (BatteryPack, PackTelemetry) are removed; this file
defines the full production schema.  The DB is empty so no migration is
needed for this change-set; add Alembic starting with the *next* schema
change.

Relationships use lazy="select" (default) to keep things simple.  Any
endpoint that needs to avoid N+1 queries should use joined-loads explicitly
(see devices.py / telemetry.py routers).
"""
import datetime
import enum

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, Float, ForeignKey,
    Index, Integer, String, UniqueConstraint,
)
from sqlalchemy.orm import relationship

from database import Base


# ── Enums ─────────────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    admin = "admin"
    user  = "user"


class Chemistry(str, enum.Enum):
    li_ion   = "Li-ion"
    lipo     = "LiPo"
    lifepo4  = "LiFePO4"


class ConnectionType(str, enum.Enum):
    BLE       = "BLE"
    WIFI      = "WIFI"
    CAN       = "CAN"
    GSM_GPRS  = "GSM_GPRS"
    SIMULATED = "SIMULATED"


class DeviceStatus(str, enum.Enum):
    active      = "active"
    inactive    = "inactive"
    maintenance = "maintenance"
    fault       = "fault"


class TelemetrySource(str, enum.Enum):
    simulator  = "simulator"
    csv_import = "csv_import"
    device     = "device"


class AlertType(str, enum.Enum):
    low_voltage       = "low_voltage"
    high_voltage      = "high_voltage"
    high_temp         = "high_temp"
    low_soc           = "low_soc"
    cell_imbalance    = "cell_imbalance"
    overcurrent       = "overcurrent"
    comm_lost         = "comm_lost"


class AlertSeverity(str, enum.Enum):
    info     = "info"
    warning  = "warning"
    critical = "critical"


# ── Helper ────────────────────────────────────────────────────────────────────

def _now() -> datetime.datetime:
    return datetime.datetime.utcnow()


# ── Models ────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id                = Column(Integer, primary_key=True, index=True)
    email             = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password   = Column(String(255), nullable=False)
    full_name         = Column(String(255), nullable=False)
    role              = Column(Enum(UserRole), nullable=False, default=UserRole.user)
    is_active         = Column(Boolean, default=True, nullable=False)
    created_at        = Column(DateTime, default=_now, nullable=False)
    last_login_at     = Column(DateTime, nullable=True)

    # Devices this user has been explicitly assigned to (many-to-many via assignment table)
    assignments = relationship("DeviceAssignment", foreign_keys="DeviceAssignment.user_id", back_populates="user")


class Device(Base):
    __tablename__ = "devices"

    id                  = Column(Integer, primary_key=True, index=True)
    serial_number       = Column(String(100), unique=True, index=True, nullable=False)
    pack_name           = Column(String(255), nullable=False)
    manufacturer        = Column(String(255), nullable=True)
    manufacture_date    = Column(String(32), nullable=True)   # ISO date string
    chemistry           = Column(Enum(Chemistry), nullable=True, default=Chemistry.li_ion)
    rated_voltage       = Column(Float, nullable=True)    # V
    rated_capacity_ah   = Column(Float, nullable=True)    # Ah
    cell_count          = Column(Integer, default=16, nullable=False)
    thermistor_count    = Column(Integer, default=4,  nullable=False)
    connection_type     = Column(Enum(ConnectionType), nullable=False, default=ConnectionType.SIMULATED)
    install_site        = Column(String(255), nullable=True)
    status              = Column(Enum(DeviceStatus), nullable=False, default=DeviceStatus.active)
    last_seen_at        = Column(DateTime, nullable=True)
    created_at          = Column(DateTime, default=_now, nullable=False)

    # Home coordinate for simulator random-walk
    home_latitude       = Column(Float, nullable=True)
    home_longitude      = Column(Float, nullable=True)

    telemetry   = relationship("Telemetry",        back_populates="device", cascade="all, delete-orphan")
    assignments = relationship("DeviceAssignment", back_populates="device", cascade="all, delete-orphan")
    alerts      = relationship("Alert",            back_populates="device", cascade="all, delete-orphan")


class DeviceAssignment(Base):
    """Controls which non-admin users can see which devices."""
    __tablename__ = "device_assignments"
    __table_args__ = (UniqueConstraint("device_id", "user_id"),)

    id                  = Column(Integer, primary_key=True, index=True)
    device_id           = Column(Integer, ForeignKey("devices.id",  ondelete="CASCADE"), nullable=False)
    user_id             = Column(Integer, ForeignKey("users.id",    ondelete="CASCADE"), nullable=False)
    assigned_at         = Column(DateTime, default=_now, nullable=False)
    assigned_by_user_id = Column(Integer, ForeignKey("users.id"),   nullable=True)

    device  = relationship("Device", back_populates="assignments")
    user    = relationship("User",   foreign_keys=[user_id], back_populates="assignments")


class Telemetry(Base):
    """One pack-level snapshot.  Per-cell detail lives in CellReading."""
    __tablename__ = "telemetry"
    __table_args__ = (
        Index("ix_telemetry_device_time", "device_id", "sample_time"),
    )

    id          = Column(Integer, primary_key=True, index=True)
    device_id   = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    # sample_time = the real device/CSV timestamp (NOT the DB-insert time).
    sample_time = Column(DateTime, nullable=False)
    ingested_at = Column(DateTime, default=_now, nullable=False)
    source      = Column(Enum(TelemetrySource), nullable=False, default=TelemetrySource.simulator)

    # ── Pack-level measurements ───────────────────────────────────────────────
    pack_voltage     = Column(Float, nullable=True)   # V
    pack_current     = Column(Float, nullable=True)   # A  (+ = charging, - = discharging)
    soc              = Column(Float, nullable=True)   # %
    soh              = Column(Float, nullable=True)   # %
    avg_cell_voltage = Column(Float, nullable=True)   # V
    avg_cell_temp    = Column(Float, nullable=True)   # °C
    internal_temp    = Column(Float, nullable=True)   # °C  (PCB / internal)
    fet_temp         = Column(Float, nullable=True)   # °C

    # ── Per-cell extremes (replicated here so history queries don't need a JOIN) ──
    max_cell_voltage         = Column(Float,   nullable=True)
    max_cell_voltage_cell_num = Column(Integer, nullable=True)
    min_cell_voltage         = Column(Float,   nullable=True)
    min_cell_voltage_cell_num = Column(Integer, nullable=True)

    max_thermistor_temp      = Column(Float,   nullable=True)
    max_thermistor_num       = Column(Integer, nullable=True)
    min_thermistor_temp      = Column(Float,   nullable=True)
    min_thermistor_num       = Column(Integer, nullable=True)

    # ── Location ──────────────────────────────────────────────────────────────
    latitude  = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    device      = relationship("Device",      back_populates="telemetry")
    cell_readings = relationship("CellReading", back_populates="telemetry", cascade="all, delete-orphan")
    alerts      = relationship("Alert",       back_populates="telemetry")


class CellReading(Base):
    """Per-cell voltage and temperature for one telemetry snapshot."""
    __tablename__ = "cell_readings"
    __table_args__ = (UniqueConstraint("telemetry_id", "cell_number"),)

    id          = Column(Integer, primary_key=True, index=True)
    telemetry_id = Column(Integer, ForeignKey("telemetry.id", ondelete="CASCADE"), nullable=False, index=True)
    cell_number = Column(Integer, nullable=False)     # 1-indexed
    voltage_mv  = Column(Float,   nullable=True)      # millivolts
    temperature_c = Column(Float, nullable=True)      # °C  (None if no thermistor on this cell)

    telemetry = relationship("Telemetry", back_populates="cell_readings")


class Alert(Base):
    """
    One open alert per (device, type[, cell_number]).
    Auto-resolved when the condition clears (resolved_at set by ingestion.py).
    Acknowledged independently by a user action.
    """
    __tablename__ = "alerts"
    __table_args__ = (
        Index("ix_alerts_device_triggered", "device_id", "triggered_at"),
        # Supports _open_alert()'s actual filter shape (device_id, type,
        # resolved_at[, cell_number]) - the hot-path query run on every
        # single ingested telemetry row (once per pack-level check, once per
        # cell), so it's worth its own index rather than relying on the
        # device_id/triggered_at one above, which doesn't cover this filter.
        Index("ix_alerts_device_type_resolved", "device_id", "type", "resolved_at"),
    )

    id                      = Column(Integer, primary_key=True, index=True)
    device_id               = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    # SET NULL rather than CASCADE/no-action: a resolved historical alert is
    # still meaningful on its own after the telemetry row that triggered it
    # is gone (e.g. a future retention/cleanup job purging old Telemetry
    # rows) - it just loses the direct link back to that sample.
    telemetry_id            = Column(Integer, ForeignKey("telemetry.id", ondelete="SET NULL"), nullable=True)

    type                    = Column(Enum(AlertType),     nullable=False)
    severity                = Column(Enum(AlertSeverity), nullable=False)
    cell_number             = Column(Integer, nullable=True)   # set for per-cell alerts

    message                 = Column(String(500), nullable=False)
    value                   = Column(Float,  nullable=True)     # the measured value that triggered it
    threshold               = Column(Float,  nullable=True)     # the threshold it breached

    triggered_at            = Column(DateTime, default=_now, nullable=False)
    resolved_at             = Column(DateTime, nullable=True)
    acknowledged_at         = Column(DateTime, nullable=True)
    acknowledged_by_user_id = Column(Integer,  ForeignKey("users.id"), nullable=True)

    device    = relationship("Device",    back_populates="alerts")
    telemetry = relationship("Telemetry", back_populates="alerts")
