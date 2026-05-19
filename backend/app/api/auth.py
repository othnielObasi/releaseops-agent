"""Auth routes — signup, login, profile, preferences."""
import re
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request, Depends

from app.deps import (
    Role, verify_token, load_users, save_users,
    hash_password, verify_password,
    record_login_event, create_token, audit, check_rate_limit, logger,
)
from app.models.schemas import SignupRequest, LoginRequest, NotifPrefs

router = APIRouter(prefix="/api/auth", tags=["auth"])

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _normalize_email(email: str) -> str:
    value = (email or "").lower().strip()
    if not value:
        raise HTTPException(status_code=400, detail="Email address is required.")
    if not EMAIL_RE.match(value):
        raise HTTPException(status_code=400, detail="Enter a valid email address.")
    return value


@router.post("/signup")
async def signup(body: SignupRequest, request: Request):
    users = load_users()
    display_name = body.name.strip()
    if not display_name:
        raise HTTPException(status_code=400, detail="Name is required.")
    email = _normalize_email(body.email)
    if email in users:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
    users[email] = {
        "name":          display_name,
        "email":         email,
        "password_hash": hash_password(body.password),
        "role":          Role.USER,
        "created_at":    datetime.now(timezone.utc).isoformat(),
        "last_seen":     datetime.now(timezone.utc).isoformat(),
        "notification_email": True,
    }
    save_users(users)
    ip = request.client.host if request.client else "unknown"
    ua = request.headers.get("user-agent", "")
    record_login_event(email, ip, ua, success=True, reason="signup")
    audit(email, "signup", ip=ip)
    token = create_token(email)
    return {"token": token, "name": users[email]["name"], "email": email, "role": users[email]["role"]}


@router.post("/login")
async def login(body: LoginRequest, request: Request):
    users = load_users()
    email = _normalize_email(body.email or body.identifier or "")
    ip = request.client.host if request.client else "unknown"
    ua = request.headers.get("user-agent", "")
    user = users.get(email)
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        record_login_event(email, ip, ua, success=False, reason="invalid_credentials")
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    record_login_event(email, ip, ua, success=True)
    user["last_seen"] = datetime.now(timezone.utc).isoformat()
    save_users(users)
    audit(email, "login", ip=ip)
    token = create_token(email, role=user.get("role", Role.USER))
    return {"token": token, "name": user.get("name", ""), "email": email, "role": user.get("role", Role.USER)}


@router.get("/me")
async def me(email: str = Depends(verify_token)):
    users = load_users()
    user = users.get(email, {})
    return {
        "email": email,
        "name": user.get("name", ""),
        "role": user.get("role", Role.USER),
        "created_at": user.get("created_at"),
        "last_seen": user.get("last_seen"),
        "notification_email": user.get("notification_email", True),
    }


@router.patch("/preferences")
async def update_preferences(body: NotifPrefs, email: str = Depends(verify_token)):
    users = load_users()
    if email not in users:
        raise HTTPException(status_code=404, detail="User not found")
    if body.notification_email is not None:
        users[email]["notification_email"] = body.notification_email
    save_users(users)
    return {"status": "updated"}
