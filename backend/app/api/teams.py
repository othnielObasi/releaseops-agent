"""Teams, workspaces, API keys, templates, annotations, branding routes."""
import json, uuid, secrets as _secrets
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends

import psycopg2.extras

from app.deps import (
    verify_token, get_db, audit, send_email, hash_api_key, logger,
    load_users, save_users, hash_password, Role, sessions, normalize_session, SESSIONS_DIR,
)
from app.models.schemas import (
    TeamCreate, TeamInvite, BrandingUpdate, APIKeyCreate,
    TemplateCreate, AnnotationCreate, TeamMemberCreate, TeamMemberRoleUpdate,
)
from app.infra.config import DATA_DIR, PUBLIC_APP_URL

router = APIRouter(tags=["teams"])

TEMPLATES_FILE = DATA_DIR / "templates.json"


def _normalize_email(email: str) -> str:
    return email.lower().strip()


ORG_ROLES = {"owner", "admin", "product", "pm", "qa", "legal", "compliance", "security", "member"}


def _normalize_role(role: str) -> str:
    value = (role or "member").lower().strip()
    if value == "manager":
        value = "admin"
    if value not in ORG_ROLES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid role. Use one of: {', '.join(sorted(ORG_ROLES))}",
        )
    return value


def _require_team_admin(team_id: str, email: str):
    with get_db() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "SELECT role FROM team_members WHERE team_id=%s AND email=%s",
            (team_id, email),
        )
        row = cur.fetchone()
        cur.close()
    if not row or row.get("role") not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only organization owners and admins can manage users.")
    return row["role"]


def _load_templates() -> list:
    if TEMPLATES_FILE.exists():
        return json.loads(TEMPLATES_FILE.read_text())
    return []


def _save_templates(templates: list):
    TEMPLATES_FILE.write_text(json.dumps(templates, indent=2))


def _resolve_session(session_id: str) -> dict | None:
    session_data = sessions.get(session_id)
    if session_data:
        return session_data
    final_path = SESSIONS_DIR / session_id / "final.json"
    if final_path.exists():
        record = json.loads(final_path.read_text())
        flat = normalize_session(record, session_id)
        sessions[session_id] = flat
        return flat
    return None


def _check_session_owner(session_id: str, email: str):
    session_data = _resolve_session(session_id)
    if not session_data:
        raise HTTPException(status_code=404, detail="Session not found")
    owner = session_data.get("user_email")
    if owner != email:
        raise HTTPException(status_code=403, detail="Access denied")


# ═══════════════════════════════════════════════════════════════════════════════
# API Keys
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/api/keys")
async def create_api_key(body: APIKeyCreate, email: str = Depends(verify_token)):
    raw_key = "ro_" + _secrets.token_hex(32)
    key_hash = hash_api_key(raw_key)
    key_id = str(uuid.uuid4())
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
        "INSERT INTO api_keys (id,key_hash,name,email,created_at) VALUES (%s,%s,%s,%s,%s)",
        (key_id, key_hash, body.name.strip()[:80], email, datetime.now(timezone.utc).isoformat())
        )
        cur.close()
    audit(email, "api_key_created", key_id)
    return {"id": key_id, "name": body.name, "key": raw_key, "created_at": datetime.now(timezone.utc).isoformat()}


@router.get("/api/keys")
async def list_api_keys(email: str = Depends(verify_token)):
    with get_db() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
        "SELECT id,name,created_at,last_used FROM api_keys WHERE email=%s AND is_active=1 ORDER BY created_at DESC",
        (email,)
        )
        rows = cur.fetchall()
        cur.close()
    return [dict(r) for r in rows]


@router.delete("/api/keys/{key_id}")
async def revoke_api_key(key_id: str, email: str = Depends(verify_token)):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
        "UPDATE api_keys SET is_active=0 WHERE id=%s AND email=%s", (key_id, email)
        )
        n = cur.rowcount
        cur.close()
    if not n:
        raise HTTPException(status_code=404, detail="Key not found")
    audit(email, "api_key_revoked", key_id)
    return {"status": "revoked"}


# ═══════════════════════════════════════════════════════════════════════════════
# Teams & Workspaces
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/api/teams")
async def create_team(body: TeamCreate, email: str = Depends(verify_token)):
    team_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
        "INSERT INTO teams (id,name,owner_email,brand_color,created_at) VALUES (%s,%s,%s,%s,%s)",
        (team_id, body.name.strip()[:80], email, body.brand_color or "#6366f1", now)
        )
        cur.execute(
        "INSERT INTO team_members (team_id,email,role,joined_at) VALUES (%s,%s,%s,%s)",
        (team_id, email, "owner", now)
        )
        cur.close()
    audit(email, "team_created", team_id)
    return {"id": team_id, "name": body.name, "owner_email": email, "created_at": now}


@router.get("/api/teams")
async def list_teams(email: str = Depends(verify_token)):
    with get_db() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
        """SELECT t.id, t.name, t.owner_email, t.brand_color, t.created_at, m.role
           FROM teams t JOIN team_members m ON t.id=m.team_id
           WHERE m.email=%s ORDER BY t.created_at DESC""", (email,)
        )
        rows = cur.fetchall()
        cur.close()
    return [dict(r) for r in rows]


@router.post("/api/teams/{team_id}/invite")
async def invite_member(team_id: str, body: TeamInvite, email: str = Depends(verify_token)):
    invite_role = _normalize_role(body.role or "member")
    with get_db() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
        "SELECT 1 FROM team_members WHERE team_id=%s AND email=%s AND role IN ('owner','admin')",
        (team_id, email)
        )
        owner = cur.fetchone()
        if not owner:
            raise HTTPException(status_code=403, detail="Only team admins can invite members")
        token = _secrets.token_hex(16)
        cur.execute(
        "INSERT INTO team_invites (id,team_id,inviter_email,invitee_email,role,token,created_at) VALUES (%s,%s,%s,%s,%s,%s,%s)",
        (str(uuid.uuid4()), team_id, email, _normalize_email(body.email), invite_role, token, datetime.now(timezone.utc).isoformat())
        )
        cur.close()
    with get_db() as conn2:
        cur2 = conn2.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur2.execute("SELECT name FROM teams WHERE id=%s", (team_id,))
        team_row = cur2.fetchone()
        cur2.close()
    team_name = team_row["name"] if team_row else "a ReleaseOps workspace"
    invite_url = f"{PUBLIC_APP_URL}/join/{token}" if PUBLIC_APP_URL else f"/join/{token}"
    email_sent = send_email(
        body.email,
        f"You've been invited to join {team_name} on ReleaseOps",
        f"""<html><body style="font-family:Arial,sans-serif;color:#1e293b;max-width:520px;margin:0 auto;">
        <div style="background:#6366f1;color:white;padding:20px;border-radius:8px 8px 0 0;">
          <h2 style="margin:0;font-size:18px;">ReleaseOps — Team Invitation</h2></div>
        <div style="padding:24px;background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
          <p><strong>{email}</strong> has invited you to join <strong>{team_name}</strong>.</p>
          <a href="{invite_url}"
             style="display:inline-block;background:#6366f1;color:white;padding:12px 28px;
                    border-radius:7px;text-decoration:none;font-weight:700;font-size:15px;">
            Accept Invitation</a>
          <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;">
            This link is single-use. If you did not expect this invitation, ignore this email.</p>
        </div></body></html>"""
    )
    audit(email, "organization_member_invited", team_id, metadata={"invitee": _normalize_email(body.email), "role": invite_role})
    return {
        "status": "invited",
        "token": token,
        "invite_url": invite_url,
        "email_sent": bool(email_sent),
        "email_status": "sent" if email_sent else "not_configured_or_failed",
    }


@router.get("/api/teams/invite/{token}")
async def get_invite_info(token: str):
    """Public — returns team name & inviter for the join page."""
    with get_db() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
        "SELECT ti.invitee_email, ti.inviter_email, t.name AS team_name, t.brand_color "
        "FROM team_invites ti JOIN teams t ON ti.team_id=t.id "
        "WHERE ti.token=%s AND ti.status='pending'",
        (token,)
        )
        inv = cur.fetchone()
        cur.close()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found or already used")
    return {
        "team_name": inv["team_name"],
        "inviter_email": inv["inviter_email"],
        "invitee_email": inv["invitee_email"],
        "brand_color": inv["brand_color"] or "#6366f1",
    }


@router.get("/api/teams/accept/{token}")
async def accept_invite(token: str, email: str = Depends(verify_token)):
    with get_db() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
        "SELECT * FROM team_invites WHERE token=%s AND status='pending'", (token,)
        )
        inv = cur.fetchone()
        if not inv:
            raise HTTPException(status_code=404, detail="Invitation not found or already used")
        if inv["invitee_email"] and _normalize_email(inv["invitee_email"]) != _normalize_email(email):
            raise HTTPException(status_code=403, detail="This invitation was sent to a different email address")
        invite_role = _normalize_role(inv.get("role") or "member")
        cur.execute(
        """INSERT INTO team_members (team_id,email,role,joined_at)
           VALUES (%s,%s,%s,%s)
           ON CONFLICT (team_id,email) DO UPDATE SET role=EXCLUDED.role""",
        (inv["team_id"], email, invite_role, datetime.now(timezone.utc).isoformat())
        )
        cur.execute("UPDATE team_invites SET status='accepted' WHERE token=%s", (token,))
        cur.close()
    return {"status": "accepted", "team_id": inv["team_id"]}


@router.get("/api/teams/{team_id}/members")
async def list_members(team_id: str, email: str = Depends(verify_token)):
    with get_db() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
        "SELECT 1 FROM team_members WHERE team_id=%s AND email=%s", (team_id, email)
        )
        member = cur.fetchone()
        if not member:
            raise HTTPException(status_code=403, detail="Not a team member")
        cur.execute(
        """SELECT tm.email, tm.role, tm.joined_at, COALESCE(u.name, '') AS name
           FROM team_members tm
           LEFT JOIN users u ON u.email=tm.email
           WHERE tm.team_id=%s
           ORDER BY
             CASE tm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
             tm.joined_at""",
        (team_id,)
        )
        rows = cur.fetchall()
        cur.close()
    return [dict(r) for r in rows]


@router.post("/api/teams/{team_id}/members")
async def add_member(team_id: str, body: TeamMemberCreate, email: str = Depends(verify_token)):
    _require_team_admin(team_id, email)
    member_email = _normalize_email(body.email)
    member_role = _normalize_role(body.role)
    if member_role == "owner":
        raise HTTPException(status_code=400, detail="Use admin for delegated administration. Ownership transfer is not supported here.")

    users = load_users()
    temporary_password = None
    if member_email not in users:
        password = (body.password or "").strip()
        if not password:
            password = _secrets.token_urlsafe(12)
            temporary_password = password
        if len(password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
        users[member_email] = {
            "name": (body.name or member_email.split("@")[0]).strip()[:120],
            "email": member_email,
            "password_hash": hash_password(password),
            "role": Role.USER,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_seen": None,
            "notification_email": True,
        }
        save_users(users)
    elif body.name:
        users[member_email]["name"] = body.name.strip()[:120]
        save_users(users)

    now = datetime.now(timezone.utc).isoformat()
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO team_members (team_id,email,role,joined_at)
               VALUES (%s,%s,%s,%s)
               ON CONFLICT (team_id,email) DO UPDATE SET role=EXCLUDED.role""",
            (team_id, member_email, member_role, now),
        )
        cur.close()
    audit(email, "organization_member_added", team_id, metadata={"member": member_email, "role": member_role})
    response = {"email": member_email, "role": member_role, "status": "added"}
    if temporary_password:
        response["temporary_password"] = temporary_password
    return response


@router.patch("/api/teams/{team_id}/members/{member_email}")
async def update_member_role(team_id: str, member_email: str, body: TeamMemberRoleUpdate, email: str = Depends(verify_token)):
    _require_team_admin(team_id, email)
    member_email = _normalize_email(member_email)
    next_role = _normalize_role(body.role)
    if next_role == "owner":
        raise HTTPException(status_code=400, detail="Ownership transfer is not supported here.")
    with get_db() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT role FROM team_members WHERE team_id=%s AND email=%s", (team_id, member_email))
        current = cur.fetchone()
        if not current:
            cur.close()
            raise HTTPException(status_code=404, detail="Member not found")
        if current.get("role") == "owner":
            cur.close()
            raise HTTPException(status_code=400, detail="Owner role cannot be changed from this screen.")
        cur.execute("UPDATE team_members SET role=%s WHERE team_id=%s AND email=%s", (next_role, team_id, member_email))
        cur.close()
    audit(email, "organization_member_role_updated", team_id, metadata={"member": member_email, "role": next_role})
    return {"email": member_email, "role": next_role, "status": "updated"}


@router.delete("/api/teams/{team_id}/members/{member_email}")
async def remove_member(team_id: str, member_email: str, email: str = Depends(verify_token)):
    with get_db() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
        "SELECT 1 FROM team_members WHERE team_id=%s AND email=%s AND role IN ('owner','admin')",
        (team_id, email)
        )
        owner = cur.fetchone()
        if not owner and email != member_email:
            raise HTTPException(status_code=403, detail="Cannot remove members")
        cur.execute("DELETE FROM team_members WHERE team_id=%s AND email=%s", (team_id, member_email))
        cur.close()
    return {"status": "removed"}


# ═══════════════════════════════════════════════════════════════════════════════
# Branding
# ═══════════════════════════════════════════════════════════════════════════════

@router.patch("/api/teams/{team_id}/branding")
async def update_team_branding(team_id: str, body: BrandingUpdate, email: str = Depends(verify_token)):
    with get_db() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
        "SELECT 1 FROM team_members WHERE team_id=%s AND email=%s AND role IN ('owner','admin')",
        (team_id, email)
        )
        owner = cur.fetchone()
        if not owner:
            raise HTTPException(status_code=403, detail="Only team admins can update branding")
        updates = []
        params = []
        if body.brand_color is not None:
            updates.append("brand_color=%s"); params.append(body.brand_color[:20])
        if body.brand_logo_url is not None:
            updates.append("brand_logo_url=%s"); params.append(body.brand_logo_url[:500])
        if body.brand_name is not None:
            updates.append("brand_name=%s"); params.append(body.brand_name[:120])
        if updates:
            params.append(team_id)
            cur.execute(f"UPDATE teams SET {', '.join(updates)} WHERE id=%s", params)
        cur.close()
    audit(email, "branding_updated", team_id)
    return {"status": "updated", "team_id": team_id}


@router.get("/api/teams/{team_id}/branding")
async def get_team_branding(team_id: str, email: str = Depends(verify_token)):
    with get_db() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
        "SELECT 1 FROM team_members WHERE team_id=%s AND email=%s", (team_id, email)
        )
        member = cur.fetchone()
        if not member:
            raise HTTPException(status_code=403, detail="Not a team member")
        cur.execute(
        "SELECT brand_color, brand_logo_url, brand_name FROM teams WHERE id=%s",
        (team_id,)
        )
        row = cur.fetchone()
        cur.close()
    if not row:
        raise HTTPException(status_code=404, detail="Team not found")
    return dict(row)


# ═══════════════════════════════════════════════════════════════════════════════
# Annotations
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/api/sessions/{session_id}/annotations")
async def add_annotation(session_id: str, body: AnnotationCreate, email: str = Depends(verify_token)):
    _check_session_owner(session_id, email)
    ann_id = str(uuid.uuid4())
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
        "INSERT INTO annotations (id,session_id,ref_type,ref_id,text,email,created_at) VALUES (%s,%s,%s,%s,%s,%s,%s)",
        (ann_id, session_id, body.ref_type, body.ref_id, body.text[:2000], email, datetime.now(timezone.utc).isoformat())
        )
        cur.close()
    return {"id": ann_id, "session_id": session_id, "ref_id": body.ref_id, "text": body.text, "email": email}


@router.get("/api/sessions/{session_id}/annotations")
async def get_annotations(session_id: str, email: str = Depends(verify_token)):
    _check_session_owner(session_id, email)
    with get_db() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
        "SELECT * FROM annotations WHERE session_id=%s ORDER BY created_at", (session_id,)
        )
        rows = cur.fetchall()
        cur.close()
    return [dict(r) for r in rows]


@router.delete("/api/sessions/{session_id}/annotations/{ann_id}")
async def delete_annotation(session_id: str, ann_id: str, email: str = Depends(verify_token)):
    _check_session_owner(session_id, email)
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
        "DELETE FROM annotations WHERE id=%s AND session_id=%s AND email=%s", (ann_id, session_id, email)
        )
        n = cur.rowcount
        cur.close()
    if not n:
        raise HTTPException(status_code=404, detail="Annotation not found")
    return {"status": "deleted"}


# ═══════════════════════════════════════════════════════════════════════════════
# Templates
# ═══════════════════════════════════════════════════════════════════════════════

BUILTIN_TEMPLATES = [
    {
        "id": "fintech",
        "name": "FinTech — Payment / Banking Feature",
        "industry": "FinTech",
        "title_hint": "AI-powered payment fraud detection",
        "description": (
            "A machine-learning feature that analyses transaction patterns in real time to detect "
            "and block fraudulent payments before they clear. The system scores each transaction "
            "(0–100 risk score) and automatically holds high-risk transactions for manual review."
        ),
    },
    {
        "id": "healthtech",
        "name": "HealthTech — Clinical / Patient Feature",
        "industry": "HealthTech",
        "title_hint": "AI clinical note summarisation assistant",
        "description": (
            "An NLP assistant embedded in the EHR system that auto-generates concise SOAP note "
            "summaries from physician dictations and structured data. Clinicians review and approve "
            "before notes are committed to the patient record."
        ),
    },
    {
        "id": "b2bsaas",
        "name": "B2B SaaS — Productivity Feature",
        "industry": "B2B SaaS",
        "title_hint": "AI-powered meeting summary and action-item extractor",
        "description": (
            "A feature that automatically joins scheduled video calls via a bot, transcribes "
            "the conversation in real time, and at the end of the call generates a structured "
            "summary with key decisions, open questions, and assigned action items with due dates."
        ),
    },
    {
        "id": "legal",
        "name": "LegalTech — Document / Compliance Feature",
        "industry": "LegalTech",
        "title_hint": "AI contract clause risk analyser",
        "description": (
            "An AI assistant that analyses uploaded contract PDFs and highlights non-standard, "
            "high-risk, or missing clauses compared to the firm's standard template library."
        ),
    },
]


@router.get("/api/templates")
async def list_templates():
    custom = _load_templates()
    return {"builtin": BUILTIN_TEMPLATES, "custom": custom}


@router.post("/api/templates")
async def create_template(body: TemplateCreate, email: str = Depends(verify_token)):
    templates = _load_templates()
    template = {
        "id": str(uuid.uuid4()),
        "name": body.name.strip()[:120],
        "category": (body.category or body.industry or "").strip()[:60],
        "title": body.title.strip()[:120] if body.title else "",
        "description": body.description.strip()[:2000],
        "tags": body.tags or [],
        "created_by": email,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    templates.append(template)
    _save_templates(templates)
    return template


@router.delete("/api/templates/{template_id}")
async def delete_template(template_id: str, email: str = Depends(verify_token)):
    templates = _load_templates()
    before = len(templates)
    templates = [t for t in templates if not (t["id"] == template_id and t.get("created_by") == email)]
    if len(templates) == before:
        raise HTTPException(status_code=404, detail="Template not found or access denied")
    _save_templates(templates)
    return {"status": "deleted"}
