"""Location router — fetch historical GPS trace for a device."""
import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import Telemetry, User
from routers import get_current_user, get_scoped_device

router = APIRouter(prefix="/api/v1/devices/{device_id}/location", tags=["location"])


@router.get("/history")
def get_location_history(
    device_id: int,
    start: str | None = None,
    end: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns a list of {sample_time, latitude, longitude} points for the trace map.
    Only returns points where lat/lng are not null.
    """
    device = get_scoped_device(device_id, current_user, db)

    q = (
        db.query(Telemetry)
        .filter(
            Telemetry.device_id == device.id,
            Telemetry.latitude.isnot(None),
            Telemetry.longitude.isnot(None),
        )
    )

    if start:
        q = q.filter(Telemetry.sample_time >= datetime.datetime.fromisoformat(start.replace('Z', '+00:00')))
    if end:
        q = q.filter(Telemetry.sample_time <= datetime.datetime.fromisoformat(end.replace('Z', '+00:00')))

    # Unbounded before: omitting start/end returned the device's entire GPS
    # trace in one shot. Cap it, taking the most recent points (then
    # re-sorting ascending) rather than truncating from the oldest end.
    rows = q.order_by(Telemetry.sample_time.desc()).limit(2000).all()
    rows.reverse()

    return [
        {
            "sample_time": r.sample_time.isoformat(),
            "latitude": r.latitude,
            "longitude": r.longitude,
        }
        for r in rows
    ]
