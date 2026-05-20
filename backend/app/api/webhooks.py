"""Webhook receivers for external identity and integration events."""
import base64
import hashlib
import hmac
import json
import time
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request
import psycopg2.extras

from app.deps import get_db, load_users, save_users, Role, audit
from app.infra.config import CLERK_WEBHOOK_SECRET

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


def _verify_svix_payload(payload: bytes, headers: dict) -> dict:
    svix_id = headers.get("svix-id")
    svix_timestamp = headers.get("svix-timestamp")
    svix_signature = headers.get("svix-signature")
    if not svix_id or not svix_timestamp or not svix_signature:
        raise HTTPException(status_code=400, detail="Missing webhook signature headers")

    try:
        timestamp = int(svix_timestamp)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid webhook timestamp")
    if abs(time.time() - timestamp) > 300:
        raise HTTPException(status_code=400, detail="Expired webhook timestamp")

    secret = CLERK_WEBHOOK_SECRET
    if secret.startswith("whsec_"):
        secret = secret.split("_", 1)[1]
    try:
        secret_bytes = base64.b64decode(secret)
    except Exception:
        raise HTTPException(status_code=503, detail="Invalid Clerk webhook secret")

    signed_content = f"{svix_id}.{svix_timestamp}.".encode("utf-8") + payload
    expected = base64.b64encode(
        hmac.new(secret_bytes, signed_content, hashlib.sha256).digest()
    ).decode("utf-8")
    signatures = []
    for item in svix_signature.split(" "):
        if "," in item:
            version, signature = item.split(",", 1)
            if version == "v1":
                signatures.append(signature)
    if not any(hmac.compare_digest(expected, signature) for signature in signatures):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")
    return json.loads(payload.decode("utf-8"))


def _primary_email(data: dict) -> str | None:
    primary_id = data.get("primary_email_address_id")
    emails = data.get("email_addresses") or []
    for item in emails:
        if item.get("id") == primary_id:
            return (item.get("email_address") or "").lower()
    if emails:
        return (emails[0].get("email_address") or "").lower()
    return None


def _display_name(data: dict, fallback: str) -> str:
    name = " ".join([data.get("first_name") or "", data.get("last_name") or ""]).strip()
    return name or data.get("username") or fallback


def _sync_user(data: dict):
    email = _primary_email(data)
    if not email:
        return
    users = load_users()
    existing = users.get(email, {})
    users[email] = {
        **existing,
        "name": _display_name(data, email),
        "email": email,
        "password_hash": existing.get("password_hash", ""),
        "role": existing.get("role", Role.USER),
        "created_at": existing.get("created_at") or datetime.now(timezone.utc).isoformat(),
        "last_seen": existing.get("last_seen"),
        "notification_email": existing.get("notification_email", True),
        "clerk_user_id": data.get("id"),
    }
    save_users(users)


def _deactivate_user(data: dict):
    return


def _sync_org(data: dict):
    org_id = data.get("id")
    if not org_id:
        return
    now = datetime.now(timezone.utc).isoformat()
    name = data.get("name") or data.get("slug") or org_id
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO teams (id,name,owner_email,brand_color,created_at)
               VALUES (%s,%s,%s,%s,%s)
               ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name""",
            (org_id, name[:80], data.get("created_by") or "clerk", "#6366f1", now),
        )
        cur.close()


def _map_role(role: str | None) -> str:
    value = (role or "org:member").lower()
    if value.endswith(":admin"):
        return "admin"
    if value.endswith(":product") or value.endswith(":pm"):
        return "product"
    if value.endswith(":qa"):
        return "qa"
    if value.endswith(":legal"):
        return "legal"
    if value.endswith(":compliance"):
        return "compliance"
    if value.endswith(":security"):
        return "security"
    return "member"


def _membership_parts(data: dict) -> tuple[str | None, str | None, str]:
    org = data.get("organization") or {}
    org_id = org.get("id") or data.get("organization_id")
    public_user = data.get("public_user_data") or {}
    email = (public_user.get("identifier") or public_user.get("email_address") or "").lower()
    role = _map_role(data.get("role"))
    return org_id, email, role


def _sync_membership(data: dict):
    org_id, email, role = _membership_parts(data)
    if not org_id or not email:
        return
    now = datetime.now(timezone.utc).isoformat()
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO team_members (team_id,email,role,joined_at)
               VALUES (%s,%s,%s,%s)
               ON CONFLICT (team_id,email) DO UPDATE SET role=EXCLUDED.role""",
            (org_id, email, role, now),
        )
        cur.close()


def _remove_membership(data: dict):
    org_id, email, _role = _membership_parts(data)
    if not org_id or not email:
        return
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM team_members WHERE team_id=%s AND email=%s", (org_id, email))
        cur.close()


@router.post("/clerk")
async def clerk_webhook(request: Request):
    if not CLERK_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Clerk webhook secret is not configured")

    payload = await request.body()
    event = _verify_svix_payload(payload, dict(request.headers))

    event_type = event.get("type")
    data = event.get("data") or {}

    if event_type in ("user.created", "user.updated"):
        _sync_user(data)
    elif event_type == "user.deleted":
        _deactivate_user(data)
    elif event_type in ("organization.created", "organization.updated"):
        _sync_org(data)
    elif event_type == "organization.deleted":
        pass
    elif event_type in ("organizationMembership.created", "organizationMembership.updated"):
        _sync_org(data.get("organization") or {})
        _sync_membership(data)
    elif event_type == "organizationMembership.deleted":
        _remove_membership(data)

    audit("clerk", f"clerk_{event_type}", data.get("id"), metadata={"event": event_type})
    return {"ok": True}
