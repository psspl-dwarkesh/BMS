"""Alerts router — fetch and acknowledge alerts."""
import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Alert, DeviceAssignment, User, UserRole
from routers import get_current_user

router = APIRouter(prefix="/api/v1/alerts", tags=["alerts"])


def _alert_to_dict(a: Alert) -> dict:
    return {
        "id"             : a.id,
        "device_id"      : a.device_id,
        "device_name"    : a.device.pack_name if a.device else None,
        "telemetry_id"   : a.telemetry_id,
        "type"           : a.type.value,
        "severity"       : a.severity.value,
        "cell_number"    : a.cell_number,
        "message"        : a.message,
        "value"          : a.value,
        "threshold"      : a.threshold,
        "triggered_at"   : a.triggered_at.isoformat(),
        "resolved_at"    : a.resolved_at.isoformat() if a.resolved_at else None,
        "acknowledged_at": a.acknowledged_at.isoformat() if a.acknowledged_at else None,
    }


@router.get("/")
def list_alerts(
    device_id: int | None = None,
    status: str | None = None,     # open, resolved, acknowledged
    severity: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List alerts.
    Admin sees all alerts (or filtered by device_id).
    User sees only alerts for their assigned devices.
    """
    q = db.query(Alert)

    # 1. Role scoping
    if current_user.role != UserRole.admin:
        assigned_ids = [
            row.device_id for row in db.query(DeviceAssignment.device_id)
            .filter(DeviceAssignment.user_id == current_user.id).all()
        ]
        if device_id:
            if device_id not in assigned_ids:
                return []  # requesting a device they don't own -> empty list
            q = q.filter(Alert.device_id == device_id)
        else:
            q = q.filter(Alert.device_id.in_(assigned_ids))
    else:
        if device_id:
            q = q.filter(Alert.device_id == device_id)

    # 2. Status filter
    if status == "open":
        q = q.filter(Alert.resolved_at.is_(None))
    elif status == "resolved":
        q = q.filter(Alert.resolved_at.isnot(None))
    elif status == "acknowledged":
        q = q.filter(Alert.acknowledged_at.isnot(None))

    # 3. Severity filter
    if severity:
        q = q.filter(Alert.severity == severity)

    rows = q.order_by(Alert.triggered_at.desc()).all()
    return [_alert_to_dict(r) for r in rows]


@router.post("/{alert_id}/acknowledge")
def acknowledge_alert(
    alert_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    # Authorize
    if current_user.role != UserRole.admin:
        assignment = (
            db.query(DeviceAssignment)
            .filter(DeviceAssignment.device_id == alert.device_id, DeviceAssignment.user_id == current_user.id)
            .first()
        )
        if not assignment:
            raise HTTPException(status_code=404, detail="Alert not found")

    if not alert.acknowledged_at:
        alert.acknowledged_at = datetime.datetime.utcnow()
        alert.acknowledged_by_user_id = current_user.id
        db.commit()
        db.refresh(alert)

    return _alert_to_dict(alert)
