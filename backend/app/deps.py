"""Shared dependencies and state — single source of truth for all route modules."""
import os, json, logging, uuid, hashlib, re
import time as _time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import bcrypt
from jose import JWTError, jwt
from passlib.context import CryptContext

import psycopg2
import psycopg2.extras

from app.infra.config import (
    BASE_DIR, DATA_DIR, SESSIONS_DIR, MOCK_DIR, STATIC_DIR,
    JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRE_HOURS,
    ADMIN_EMAIL, ADMIN_PASSWORD, DEMO_MODE, DATABASE_URL,
)

logger = logging.getLogger("ReleaseOps")

# ── Auth ──────────────────────────────────────────────────────────────────────
class Role:
    USER        = "user"
    SUPER_ADMIN = "super_admin"

pwd_context   = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)

INTEGRATION_FIELDS = (
    "slack_webhook",
    "jira_url",
    "jira_token",
    "jira_project",
    "github_token",
    "github_repo",
    "github_pr",
    "linear_token",
    "linear_team_id",
    "webhook_url",
    "webhook_secret",
)


# ── Users store (PostgreSQL) ─────────────────────────────────────────────────
_users_cache:    Dict[str, Any] = {}
_users_cache_ts: float          = 0.0
_USERS_CACHE_TTL = 30.0


def _user_row_to_dict(row: dict) -> dict:
    """Convert a users table row to the legacy dict format."""
    return {
        "name":          row["name"],
        "email":         row["email"],
        "password_hash": row["password_hash"],
        "role":          row["role"],
        "created_at":    row["created_at"],
        "integrations":  json.loads(row["integrations"]) if row.get("integrations") else {},
    }


def load_users() -> Dict[str, Any]:
    with get_db() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM users")
        rows = cur.fetchall()
        cur.close()
    return {row["email"]: _user_row_to_dict(row) for row in rows}


def save_users(u: Dict[str, Any]):
    """Bulk upsert users dict into PostgreSQL."""
    with get_db() as conn:
        cur = conn.cursor()
        for email, data in u.items():
            cur.execute("""
                INSERT INTO users (email, name, password_hash, role, created_at, integrations)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (email) DO UPDATE SET
                    name = EXCLUDED.name,
                    password_hash = EXCLUDED.password_hash,
                    role = EXCLUDED.role,
                    integrations = EXCLUDED.integrations
            """, (
                email,
                data.get("name", ""),
                data.get("password_hash", ""),
                data.get("role", Role.USER),
                data.get("created_at", datetime.now(timezone.utc).isoformat()),
                json.dumps(data.get("integrations", {})),
            ))
        cur.close()
    _invalidate_users_cache()


def load_users_cached() -> Dict[str, Any]:
    global _users_cache, _users_cache_ts
    if _time.time() - _users_cache_ts < _USERS_CACHE_TTL:
        return _users_cache
    _users_cache    = load_users()
    _users_cache_ts = _time.time()
    return _users_cache


def _invalidate_users_cache():
    global _users_cache_ts
    _users_cache_ts = 0.0


def normalize_integration_settings(settings: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not isinstance(settings, dict):
        return {}
    normalized: Dict[str, Any] = {}
    for field in INTEGRATION_FIELDS:
        if field not in settings:
            continue
        value = settings.get(field)
        if value is None:
            continue
        if isinstance(value, str):
            value = value.strip()
            if not value:
                continue
        normalized[field] = value
    return normalized


def apply_integration_patch(current: Optional[Dict[str, Any]], patch: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    merged = normalize_integration_settings(current)
    if not isinstance(patch, dict):
        return merged
    for field in INTEGRATION_FIELDS:
        if field not in patch:
            continue
        value = patch.get(field)
        if value is None:
            merged.pop(field, None)
            continue
        if isinstance(value, str):
            value = value.strip()
            if not value:
                merged.pop(field, None)
                continue
        merged[field] = value
    return merged


def get_user_integration_settings(email: Optional[str]) -> Dict[str, Any]:
    if not email:
        return {}
    users = load_users_cached()
    return normalize_integration_settings(users.get(email, {}).get("integrations"))


def update_user_integration_settings(email: str, patch: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    users = load_users()
    if email not in users:
        raise HTTPException(status_code=404, detail="User not found")
    merged = apply_integration_patch(users[email].get("integrations"), patch)
    users[email]["integrations"] = merged
    save_users(users)
    return merged


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    if not password_hash:
        return False
    if password_hash.startswith("$2"):
        try:
            return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
        except ValueError:
            return bcrypt.checkpw(password.encode("utf-8")[:72], password_hash.encode("utf-8"))
        except Exception:
            return False
    try:
        return pwd_context.verify(password, password_hash)
    except Exception:
        return False


# ── Login history (PostgreSQL) ────────────────────────────────────────────────
def load_login_history() -> list:
    with get_db() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT email, timestamp, ip, user_agent, success, reason FROM login_history ORDER BY timestamp DESC LIMIT 1000")
        rows = cur.fetchall()
        cur.close()
    return [dict(r) for r in rows]

def save_login_history(h: list):
    pass  # Individual inserts via record_login_event; bulk save not needed

def record_login_event(email: str, ip: str, user_agent: str, success: bool, reason: str = ""):
    try:
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO login_history (email, timestamp, ip, user_agent, success, reason) VALUES (%s, %s, %s, %s, %s, %s)",
                (email, datetime.now(timezone.utc).isoformat(), ip, user_agent[:200], success, reason)
            )
            cur.close()
    except Exception as e:
        logger.warning(json.dumps({"event": "login_history_failed", "error": str(e)}))
    logger.info(json.dumps({
        "event": "login_event", "email": email, "success": success, "ip": ip
    }))


# ── JWT helpers ───────────────────────────────────────────────────────────────
def create_token(email: str, role: str = Role.USER) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS)
    return jwt.encode(
        {"sub": email, "role": role, "exp": expire},
        JWT_SECRET, algorithm=JWT_ALGORITHM
    )

def _decode_jwt_payload(credentials: HTTPAuthorizationCredentials) -> dict:
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        return jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    payload = _decode_jwt_payload(credentials)
    email: str = payload.get("sub")
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token")
    return email

def require_admin(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    payload = _decode_jwt_payload(credentials)
    if payload.get("role") != Role.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Access denied — super admin only")
    return payload.get("sub")


# ── Brute-force protection ────────────────────────────────────────────────────
_admin_fail_store: Dict[str, list] = defaultdict(list)
_ADMIN_MAX_FAILS  = 5
_ADMIN_LOCK_SECS  = 900

def check_admin_brute_force(ip: str):
    now = _time.time()
    cutoff = now - _ADMIN_LOCK_SECS
    _admin_fail_store[ip] = [t for t in _admin_fail_store[ip] if t > cutoff]
    if len(_admin_fail_store[ip]) >= _ADMIN_MAX_FAILS:
        raise HTTPException(
            status_code=429,
            detail="Too many failed attempts. Admin login locked for 15 minutes."
        )

def record_admin_fail(ip: str):
    _admin_fail_store[ip].append(_time.time())

def clear_admin_fails(ip: str):
    _admin_fail_store[ip] = []

def bootstrap_admin():
    if not ADMIN_PASSWORD:
        logger.warning(json.dumps({"event": "admin_bootstrap_skipped", "reason": "ADMIN_PASSWORD not set"}))
        return
    users = load_users()
    admin_key = ADMIN_EMAIL.lower()
    need_write = False
    if admin_key not in users or users[admin_key].get("role") != Role.SUPER_ADMIN:
        users[admin_key] = {
            "name":          "Super Admin",
            "email":         admin_key,
            "password_hash": hash_password(ADMIN_PASSWORD),
            "role":          Role.SUPER_ADMIN,
            "created_at":    datetime.now(timezone.utc).isoformat(),
        }
        need_write = True
        logger.info(json.dumps({"event": "admin_bootstrapped", "email": admin_key}))
    else:
        # Rehash if the stored hash is a legacy bcrypt hash (not verifiable with current libs)
        existing_hash = users[admin_key].get("password_hash", "")
        if existing_hash.startswith("$2") and not existing_hash.startswith("$pbkdf2"):
            if not verify_password(ADMIN_PASSWORD, existing_hash):
                users[admin_key]["password_hash"] = hash_password(ADMIN_PASSWORD)
                need_write = True
                logger.info(json.dumps({"event": "admin_password_rehashed", "email": admin_key}))
    # Also rehash any user with a stale bcrypt hash that can't be verified
    for email, user_data in users.items():
        h = user_data.get("password_hash", "")
        if h.startswith("$2") and not h.startswith("$pbkdf2"):
            # Can't verify old bcrypt hashes — leave them but log
            pass
    if need_write:
        save_users(users)


# ── Rate limiting ─────────────────────────────────────────────────────────────
_rl_store: dict[str, list[float]]      = defaultdict(list)
_user_rl_store: dict[str, list[float]] = defaultdict(list)
_RL_MAX    = 10
_RL_WINDOW = 60
_USER_RL_MAX    = 20
_USER_RL_WINDOW = 60

def check_rate_limit(ip: str) -> bool:
    now = _time.time()
    cutoff = now - _RL_WINDOW
    _rl_store[ip] = [t for t in _rl_store[ip] if t > cutoff]
    if len(_rl_store[ip]) >= _RL_MAX:
        return False
    _rl_store[ip].append(now)
    return True

def check_user_rate_limit(user_email: str) -> bool:
    now = _time.time()
    cutoff = now - _USER_RL_WINDOW
    _user_rl_store[user_email] = [t for t in _user_rl_store[user_email] if t > cutoff]
    if len(_user_rl_store[user_email]) >= _USER_RL_MAX:
        return False
    _user_rl_store[user_email].append(now)
    return True


# ── Input sanitization ────────────────────────────────────────────────────────
_INJECTION_PATTERNS = [
    r'\bignore\s+(previous|all|above|prior|the\s+above)\s+(instructions?|prompts?|context|rules?)\b',
    r'\bnew\s+task\s*:',
    r'(?<!\w)system\s*:',
    r'\byou\s+are\s+now\b',
    r'\bdisregard\s+(all|previous|prior|the|your)\b',
    r'\bforget\s+(all|previous|prior|your|everything)\b',
    r'\bpretend\s+(you\s+are|to\s+be)\b',
    r'\bact\s+as\s+(a\s+)?(?!user|developer|product)',
    r'\bdan\b',
    r'\bjailbreak\b',
    r'\bdeveloper\s+mode\b',
    r'\bprompt\s+injection\b',
    r'\boverride\s+(the|your|all|previous)\b',
    r'\bbypass\s+(the|your|all|safety|filter|guardrail)\b',
    r'<\s*(?:system|user|assistant|inst)\s*>',
    r'\[\s*(?:SYSTEM|USER|ASSISTANT|INST)\s*\]',
    r'\bdo\s+anything\s+now\b',
    r'\bunrestricted\s+mode\b',
    r'\bno\s+restrictions?\b',
    r'\bwithout\s+(any\s+)?restrictions?\b',
]
_COMPILED_INJECTION = [re.compile(p, re.IGNORECASE) for p in _INJECTION_PATTERNS]

_OUTPUT_GUARD_PATTERNS = [
    re.compile(r'\bignore\s+(previous|all)\s+instructions?\b', re.IGNORECASE),
    re.compile(r'\byou\s+are\s+now\b', re.IGNORECASE),
    re.compile(r'\bjailbreak\b', re.IGNORECASE),
    re.compile(r'\bprompt\s+injection\b', re.IGNORECASE),
    re.compile(r'\boverride\s+(the|your|all|previous)\b', re.IGNORECASE),
]

def sanitize_input(text: str, field: str = "input") -> str:
    if not text or not isinstance(text, str):
        return text
    for pattern in _COMPILED_INJECTION:
        if pattern.search(text):
            logger.warning(json.dumps({
                "event": "injection_attempt_blocked", "field": field, "pattern": pattern.pattern,
            }))
            raise HTTPException(
                status_code=400,
                detail=f"Input contains disallowed content in '{field}'. Please describe your feature naturally."
            )
    return text[:2000]

def validate_output_safety(raw: str, agent: str) -> str:
    for pat in _OUTPUT_GUARD_PATTERNS:
        if pat.search(raw):
            logger.warning(json.dumps({"event": "output_injection_detected", "agent": agent}))
            raise ValueError(f"Unsafe content detected in {agent} output — discarding response.")
    return raw


# ── PII detection ─────────────────────────────────────────────────────────────
_PII_PATTERNS = {
    "email":       re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'),
    "ssn":         re.compile(r'\b\d{3}-\d{2}-\d{4}\b'),
    "phone":       re.compile(r'\b(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b'),
    "credit_card": re.compile(r'\b(?:\d{4}[-\s]?){3}\d{4}\b'),
    "passport":    re.compile(r'\b[A-Z]{1,2}\d{6,9}\b'),
    "national_id": re.compile(r'\b\d{2}-\d{7}\b'),
}

def detect_pii(text: str) -> list[str]:
    found = []
    for name, pattern in _PII_PATTERNS.items():
        if pattern.search(text):
            found.append(name)
    return found


# ── Database helpers ──────────────────────────────────────────────────────────
from app.infra.database import get_db

def audit(email: str, action: str, resource_id: str = None, metadata: dict = None, ip: str = None):
    try:
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO audit_log (email,action,resource_id,metadata,ip,created_at) VALUES (%s,%s,%s,%s,%s,%s)",
                (email, action, resource_id, json.dumps(metadata) if metadata else None,
                 ip, datetime.now(timezone.utc).isoformat())
            )
            cur.close()
    except Exception as e:
        logger.warning(json.dumps({"event": "audit_failed", "error": str(e)}))

def hash_api_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()

def verify_api_key(key: str) -> Optional[str]:
    key_hash = hash_api_key(key)
    with get_db() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "SELECT email FROM api_keys WHERE key_hash=%s AND is_active=1", (key_hash,)
        )
        row = cur.fetchone()
        if row:
            cur2 = conn.cursor()
            cur2.execute("UPDATE api_keys SET last_used=%s WHERE key_hash=%s",
                         (datetime.now(timezone.utc).isoformat(), key_hash))
            cur2.close()
            cur.close()
            return row["email"]
        cur.close()
    return None


# ── In-memory session store ───────────────────────────────────────────────────
sessions: Dict[str, Any] = {}


def _ensure_session_db_columns():
    pass  # All columns defined in init_db() for PostgreSQL


def _parse_json_field(value: Any, default: Any):
    if value in (None, ""):
        return default
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except Exception:
        return default


def _row_to_session(row: Any) -> dict:
    return {
        "id": row["id"],
        "feature_title": row["feature_title"] or "",
        "feature_description": row["feature_description"] or "",
        "status": row["status"] or "pending",
        "created_at": row["created_at"] or "",
        "completed_at": row["completed_at"],
        "readiness_score": _parse_json_field(row["readiness_score"], None),
        "version": row["version"] or 1,
        "parent_session_id": row["parent_session_id"],
        "navigator": _parse_json_field(row["navigator_data"], {}),
        "sentinel": _parse_json_field(row["sentinel_data"], {}),
        "herald": _parse_json_field(row["herald_data"], {}),
        "error": row["error_text"],
        "integrations": _parse_json_field(row["integrations_data"], {}),
        "validation_warnings": _parse_json_field(row["validation_warnings"], []),
        "pii_detected": _parse_json_field(row["pii_detected"], []),
        "user_email": row["user_email"],
    }


def session_snapshot(session_data: dict) -> dict:
    meta = session_data.get("session") if isinstance(session_data.get("session"), dict) else session_data
    return {
        "session": {
            "id": meta.get("id"),
            "feature_title": meta.get("feature_title", ""),
            "feature_description": meta.get("feature_description", ""),
            "status": meta.get("status", "pending"),
            "created_at": meta.get("created_at", ""),
            "completed_at": meta.get("completed_at"),
            "readiness_score": meta.get("readiness_score"),
            "parent_session_id": meta.get("parent_session_id"),
            "version": meta.get("version", 1),
            "user_email": meta.get("user_email"),
            "validation_warnings": meta.get("validation_warnings", []),
            "pii_detected": meta.get("pii_detected", []),
            "integrations": meta.get("integrations", {}),
        },
        "navigator": session_data.get("navigator") or {},
        "sentinel": session_data.get("sentinel") or {},
        "herald": session_data.get("herald") or {},
        "error": session_data.get("error"),
    }


def persist_session_state(session_id: str):
    session_data = sessions.get(session_id)
    if not session_data:
        return
    _ensure_session_db_columns()
    snapshot = session_snapshot(session_data)
    meta = snapshot["session"]
    nav = snapshot["navigator"]
    sen = snapshot["sentinel"]
    her = snapshot["herald"]
    try:
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute(
                """INSERT INTO sessions_db
                   (id, feature_title, feature_description, status, user_email,
                    readiness_score, created_at, completed_at, parent_session_id, version,
                    navigator_data, sentinel_data, herald_data, integrations_data, error_text,
                    pii_detected, validation_warnings)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                   ON CONFLICT (id) DO UPDATE SET
                    feature_title = EXCLUDED.feature_title,
                    feature_description = EXCLUDED.feature_description,
                    status = EXCLUDED.status,
                    user_email = EXCLUDED.user_email,
                    readiness_score = EXCLUDED.readiness_score,
                    completed_at = EXCLUDED.completed_at,
                    parent_session_id = EXCLUDED.parent_session_id,
                    version = EXCLUDED.version,
                    navigator_data = EXCLUDED.navigator_data,
                    sentinel_data = EXCLUDED.sentinel_data,
                    herald_data = EXCLUDED.herald_data,
                    integrations_data = EXCLUDED.integrations_data,
                    error_text = EXCLUDED.error_text,
                    pii_detected = EXCLUDED.pii_detected,
                    validation_warnings = EXCLUDED.validation_warnings
                """,
                (
                    meta["id"], meta["feature_title"], meta.get("feature_description", ""),
                    meta["status"], meta.get("user_email"),
                    json.dumps(meta.get("readiness_score")),
                    meta["created_at"], meta.get("completed_at"),
                    meta.get("parent_session_id"), meta.get("version", 1),
                    json.dumps(nav), json.dumps(sen), json.dumps(her),
                    json.dumps(meta.get("integrations", {})), snapshot.get("error"),
                    json.dumps(meta.get("pii_detected", [])),
                    json.dumps(meta.get("validation_warnings", [])),
                )
            )
            cur.close()
    except Exception as exc:
        logger.warning(json.dumps({"event": "sessions_db_write_failed", "error": str(exc)}))

    final_path = SESSIONS_DIR / session_id / "final.json"
    if meta.get("status") == "complete" or final_path.exists():
        session_dir = final_path.parent
        session_dir.mkdir(parents=True, exist_ok=True)
        (session_dir / "navigator.json").write_text(json.dumps(nav, indent=2))
        (session_dir / "sentinel.json").write_text(json.dumps(sen, indent=2))
        (session_dir / "herald.json").write_text(json.dumps(her, indent=2))
        final_path.write_text(json.dumps(snapshot, indent=2))


def load_session_state(session_id: str) -> Optional[dict]:
    if session_id in sessions:
        return sessions[session_id]
    _ensure_session_db_columns()
    with get_db() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM sessions_db WHERE id=%s", (session_id,))
        row = cur.fetchone()
        cur.close()
    if row:
        session_data = _row_to_session(row)
        sessions[session_id] = session_data
        return session_data
    final_path = SESSIONS_DIR / session_id / "final.json"
    if final_path.exists():
        rec = json.loads(final_path.read_text())
        flat = normalize_session(rec, session_id)
        sessions[session_id] = flat
        return flat
    return None


def list_sessions_for_user(email: str) -> list[dict]:
    combined: Dict[str, dict] = {}
    for session_id, session_data in sessions.items():
        if session_data.get("user_email") == email:
            combined[session_id] = session_data
    _ensure_session_db_columns()
    with get_db() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "SELECT * FROM sessions_db WHERE user_email=%s ORDER BY created_at DESC",
            (email,),
        )
        rows = cur.fetchall()
        cur.close()
    for row in rows:
        session_data = _row_to_session(row)
        combined.setdefault(session_data["id"], session_data)
    return sorted(combined.values(), key=lambda item: item.get("created_at") or "", reverse=True)

def normalize_session(rec: dict, fallback_id: str) -> dict:
    if "session" in rec and isinstance(rec["session"], dict):
        meta = rec["session"]
        return {
            "id":                  meta.get("id", fallback_id),
            "feature_title":       meta.get("feature_title", ""),
            "feature_description": meta.get("feature_description", ""),
            "status":              meta.get("status", "complete"),
            "created_at":          meta.get("created_at", ""),
            "readiness_score":     meta.get("readiness_score"),
            "version":             meta.get("version", 1),
            "parent_session_id":   meta.get("parent_session_id"),
            "navigator":           rec.get("navigator") or {},
            "sentinel":            rec.get("sentinel") or {},
            "herald":              rec.get("herald") or {},
            "error":               rec.get("error"),
            "integrations":        meta.get("integrations", {}),
            "validation_warnings": meta.get("validation_warnings", []),
            "pii_detected":        meta.get("pii_detected", []),
            "user_email":          meta.get("user_email"),
            "completed_at":        meta.get("completed_at"),
        }
    if "id" not in rec:
        rec["id"] = fallback_id
    return rec

def reload_sessions_from_disk():
    loaded = 0
    _ensure_session_db_columns()
    with get_db() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM sessions_db ORDER BY created_at DESC")
        rows = cur.fetchall()
        cur.close()
    for row in rows:
        try:
            session_data = _row_to_session(row)
            sid = session_data.get("id")
            if sid and sid not in sessions:
                sessions[sid] = session_data
                loaded += 1
        except Exception:
            pass
    for final_path in SESSIONS_DIR.glob("*/final.json"):
        try:
            rec = json.loads(final_path.read_text())
            fallback_id = final_path.parent.name
            flat = normalize_session(rec, fallback_id)
            sid = flat.get("id") or fallback_id
            if sid and sid not in sessions:
                sessions[sid] = flat
                loaded += 1
        except Exception:
            pass
    logger.info(json.dumps({"event": "sessions_reloaded", "count": loaded}))


# ── Share tokens (PostgreSQL) ─────────────────────────────────────────────────
def load_share_tokens() -> dict:
    with get_db() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT token, data FROM share_tokens")
        rows = cur.fetchall()
        cur.close()
    result = {}
    for row in rows:
        try:
            result[row["token"]] = json.loads(row["data"])
        except Exception:
            result[row["token"]] = row["data"]
    return result

def save_share_tokens(tokens: dict):
    with get_db() as conn:
        cur = conn.cursor()
        # Truncate and re-insert
        cur.execute("DELETE FROM share_tokens")
        for token, data in tokens.items():
            cur.execute(
                "INSERT INTO share_tokens (token, data) VALUES (%s, %s)",
                (token, json.dumps(data) if not isinstance(data, str) else data)
            )
        cur.close()


# ── Email helper ──────────────────────────────────────────────────────────────
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.infra.config import SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, FROM_EMAIL

def send_email(to_email: str, subject: str, html_body: str) -> bool:
    if not SMTP_HOST or not SMTP_USER:
        logger.warning(json.dumps({"event": "email_skipped", "reason": "SMTP not configured"}))
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = FROM_EMAIL
        msg["To"]      = to_email
        msg.attach(MIMEText(html_body, "html"))
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(FROM_EMAIL, [to_email], msg.as_string())
        return True
    except Exception as e:
        logger.error(json.dumps({"event": "email_failed", "error": str(e)}))
        return False
