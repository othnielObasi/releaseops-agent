"""Admin routes — admin login, user management, stats, login history, LLM settings."""
import json
from datetime import datetime, timezone
from typing import Dict, Optional, List

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from app.deps import (
    Role, verify_password, require_admin, logger,
    load_users, load_login_history, record_login_event,
    check_admin_brute_force, record_admin_fail, clear_admin_fails,
    create_token, audit,
)
from app.models.schemas import LoginRequest
from app.infra.config import SESSIONS_DIR, STATIC_DIR
from app.infra.database import get_llm_settings, save_llm_settings

router = APIRouter(tags=["admin"])


@router.post("/api/admin/login")
async def admin_login(body: LoginRequest, request: Request):
    ip = request.client.host if request.client else "unknown"
    ua = request.headers.get("user-agent", "")
    check_admin_brute_force(ip)
    users = load_users()
    email = body.email.lower().strip()
    user = users.get(email)
    if not user or user.get("role") != "super_admin" or \
         not verify_password(body.password, user["password_hash"]):
        record_admin_fail(ip)
        record_login_event(email, ip, ua, success=False, reason="admin_bad_credentials")
        raise HTTPException(status_code=401, detail="Invalid admin credentials.")
    clear_admin_fails(ip)
    record_login_event(email, ip, ua, success=True, reason="admin_login")
    token = create_token(email, role="super_admin")
    logger.info(json.dumps({"event": "admin_login_success", "email": email, "ip": ip}))
    return {"token": token, "email": email, "role": "super_admin"}


@router.get("/api/admin/users")
async def admin_list_users(admin: str = Depends(require_admin)):
    users = load_users()
    history = load_login_history()
    session_counts: Dict[str, int] = {}
    if SESSIONS_DIR.exists():
        for final_file in SESSIONS_DIR.glob("*/final.json"):
            try:
                rec = json.loads(final_file.read_text())
                uemail = rec.get("session", {}).get("user_email")
                if uemail:
                    session_counts[uemail] = session_counts.get(uemail, 0) + 1
            except Exception:
                pass
    result = []
    for email, u in users.items():
        if u.get("role") == "super_admin":
            continue
        user_events = [e for e in history if e["email"] == email]
        result.append({
            "email":         email,
            "name":          u.get("name", ""),
            "role":          u.get("role", "user"),
            "created_at":    u.get("created_at", ""),
            "last_seen":     u.get("last_seen", ""),
            "session_count": session_counts.get(email, 0),
            "login_count":   sum(1 for e in user_events if e["success"]),
            "fail_count":    sum(1 for e in user_events if not e["success"]),
        })
    result.sort(key=lambda x: x["created_at"], reverse=True)
    return {"users": result, "total": len(result)}


@router.get("/api/admin/users/{email}/history")
async def admin_user_history(email: str, admin: str = Depends(require_admin)):
    history = load_login_history()
    events = [e for e in history if e["email"] == email.lower()]
    events.sort(key=lambda x: x["timestamp"], reverse=True)
    users = load_users()
    user = users.get(email.lower(), {})
    user_sessions = []
    if SESSIONS_DIR.exists():
        for final_file in sorted(SESSIONS_DIR.glob("*/final.json"), reverse=True):
            try:
                rec = json.loads(final_file.read_text())
                if rec.get("session", {}).get("user_email") == email.lower():
                    s = rec["session"]
                    user_sessions.append({
                        "id":            s.get("id", ""),
                        "feature_title": s.get("feature_title", ""),
                        "status":        s.get("status", ""),
                        "created_at":    s.get("created_at", ""),
                    })
            except Exception:
                pass
    return {
        "user":     {"email": email, "name": user.get("name", ""), "created_at": user.get("created_at", "")},
        "events":   events,
        "sessions": user_sessions,
    }


@router.get("/api/admin/login-history")
async def admin_login_history(page: int = 0, size: int = 50, admin: str = Depends(require_admin)):
    history = load_login_history()
    history.sort(key=lambda x: x["timestamp"], reverse=True)
    total = len(history)
    paged = history[page * size : (page + 1) * size]
    return {"events": paged, "total": total, "page": page, "size": size}


@router.get("/api/admin/stats")
async def admin_stats(admin: str = Depends(require_admin)):
    users = load_users()
    history = load_login_history()
    today = datetime.now(timezone.utc).date().isoformat()
    total_sessions = 0
    if SESSIONS_DIR.exists():
        total_sessions = sum(1 for _ in SESSIONS_DIR.glob("*/final.json"))
    regular_users = [u for u in users.values() if u.get("role") != "super_admin"]
    logins_today = sum(1 for e in history if e["success"] and e["timestamp"][:10] == today)
    fails_today  = sum(1 for e in history if not e["success"] and e["timestamp"][:10] == today)
    return {
        "total_users":    len(regular_users),
        "total_sessions": total_sessions,
        "logins_today":   logins_today,
        "failed_today":   fails_today,
        "total_logins":   sum(1 for e in history if e["success"]),
        "total_fails":    sum(1 for e in history if not e["success"]),
    }


@router.get("/admin", response_class=HTMLResponse)
async def admin_page():
    admin_html = STATIC_DIR / "admin.html"
    if admin_html.exists():
        return HTMLResponse(content=admin_html.read_text())
    raise HTTPException(status_code=404, detail="Admin panel not found")


# ── LLM Settings (super_admin only) ──────────────────────────────────────────

_VALID_PROVIDERS = {"openai", "anthropic"}

_PROVIDER_MODELS = {
    "openai":    ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "o3", "o3-mini", "o4-mini"],
    "anthropic": ["claude-sonnet-4-20250514", "claude-haiku-4-5-20250514", "claude-opus-4-20250514"],
}


class LLMSettingsUpdate(BaseModel):
    model_config = {"protected_namespaces": ()}
    default_provider: str                         # "openai" or "anthropic"
    failover_provider: Optional[str] = None       # "openai", "anthropic", or null
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    model_navigator: Optional[str] = None
    model_sentinel: Optional[str] = None
    model_herald: Optional[str] = None


@router.get("/api/admin/llm-settings")
async def get_admin_llm_settings(admin: str = Depends(require_admin)):
    """Get current LLM provider settings. Keys are masked."""
    settings = get_llm_settings()
    if not settings:
        from app.infra.config import (
            LLM_PROVIDER, OPENAI_API_KEY, ANTHROPIC_API_KEY,
            MODEL_NAVIGATOR, MODEL_SENTINEL, MODEL_HERALD,
        )
        settings = {
            "default_provider": LLM_PROVIDER,
            "failover_provider": None,
            "openai_api_key": OPENAI_API_KEY,
            "anthropic_api_key": ANTHROPIC_API_KEY,
            "model_navigator": MODEL_NAVIGATOR,
            "model_sentinel": MODEL_SENTINEL,
            "model_herald": MODEL_HERALD,
            "updated_by": None,
            "updated_at": None,
        }
    # Mask API keys — show only last 4 chars
    for key_field in ("openai_api_key", "anthropic_api_key"):
        val = settings.get(key_field, "") or ""
        settings[key_field] = f"****{val[-4:]}" if len(val) > 4 else ("set" if val else "")
    return {
        "settings": settings,
        "available_providers": list(_VALID_PROVIDERS),
        "available_models": _PROVIDER_MODELS,
    }


@router.put("/api/admin/llm-settings")
async def update_llm_settings(body: LLMSettingsUpdate, admin: str = Depends(require_admin)):
    """Update LLM provider config. Super admin only."""
    if body.default_provider not in _VALID_PROVIDERS:
        raise HTTPException(400, f"Invalid provider. Choose from: {', '.join(_VALID_PROVIDERS)}")
    if body.failover_provider and body.failover_provider not in _VALID_PROVIDERS:
        raise HTTPException(400, f"Invalid failover provider. Choose from: {', '.join(_VALID_PROVIDERS)}")
    if body.failover_provider == body.default_provider:
        raise HTTPException(400, "Failover provider must be different from default provider")

    # Merge with existing settings — only overwrite fields that are provided
    existing = get_llm_settings() or {}
    merged = {
        "default_provider":  body.default_provider,
        "failover_provider": body.failover_provider,
        "openai_api_key":    body.openai_api_key if body.openai_api_key and not body.openai_api_key.startswith("****") else existing.get("openai_api_key", ""),
        "anthropic_api_key": body.anthropic_api_key if body.anthropic_api_key and not body.anthropic_api_key.startswith("****") else existing.get("anthropic_api_key", ""),
        "model_navigator":   body.model_navigator or existing.get("model_navigator", ""),
        "model_sentinel":    body.model_sentinel or existing.get("model_sentinel", ""),
        "model_herald":      body.model_herald or existing.get("model_herald", ""),
    }

    # Validate that the default provider has a key
    if merged["default_provider"] == "openai" and not merged["openai_api_key"]:
        raise HTTPException(400, "OpenAI API key is required when OpenAI is the default provider")
    if merged["default_provider"] == "anthropic" and not merged["anthropic_api_key"]:
        raise HTTPException(400, "Anthropic API key is required when Anthropic is the default provider")

    save_llm_settings(merged, admin)
    audit(admin, "llm_settings_updated", metadata={
        "default_provider": merged["default_provider"],
        "failover_provider": merged["failover_provider"],
    })
    logger.info(json.dumps({
        "event": "llm_settings_updated", "admin": admin,
        "default": merged["default_provider"], "failover": merged["failover_provider"],
    }))
    return {"status": "ok", "default_provider": merged["default_provider"], "failover_provider": merged["failover_provider"]}


@router.post("/api/admin/llm-settings/test")
async def test_llm_connection(admin: str = Depends(require_admin)):
    """Quick connectivity test — sends a trivial prompt to the configured default provider."""
    from app.agents.pipeline import call_llm_agent
    try:
        result = await call_llm_agent(
            model="", system_prompt="Respond with exactly: {\"status\": \"ok\"}",
            user_message="ping", agent_role="navigator",
        )
        return {"status": "ok", "response": result[:200]}
    except Exception as e:
        raise HTTPException(502, f"LLM connection failed: {str(e)[:200]}")
