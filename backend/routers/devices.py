"""Devices router — CRUD for device metadata, role-scoped listing."""
import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from database import get_db
from models import Chemistry, ConnectionType, Device, DeviceStatus, Telemetry, TelemetryImport, User, UserRole
from routers import get_current_user, get_scoped_device, require_admin, to_utc_iso

router = APIRouter(prefix="/api/v1/devices", tags=["devices"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class CreateDeviceRequest(BaseModel):
    serial_number     : str
    pack_name         : str
    manufacturer      : str | None = None
    manufacture_date  : str | None = None
    chemistry         : str = "Li-ion"
    rated_voltage     : float | None = None
    rated_capacity_ah : float | None = None
    cell_count        : int = 16
    thermistor_count  : int = 4
    connection_type   : str = "SIMULATED"
    install_site      : str | None = None
    home_latitude     : float | None = None
    home_longitude    : float | None = None


class PatchDeviceRequest(BaseModel):
    pack_name         : str | None = None
    manufacturer      : str | None = None
    chemistry         : str | None = None
    rated_voltage     : float | None = None
    rated_capacity_ah : float | None = None
    install_site      : str | None = None
    status            : str | None = None
    home_latitude     : float | None = None
    home_longitude    : float | None = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _latest_telemetry_by_device(db: Session, device_ids: list[int]) -> dict[int, Telemetry]:
    """Fetch the single latest Telemetry row per device_id in one query.

    Used by list_devices to avoid an N+1 (one query per device) - a
    device_id/max(sample_time) subquery joined back onto Telemetry.
    """
    if not device_ids:
        return {}
    # Same "exclude hidden CSV batches" rule as _visible_telemetry_query in
    # telemetry.py - without it, the fleet-wide list (and the Fleet Map)
    # could show a device's status/position from data the user just toggled
    # off in its Upload History panel, while the device's own tabs (which do
    # filter) show something else entirely. Only the max(sample_time)
    # lookup needs the filter - the final join below matches on the
    # resulting (device_id, sample_time) pair, which is already guaranteed
    # to belong to a visible row.
    latest_per_device = (
        db.query(Telemetry.device_id, func.max(Telemetry.sample_time).label("max_time"))
        .outerjoin(TelemetryImport, Telemetry.import_id == TelemetryImport.id)
        .filter(
            Telemetry.device_id.in_(device_ids),
            or_(Telemetry.import_id.is_(None), TelemetryImport.included == True),
        )
        .group_by(Telemetry.device_id)
        .subquery()
    )
    rows = (
        db.query(Telemetry)
        .join(
            latest_per_device,
            (Telemetry.device_id == latest_per_device.c.device_id)
            & (Telemetry.sample_time == latest_per_device.c.max_time),
        )
        .all()
    )
    # Ties on sample_time for the same device are rare and either row is fine.
    return {t.device_id: t for t in rows}


def _device_snapshot(device: Device, db: Session, latest: Telemetry | None = "unset") -> dict:
    """Return device dict with the latest telemetry snapshot embedded.

    `latest` can be pre-fetched (e.g. via _latest_telemetry_by_device for a
    batch of devices) to avoid a per-device query; if left as the "unset"
    sentinel, it's looked up here for the single-device case.
    """
    if latest == "unset":
        # Same "exclude hidden CSV batches" rule as _latest_telemetry_by_device
        # above (used by list_devices) - this single-device path is the one
        # get_device()/create_device()/patch_device() hit, and was missing
        # the filter entirely, so a device's own detail fetch could still
        # show a batch the user had just toggled off in its Data Sources panel.
        latest = (
            db.query(Telemetry)
            .outerjoin(TelemetryImport, Telemetry.import_id == TelemetryImport.id)
            .filter(
                Telemetry.device_id == device.id,
                or_(Telemetry.import_id.is_(None), TelemetryImport.included == True),
            )
            .order_by(Telemetry.sample_time.desc())
            .first()
        )
    d = {
        "id"               : device.id,
        "serial_number"    : device.serial_number,
        "pack_name"        : device.pack_name,
        "manufacturer"     : device.manufacturer,
        "manufacture_date" : device.manufacture_date,
        "chemistry"        : device.chemistry.value if device.chemistry else None,
        "rated_voltage"    : device.rated_voltage,
        "rated_capacity_ah": device.rated_capacity_ah,
        "cell_count"       : device.cell_count,
        "thermistor_count" : device.thermistor_count,
        "connection_type"  : device.connection_type.value if device.connection_type else None,
        "install_site"     : device.install_site,
        "status"           : device.status.value if device.status else None,
        "last_seen_at"     : to_utc_iso(device.last_seen_at),
        "created_at"       : to_utc_iso(device.created_at),
        # Never exposed before - the create/patch schemas accept these and
        # the simulator's random-walk reads them, but no response ever sent
        # them back, so nothing (Device Registry's table, the Fleet Map)
        # could display or reuse a device's home coordinate.
        "home_latitude"    : device.home_latitude,
        "home_longitude"   : device.home_longitude,
        "latest_telemetry" : None,
    }
    if latest:
        d["latest_telemetry"] = {
            "id"          : latest.id,
            "sample_time" : to_utc_iso(latest.sample_time),
            "pack_voltage": latest.pack_voltage,
            "pack_current": latest.pack_current,
            "soc"         : latest.soc,
            "soh"         : latest.soh,
            "avg_cell_temp": latest.avg_cell_temp,
            "latitude"    : latest.latitude,
            "longitude"   : latest.longitude,
            "source"      : latest.source.value if latest.source else None,
        }
    return d


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("")
def list_devices(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role == UserRole.admin:
        devices = db.query(Device).order_by(Device.created_at.desc()).all()
    else:
        from models import DeviceAssignment
        device_ids = [
            row.device_id
            for row in db.query(DeviceAssignment.device_id)
            .filter(DeviceAssignment.user_id == current_user.id)
            .all()
        ]
        devices = db.query(Device).filter(Device.id.in_(device_ids)).all()

    latest_by_device = _latest_telemetry_by_device(db, [d.id for d in devices])
    return [_device_snapshot(d, db, latest_by_device.get(d.id)) for d in devices]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_device(
    body: CreateDeviceRequest,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if db.query(Device).filter(Device.serial_number == body.serial_number).first():
        raise HTTPException(status_code=409, detail="Serial number already registered")

    try:
        chem = Chemistry(body.chemistry)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid chemistry: {body.chemistry}")
    try:
        conn = ConnectionType(body.connection_type)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid connection_type: {body.connection_type}")

    device = Device(
        serial_number     = body.serial_number,
        pack_name         = body.pack_name,
        manufacturer      = body.manufacturer,
        manufacture_date  = body.manufacture_date,
        chemistry         = chem,
        rated_voltage     = body.rated_voltage,
        rated_capacity_ah = body.rated_capacity_ah,
        cell_count        = body.cell_count,
        thermistor_count  = body.thermistor_count,
        connection_type   = conn,
        install_site      = body.install_site,
        home_latitude     = body.home_latitude,
        home_longitude    = body.home_longitude,
    )
    db.add(device)
    db.commit()
    db.refresh(device)
    return _device_snapshot(device, db)


@router.get("/{device_id}")
def get_device(
    device_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    device = get_scoped_device(device_id, current_user, db)
    return _device_snapshot(device, db)


@router.patch("/{device_id}")
def patch_device(
    device_id: int,
    body: PatchDeviceRequest,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    updates = body.model_dump(exclude_none=True)
    for key, val in updates.items():
        try:
            if key == "chemistry":
                val = Chemistry(val)
            if key == "status":
                val = DeviceStatus(val)
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Invalid {key}: {val}")
        setattr(device, key, val)

    db.commit()
    db.refresh(device)
    return _device_snapshot(device, db)
