"""Auth router — login and current-user profile."""
import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User, UserRole
from routers import (
    create_access_token, get_current_user, get_user_device_ids, to_utc_iso, verify_password
)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user: User | None = db.query(User).filter(
        User.email == body.email.lower().strip(),
        User.is_active == True,
    ).first()

    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Record login time
    user.last_login_at = datetime.datetime.utcnow()
    db.commit()

    token = create_access_token(user)
    device_ids = get_user_device_ids(user, db)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id"        : user.id,
            "email"     : user.email,
            "full_name" : user.full_name,
            "role"      : user.role.value,
            "device_ids": device_ids,
        },
    }


@router.get("/me")
def me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    device_ids = get_user_device_ids(current_user, db)
    return {
        "id"           : current_user.id,
        "email"        : current_user.email,
        "full_name"    : current_user.full_name,
        "role"         : current_user.role.value,
        "is_active"    : current_user.is_active,
        "created_at"   : to_utc_iso(current_user.created_at),
        "last_login_at": to_utc_iso(current_user.last_login_at),
        "device_ids"   : device_ids,
    }
