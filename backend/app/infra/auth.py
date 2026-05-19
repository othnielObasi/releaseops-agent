"""
Authentication — JWT creation/verification, password hashing, user management.
"""
import json
import logging
import time as _time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.infra.config import (
    JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRE_HOURS,
    ADMIN_EMAIL, ADMIN_PASSWORD, USERS_FILE, LOGIN_HISTORY_FILE,
)

logger = logging.getLogger("ReleaseOps")

pwd_context   = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)


# ── Role constants ───────────────────────────────────────────────────────────
class Role:
    USER        = "user"
    SUPER_ADMIN = "super_admin"


# ── Generic JSON file I/O ────────────────────────────────────────────────────
def _load_json(filepath, default):
    try:
        if filepath.exists():
            return json.loads(filepath.read_text())
    except Exception:
        pass
    return default() if callable(default) else default


def _save_json(filepath, data):
    filepath.write_text(json.dumps(data, indent=2))


# ── User store with TTL cache ────────────────────────────────────────────────
_users_cache: Dict[str, Any] = {}
_users_cache_ts: float = 0.0
_USERS_CACHE_TTL = 30.0


def load_users() -> Dict[str, Any]:
    return _load_json(USERS_FILE, {})


def save_users(u: Dict[str, Any]):
    _save_json(USERS_FILE, u)
    _invalidate_users_cache()


def load_users_cached() -> Dict[str, Any]:
    global _users_cache, _users_cache_ts
    if _time.time() - _users_cache_ts < _USERS_CACHE_TTL:
        return _users_cache
    _users_cache    = _load_json(USERS_FILE, {})
    _users_cache_ts = _time.time()
    return _users_cache


def _invalidate_users_cache():
    global _users_cache_ts
    _users_cache_ts = 0.0


# ── Login history ────────────────────────────────────────────────────────────
def load_login_history() -> list:
    return _load_json(LOGIN_HISTORY_FILE, [])


def save_login_history(h: list):
    _save_json(LOGIN_HISTORY_FILE, h)


def record_login_event(email: str, ip: str, user_agent: str, success: bool, reason: str = ""):
    history = load_login_history()
    history.append({
        "email":      email,
        "timestamp":  datetime.now(timezone.utc).isoformat(),
        "ip":         ip,
        "user_agent": user_agent[:200],
        "success":    success,
        "reason":     reason,
    })
    save_login_history(history)


# ── JWT helpers ──────────────────────────────────────────────────────────────
def normalize_email(email: str) -> str:
    return email.lower().strip()


def create_token(email: str, role: str = Role.USER) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS)
    return jwt.encode(
        {"sub": email, "role": role, "exp": expire},
        JWT_SECRET, algorithm=JWT_ALGORITHM,
    )


def _decode_jwt_payload(credentials: HTTPAuthorizationCredentials) -> dict:
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        return jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    """FastAPI dependency: extract and validate user email from bearer token."""
    payload = _decode_jwt_payload(credentials)
    email: str = payload.get("sub")
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token")
    return email


def require_admin(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    """FastAPI dependency: verify SUPER_ADMIN role."""
    payload = _decode_jwt_payload(credentials)
    if payload.get("role") != Role.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Access denied — super admin only")
    return payload.get("sub")


# ── Bootstrap admin account ──────────────────────────────────────────────────
def bootstrap_admin():
    """Create or update the admin account on first startup."""
    if not ADMIN_PASSWORD:
        logger.warning("Admin bootstrap skipped — ADMIN_PASSWORD not set")
        return
    users = load_users()
    admin_key = ADMIN_EMAIL.lower()
    if admin_key not in users or users[admin_key].get("role") != Role.SUPER_ADMIN:
        users[admin_key] = {
            "name":          "Super Admin",
            "email":         admin_key,
            "password_hash": pwd_context.hash(ADMIN_PASSWORD),
            "role":          Role.SUPER_ADMIN,
            "created_at":    datetime.now(timezone.utc).isoformat(),
        }
        save_users(users)
        logger.info(f"Admin account bootstrapped: {admin_key}")
