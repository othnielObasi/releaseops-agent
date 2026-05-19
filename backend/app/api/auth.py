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

LOCAL_ACCOUNT_DOMAIN = "local.releaseops"


def _normalize_simple_name(name: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", (name or "").lower().strip()).strip("-")
    if not cleaned or len(cleaned) < 2:
        raise HTTPException(status_code=400, detail="Name must contain at least two letters or numbers.")
    return cleaned[:64]


def _account_key_from_name(name: str) -> str:
    return f"{_normalize_simple_name(name)}@{LOCAL_ACCOUNT_DOMAIN}"


def _resolve_account_key(identifier: str, users: dict) -> str:
    ident = (identifier or "").strip()
    if not ident:
        raise HTTPException(status_code=400, detail="Name is required.")
    if "@" in ident:
        return ident.lower()
    simple_key = _account_key_from_name(ident)
    if simple_key in users:
        return simple_key
    matches = [
        email for email, user in users.items()
        if (user.get("name") or "").strip().lower() == ident.lower()
    ]
    if len(matches) == 1:
        return matches[0]
    if len(matches) > 1:
        raise HTTPException(status_code=409, detail="That name is ambiguous. Sign in with the account email.")
    return simple_key


@router.post("/signup")
async def signup(body: SignupRequest, request: Request):
    users = load_users()
    display_name = body.name.strip()
    email = body.email.lower().strip() if body.email else _account_key_from_name(display_name)
    if email in users:
        raise HTTPException(status_code=409, detail="An account with this name already exists.")
    if not body.email:
        name_taken = any(
            (user.get("name") or "").strip().lower() == display_name.lower()
            for user in users.values()
        )
        if name_taken:
            raise HTTPException(status_code=409, detail="An account with this name already exists.")
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
    identifier = body.identifier or body.name or body.email
    email = _resolve_account_key(identifier, users)
    ip = request.client.host if request.client else "unknown"
    ua = request.headers.get("user-agent", "")
    user = users.get(email)
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        record_login_event(email, ip, ua, success=False, reason="invalid_credentials")
        raise HTTPException(status_code=401, detail="Invalid name or password.")
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
