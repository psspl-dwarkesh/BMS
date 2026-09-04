"""Users router — admin provisions and manages user accounts."""
import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Device, DeviceAssignment, User, UserRole
from routers import get_current_user, hash_password, require_admin, to_utc_iso

router = APIRouter(prefix="/api/v1/users", tags=["users"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class CreateUserRequest(BaseModel):
    email: str
    password: str
    full_name: str
    role: str = "user"


class SetPasswordRequest(BaseModel):
    new_password: str


class AssignDeviceRequest(BaseModel):
    device_id: int


# ── Helpers ───────────────────────────────────────────────────────────────────

def _user_to_dict(user: User, device_ids: list[int]) -> dict:
    return {
        "id"           : user.id,
        "email"        : user.email,
        "full_name"    : user.full_name,
        "role"         : user.role.value,
        "is_active"    : user.is_active,
        "created_at"   : to_utc_iso(user.created_at),
        "last_login_at": to_utc_iso(user.last_login_at),
        "device_ids"   : device_ids,
    }


def _device_ids_by_user(db: Session, user_ids: list[int]) -> dict[int, list[int]]:
    """Batch-fetch assigned device_ids for a list of users in one query (avoids N+1)."""
    if not user_ids:
        return {}
    by_user: dict[int, list[int]] = {uid: [] for uid in user_ids}
    rows = (
        db.query(DeviceAssignment.user_id, DeviceAssignment.device_id)
        .filter(DeviceAssignment.user_id.in_(user_ids))
        .all()
    )
    for user_id, device_id in rows:
        by_user[user_id].append(device_id)
    return by_user


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/")
def list_users(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    users = db.query(User).order_by(User.created_at.desc()).all()
    device_ids_by_user = _device_ids_by_user(db, [u.id for u in users])
    return [_user_to_dict(u, device_ids_by_user.get(u.id, [])) for u in users]


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_user(
    body: CreateUserRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if db.query(User).filter(User.email == body.email.lower().strip()).first():
        raise HTTPException(status_code=409, detail="Email already registered")

    try:
        role = UserRole(body.role)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid role: {body.role}")

    user = User(
        email           = body.email.lower().strip(),
        hashed_password = hash_password(body.password),
        full_name       = body.full_name,
        role            = role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _user_to_dict(user, [])


@router.patch("/{user_id}/activate")
def set_active(
    user_id: int,
    is_active: bool,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = is_active
    db.commit()
    return {"ok": True}


@router.post("/{user_id}/set-password")
def set_password(
    user_id: int,
    body: SetPasswordRequest,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin-driven password reset (no email flow — admin sets a temp password)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.hashed_password = hash_password(body.new_password)
    db.commit()
    return {"ok": True}


@router.post("/{user_id}/device-assignments", status_code=status.HTTP_201_CREATED)
def assign_device(
    user_id: int,
    body: AssignDeviceRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user   = db.query(User).filter(User.id == user_id).first()
    device = db.query(Device).filter(Device.id == body.device_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    existing = (
        db.query(DeviceAssignment)
        .filter(DeviceAssignment.device_id == body.device_id, DeviceAssignment.user_id == user_id)
        .first()
    )
    if existing:
        return {"ok": True, "already_assigned": True}

    db.add(DeviceAssignment(
        device_id           = body.device_id,
        user_id             = user_id,
        assigned_by_user_id = admin.id,
    ))
    db.commit()
    return {"ok": True}


@router.delete("/{user_id}/device-assignments/{device_id}")
def unassign_device(
    user_id: int,
    device_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    row = (
        db.query(DeviceAssignment)
        .filter(DeviceAssignment.user_id == user_id, DeviceAssignment.device_id == device_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Assignment not found")
    db.delete(row)
    db.commit()
    return {"ok": True}
