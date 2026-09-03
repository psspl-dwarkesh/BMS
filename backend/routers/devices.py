"""Devices router — CRUD for device metadata, role-scoped listing."""
import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Chemistry, ConnectionType, Device, DeviceStatus, Telemetry, User, UserRole
from routers import get_current_user, get_scoped_device, require_admin

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

def _device_snapshot(device: Device, db: Session) -> dict:
    """Return device dict with the latest telemetry snapshot embedded."""
    latest = (
        db.query(Telemetry)
        .filter(Telemetry.device_id == device.id)
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
        "last_seen_at"     : device.last_seen_at.isoformat() if device.last_seen_at else None,
        "created_at"       : device.created_at.isoformat(),
        "latest_telemetry" : None,
    }
    if latest:
        d["latest_telemetry"] = {
            "id"          : latest.id,
            "sample_time" : latest.sample_time.isoformat(),
            "pack_voltage": latest.pack_voltage,
            "pack_current": latest.pack_current,
            "soc"         : latest.soc,
            "soh"         : latest.soh,
            "avg_cell_temp": latest.avg_cell_temp,
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

    return [_device_snapshot(d, db) for d in devices]


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
        if key == "chemistry":
            val = Chemistry(val)
        if key == "status":
            val = DeviceStatus(val)
        setattr(device, key, val)

    db.commit()
    db.refresh(device)
    return _device_snapshot(device, db)
