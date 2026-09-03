"""
Shared authentication and authorization dependencies.

All route handlers that need auth import from here — never directly from jwt.
"""
import datetime
import logging

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models import Device, DeviceAssignment, User, UserRole

log = logging.getLogger(__name__)

bearer_scheme = HTTPBearer(auto_error=False)

# ── Password helpers ──────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


# ── JWT helpers ───────────────────────────────────────────────────────────────

def create_access_token(user: User) -> str:
    expire = datetime.datetime.utcnow() + datetime.timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "sub"  : str(user.id),
        "email": user.email,
        "role" : user.role.value,
        "name" : user.full_name,
        "exp"  : expire,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])


# ── FastAPI dependencies ──────────────────────────────────────────────────────

def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Validate Bearer token and return the live DB User row.
    Re-fetches from DB on every request so a deactivated/role-changed account
    is caught immediately (not just at token expiry).
    """
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise exc
    try:
        payload = decode_token(credentials.credentials)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.PyJWTError:
        raise exc

    user_id = int(payload.get("sub", 0))
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if user is None:
        raise exc
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def get_scoped_device(device_id: int, current_user: User, db: Session) -> Device:
    """
    Return Device if it exists AND the current user is allowed to see it.
    Returns 404 in both the "doesn't exist" and "not authorised" cases —
    intentionally indistinguishable (security by opacity).
    """
    device = db.query(Device).filter(Device.id == device_id).first()
    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")

    if current_user.role == UserRole.admin:
        return device   # admin sees everything

    # user: must have an assignment
    assignment = (
        db.query(DeviceAssignment)
        .filter(
            DeviceAssignment.device_id == device_id,
            DeviceAssignment.user_id   == current_user.id,
        )
        .first()
    )
    if assignment is None:
        raise HTTPException(status_code=404, detail="Device not found")
    return device


def get_user_device_ids(user: User, db: Session) -> list[int]:
    """Return the list of device IDs this user is assigned to."""
    if user.role == UserRole.admin:
        return []  # admin sees all — empty list convention used in ConnectionManager
    rows = db.query(DeviceAssignment.device_id).filter(DeviceAssignment.user_id == user.id).all()
    return [r.device_id for r in rows]
