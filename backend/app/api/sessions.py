"""Session routes — CRUD, pipeline execution, export, compare, versions, heatmap."""
import io, re, json, uuid, hashlib, zipfile
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, BackgroundTasks, Request, Depends, Body
from fastapi.responses import StreamingResponse, FileResponse

from app.deps import (
    sessions, logger,
    verify_token, check_rate_limit, check_user_rate_limit,
    sanitize_input, detect_pii, get_db, audit,
    load_users_cached, load_share_tokens, save_share_tokens, send_email,
    load_session_state, list_sessions_for_user, persist_session_state,
    get_user_integration_settings, apply_integration_patch,
)
from app.models.schemas import SessionCreate, IntegrationConfig
from app.infra.config import (
    SESSIONS_DIR, MOCK_DIR, DOWNLOADS_DIR,
)
from app.domain.scoring import compute_readiness_score
from app.domain.blockers import derive_blockers
from app.domain.regulation_mapping import map_compliance
from app.domain.diff import session_diff
from app.domain.evidence_pack import build_evidence_pack
from app.domain.agent_execution import create_agent_run, get_agent_run

router = APIRouter(tags=["sessions"])

# lazy import: pipeline runner is set by main.py at startup
_run_pipeline = None

def set_pipeline_runner(fn):
    global _run_pipeline
    _run_pipeline = fn


# ── helpers ───────────────────────────────────────────────────────────────────

def _check_session_owner(session_data: dict, email: str):
    """Raise 403 if the authenticated user does not own this session."""
    meta = session_data.get("session") or session_data
    owner = meta.get("user_email")
    if not owner or owner != email:
        raise HTTPException(status_code=403, detail="Access denied")


def _shares_team(owner_email: str, email: str) -> bool:
    if not owner_email or not email:
        return False
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT 1
            FROM team_members owner
            JOIN team_members member ON member.team_id=owner.team_id
            WHERE owner.email=%s AND member.email=%s
            LIMIT 1
            """,
            (owner_email, email),
        )
        row = cur.fetchone()
        cur.close()
    return bool(row)


def _check_session_access(session_data: dict, email: str):
    meta = session_data.get("session") or session_data
    owner = meta.get("user_email")
    if owner == email or _shares_team(owner, email):
        return
    raise HTTPException(status_code=403, detail="Access denied")


def _accessible_session_owner_emails(email: str) -> list[str]:
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT DISTINCT owner.email
            FROM team_members member
            JOIN team_members owner ON owner.team_id=member.team_id
            WHERE member.email=%s
            """,
            (email,),
        )
        rows = cur.fetchall()
        cur.close()
    owners = {email}
    owners.update(row[0] for row in rows if row and row[0])
    return sorted(owners)


def _get_next_version(feature_title: str, user_email: Optional[str]) -> int:
    title_lower = feature_title.lower().strip()
    max_v = 0
    # 1. Check in-memory sessions
    for s in sessions.values():
        if s.get("feature_title", "").lower().strip() == title_lower:
            if user_email is None or s.get("user_email") == user_email:
                max_v = max(max_v, s.get("version", 1))
    # 2. Check database
    try:
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT COALESCE(MAX(version), 0) FROM sessions_db WHERE LOWER(TRIM(feature_title))=%s"
                + (" AND user_email=%s" if user_email else ""),
                (title_lower, user_email) if user_email else (title_lower,),
            )
            db_max = cur.fetchone()[0] or 0
            cur.close()
        max_v = max(max_v, db_max)
    except Exception:
        pass
    # 3. Check disk (final.json files)
    if SESSIONS_DIR.exists():
        for f in SESSIONS_DIR.glob("*/final.json"):
            try:
                rec = json.loads(f.read_text())
                s = rec.get("session", {})
                if s.get("feature_title", "").lower().strip() == title_lower:
                    if user_email is None or s.get("user_email") == user_email:
                        max_v = max(max_v, s.get("version", 1))
            except Exception:
                pass
    return max_v + 1


def _load_session(session_id: str) -> dict:
    """Load session from memory or disk; raise 404 if not found."""
    s = load_session_state(session_id)
    if s:
        return {
            "session": {
                "id": s["id"],
                "feature_title": s["feature_title"],
                "feature_description": s.get("feature_description", ""),
                "status": s["status"],
                "created_at": s["created_at"],
                "completed_at": s.get("completed_at"),
                "readiness_score": s.get("readiness_score"),
                "parent_session_id": s.get("parent_session_id"),
                "version": s.get("version", 1),
                "user_email": s.get("user_email"),
                "integrations": s.get("integrations", {}),
                "validation_warnings": s.get("validation_warnings", []),
                "pii_detected": s.get("pii_detected", []),
            },
            "navigator": s.get("navigator") or {},
            "sentinel": s.get("sentinel") or {},
            "herald": s.get("herald") or {},
            "error": s.get("error"),
            "agent_run": s.get("agent_run") or get_agent_run(session_id),
        }
    raise HTTPException(status_code=404, detail="Session not found")


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.post("/api/sessions")
async def create_session(
    body: SessionCreate,
    background_tasks: BackgroundTasks,
    request: Request,
    email: str = Depends(verify_token),
):
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Too many requests. Please wait a moment before trying again.")

    if not check_user_rate_limit(email):
        raise HTTPException(status_code=429, detail="User rate limit exceeded.")

    body.feature_title       = sanitize_input(body.feature_title,       "feature_title")
    body.feature_description = sanitize_input(body.feature_description, "feature_description")

    full_input = f"{body.feature_title} {body.feature_description}"
    pii_found = detect_pii(full_input)
    integration_defaults = get_user_integration_settings(email)

    session_id = str(uuid.uuid4())
    sessions[session_id] = {
        "id": session_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "feature_title": body.feature_title,
        "feature_description": body.feature_description,
        "status": "pending",
        "navigator": None, "sentinel": None, "herald": None, "error": None,
        "user_email": email,
        "pii_detected": pii_found,
        "validation_warnings": [],
        "readiness_score": None,
        "parent_session_id": body.parent_session_id,
        "version": _get_next_version(body.feature_title, email),
        "integrations": integration_defaults,
    }
    persist_session_state(session_id)
    create_agent_run(session_id, body.feature_title, body.feature_description, email)
    background_tasks.add_task(_run_pipeline, session_id, body.feature_title, body.feature_description)
    response = {"session_id": session_id, "status": "created"}
    if pii_found:
        response["pii_warning"] = f"Possible PII detected ({', '.join(pii_found)})."
    return response


@router.get("/api/sessions/{session_id}")
async def get_session(session_id: str, email: str = Depends(verify_token)):
    data = _load_session(session_id)
    _check_session_access(data, email)
    return data


@router.get("/api/sessions/{session_id}/agent-run")
async def get_session_agent_run(session_id: str, email: str = Depends(verify_token)):
    data = _load_session(session_id)
    _check_session_access(data, email)
    return get_agent_run(session_id)


@router.get("/api/sessions")
async def list_sessions(email: str = Depends(verify_token)):
    combined = {}
    for owner_email in _accessible_session_owner_emails(email):
        for session_data in list_sessions_for_user(owner_email):
            combined[session_data.get("id")] = session_data
    return sorted(combined.values(), key=lambda item: item.get("created_at") or "", reverse=True)


@router.get("/api/history")
async def get_history(email: str = Depends(verify_token)):
    history = []
    for session_data in list_sessions_for_user(email):
        navigator = session_data.get("navigator") or {}
        sentinel = session_data.get("sentinel") or {}
        history.append({
            "id": session_data.get("id"),
            "feature_title": session_data.get("feature_title"),
            "created_at": session_data.get("created_at"),
            "completed_at": session_data.get("completed_at"),
            "status": session_data.get("status"),
            "pii_detected": session_data.get("pii_detected", []),
            "validation_warnings": session_data.get("validation_warnings", []),
            "risk_count": len((navigator.get("risk_register", {}).get("risks") or [])),
            "test_count": len((sentinel.get("test_cases", {}).get("test_cases") or [])),
        })
    return history


# ── Mock sessions ─────────────────────────────────────────────────────────────

@router.get("/api/mock/sessions")
async def list_mock_sessions():
    mocks = []
    for f in sorted(MOCK_DIR.glob("session_*.json")):
        mocks.append(json.loads(f.read_text()))
    return mocks


@router.get("/api/mock/sessions/{mock_id}")
async def get_mock_session(mock_id: str):
    mock_file = MOCK_DIR / f"session_{mock_id}.json"
    if not mock_file.exists():
        raise HTTPException(status_code=404, detail=f"Mock session '{mock_id}' not found")
    return json.loads(mock_file.read_text())


# ── Export ────────────────────────────────────────────────────────────────────

@router.get("/api/sessions/{session_id}/export")
async def export_session(session_id: str, email: str = Depends(verify_token)):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    s = sessions[session_id]
    _check_session_owner(s, email)
    if s["status"] != "complete":
        raise HTTPException(status_code=400, detail="Session not yet complete")
    nav  = s.get("navigator") or {}
    sen  = s.get("sentinel") or {}
    her  = s.get("herald") or {}
    meta = {"id": s["id"], "feature_title": s["feature_title"],
            "feature_description": s.get("feature_description", ""),
            "status": s["status"], "created_at": s["created_at"]}
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("navigator.json", json.dumps(nav, indent=2))
        zf.writestr("sentinel.json",  json.dumps(sen, indent=2))
        zf.writestr("herald.json",    json.dumps(her, indent=2))
        zf.writestr("final.json", json.dumps(
            {"session": meta, "navigator": nav, "sentinel": sen, "herald": her}, indent=2))
        zf.writestr("README.txt",
            f"ReleaseOps Readiness Package\n{'='*30}\n"
            f"Feature : {s['feature_title']}\nSession : {session_id}\nCreated : {s['created_at']}\n")
    buf.seek(0)
    safe = re.sub(r"[^a-zA-Z0-9_-]", "_", s["feature_title"])[:40]
    return StreamingResponse(buf, media_type="application/zip",
                             headers={"Content-Disposition": f'attachment; filename="{safe}_readiness_package.zip"'})


@router.get("/api/sessions/{session_id}/export/pdf")
async def export_pdf(session_id: str, email: str = Depends(verify_token)):
    s = None
    if session_id in sessions:
        s = sessions[session_id]
    else:
        fp = SESSIONS_DIR / session_id / "final.json"
        if fp.exists():
            s = json.loads(fp.read_text())
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    _check_session_owner(s, email)
    meta  = s.get("session") or s
    nav   = s.get("navigator") or {}
    sen   = s.get("sentinel") or {}
    score = (meta.get("readiness_score") or {})
    risks = (nav.get("risk_register") or {}).get("risks", [])
    chk   = (nav.get("readiness_checklist") or {}).get("checklist", [])
    tests = (sen.get("test_cases") or {}).get("test_cases", [])

    html = f"""<!DOCTYPE html><html><head><meta charset="UTF-8"/>
    <style>body{{font-family:Arial,sans-serif;font-size:12px;color:#1e293b;margin:40px;}}
    h1{{font-size:22px;color:#6366f1;border-bottom:2px solid #6366f1;padding-bottom:8px;}}
    h2{{font-size:15px;color:#334155;margin-top:20px;}}
    table{{width:100%;border-collapse:collapse;margin-top:8px;font-size:11px;}}
    th{{background:#f1f5f9;padding:6px 8px;text-align:left;border:1px solid #e2e8f0;}}
    td{{padding:5px 8px;border:1px solid #e2e8f0;}}</style></head><body>
    <h1>ReleaseOps — Release Readiness Report</h1>
    <p>Feature: <strong>{meta.get('feature_title','')}</strong> | Session: {meta.get('id','')[:8]}</p>"""
    if score:
        html += f"<p>Score: <strong>{score.get('score',0)}/100 — Grade {score.get('grade','?')}</strong></p>"
    if risks:
        html += f"<h2>Risk Register ({len(risks)})</h2><table><tr><th>ID</th><th>Title</th><th>Severity</th><th>Category</th></tr>"
        for r in risks:
            html += f"<tr><td>{r.get('id','')}</td><td>{r.get('title','')}</td><td>{r.get('severity','')}</td><td>{r.get('category','')}</td></tr>"
        html += "</table>"
    if chk:
        html += f"<h2>Checklist ({len(chk)})</h2><table><tr><th>Priority</th><th>Item</th><th>Owner</th></tr>"
        for c in chk:
            html += f"<tr><td>{c.get('priority','')}</td><td>{c.get('item','')}</td><td>{c.get('owner_role','')}</td></tr>"
        html += "</table>"
    html += "</body></html>"
    return StreamingResponse(io.BytesIO(html.encode()), media_type="text/html",
                             headers={"Content-Disposition": f"attachment; filename=releaseops_{session_id[:8]}.html"})


@router.get("/api/sessions/{session_id}/export/evidence")
async def export_evidence_pack(session_id: str, email: str = Depends(verify_token)):
    payload = _load_session(session_id)
    _check_session_owner(payload, email)
    buf = build_evidence_pack(payload)
    safe = re.sub(r"[^a-zA-Z0-9_-]", "_", (payload.get("session", {}).get("feature_title") or "lg"))[:40]
    return StreamingResponse(buf, media_type="application/zip",
                             headers={"Content-Disposition": f'attachment; filename="{safe}_evidence_pack.zip"'})


@router.get("/api/download/codebase")
async def download_codebase():
    zip_path = DOWNLOADS_DIR / "releaseops_codebase.zip"
    if not zip_path.exists():
        raise HTTPException(status_code=404, detail="Codebase zip not found")
    return FileResponse(path=str(zip_path), media_type="application/zip", filename="releaseops_codebase.zip")


# ── V2 endpoints ──────────────────────────────────────────────────────────────

@router.get("/api/sessions/{session_id}/v2/summary")
async def v2_summary(session_id: str, email: str = Depends(verify_token)):
    payload = _load_session(session_id)
    _check_session_owner(payload, email)
    nav = payload.get("navigator", {}) or {}
    sen = payload.get("sentinel", {}) or {}
    score = payload.get("session", {}).get("readiness_score")
    if not isinstance(score, dict):
        score = compute_readiness_score(nav, sen)
    blockers = derive_blockers(nav, sen)
    compliance = map_compliance(nav, sen)
    return {"session": payload.get("session", {}), "readiness_score": score, "blockers": blockers, "compliance": compliance}


@router.get("/api/sessions/{session_id}/v2/diff")
async def v2_diff(session_id: str, email: str = Depends(verify_token)):
    curr = _load_session(session_id)
    _check_session_owner(curr, email)
    title_lower = (curr.get("session", {}).get("feature_title", "") or "").lower().strip()
    curr_version = curr.get("session", {}).get("version", 1)
    prev = None
    for f in sorted(SESSIONS_DIR.glob("*/final.json"), reverse=True):
        try:
            rec = json.loads(f.read_text())
            s = rec.get("session", {})
            if s.get("feature_title", "").lower().strip() == title_lower and s.get("id") != session_id and s.get("user_email") == email:
                if s.get("version") == max(1, curr_version - 1):
                    prev = rec
                    break
                if prev is None:
                    prev = rec
        except Exception:
            continue
    if prev is None:
        return {"message": "No previous version found", "diff": None}
    return {"diff": session_diff(prev, curr)}


@router.get("/api/sessions/{session_id}/v2/compliance")
async def v2_compliance(session_id: str, email: str = Depends(verify_token)):
    payload = _load_session(session_id)
    _check_session_owner(payload, email)
    nav = payload.get("navigator", {}) or {}
    sen = payload.get("sentinel", {}) or {}
    return map_compliance(nav, sen)


# ── Share ─────────────────────────────────────────────────────────────────────

@router.post("/api/sessions/{session_id}/share")
async def create_share_link(session_id: str, request: Request, email: str = Depends(verify_token)):
    payload = _load_session(session_id)
    _check_session_owner(payload, email)
    tokens = load_share_tokens()
    for tok, sid in tokens.items():
        if sid == session_id:
            base = str(request.base_url).rstrip("/")
            return {"share_url": f"{base}/shared/{tok}", "token": tok}
    token = hashlib.sha256(f"{session_id}{uuid.uuid4()}".encode()).hexdigest()[:32]
    tokens[token] = session_id
    save_share_tokens(tokens)
    base = str(request.base_url).rstrip("/")
    return {"share_url": f"{base}/shared/{token}", "token": token}


@router.get("/api/shared/{token}")
async def get_shared_session(token: str):
    tokens = load_share_tokens()
    session_id = tokens.get(token)
    if not session_id:
        raise HTTPException(status_code=404, detail="Share link not found")
    return _load_session(session_id)


# ── Integrations patch ────────────────────────────────────────────────────────

@router.patch("/api/sessions/{session_id}/integrations")
async def set_integrations(session_id: str, body: IntegrationConfig, email: str = Depends(verify_token)):
    session_data = load_session_state(session_id)
    if not session_data:
        raise HTTPException(status_code=404, detail="Session not found")
    _check_session_owner(session_data, email)
    merged = apply_integration_patch(session_data.get("integrations"), body.model_dump(exclude_unset=True))
    session_data["integrations"] = merged
    sessions[session_id] = session_data
    persist_session_state(session_id)
    return {"status": "ok", "integrations": merged}


@router.get("/api/sessions/{session_id}/integrations")
async def get_integrations(session_id: str, email: str = Depends(verify_token)):
    session_data = load_session_state(session_id)
    if not session_data:
        raise HTTPException(status_code=404, detail="Session not found")
    _check_session_owner(session_data, email)
    return {"integrations": session_data.get("integrations") or {}}


# ── Trends ────────────────────────────────────────────────────────────────────

@router.get("/api/trends")
async def get_trends(email: str = Depends(verify_token)):
    if not SESSIONS_DIR.exists():
        return {"sessions": []}
    trend = []
    for f in sorted(SESSIONS_DIR.glob("*/final.json")):
        try:
            rec = json.loads(f.read_text())
            s = rec.get("session", {})
            if s.get("user_email") != email:
                continue
            nav = rec.get("navigator", {})
            sen = rec.get("sentinel", {})
            score = s.get("readiness_score") or compute_readiness_score(nav, sen)
            trend.append({
                "session_id":    s.get("id", ""),
                "feature_title": s.get("feature_title", ""),
                "created_at":    s.get("created_at", ""),
                "version":       s.get("version", 1),
                "score":         score.get("score", 0),
                "grade":         score.get("grade", "?"),
                "high_risks":    score.get("summary", {}).get("high_risks", 0),
            })
        except Exception:
            pass
    return {"sessions": sorted(trend, key=lambda x: x["created_at"])}


# ── Versions ──────────────────────────────────────────────────────────────────

@router.get("/api/sessions/{session_id}/versions")
async def get_versions(session_id: str, email: str = Depends(verify_token)):
    # Load current session from memory, DB, or disk
    source = load_session_state(session_id)
    if not source:
        final_path = SESSIONS_DIR / session_id / "final.json"
        if final_path.exists():
            rec = json.loads(final_path.read_text())
            source = rec.get("session", rec)
        else:
            raise HTTPException(status_code=404, detail="Session not found")

    # Determine ownership and title
    source_meta = source.get("session", source) if isinstance(source.get("session"), dict) else source
    owner = source_meta.get("user_email")
    if owner and owner != email:
        raise HTTPException(status_code=403, detail="Access denied")
    title_lower = source_meta.get("feature_title", "").lower().strip()
    feature_title_display = source_meta.get("feature_title", "")

    seen_ids = set()
    versions = []

    def _add_version(sid, feat_title, ver, created, score_data, nav=None, sen=None):
        if sid in seen_ids:
            return
        if feat_title.lower().strip() != title_lower:
            return
        seen_ids.add(sid)
        score = score_data if isinstance(score_data, dict) else {}
        if not score and nav and sen:
            score = compute_readiness_score(nav, sen)
        versions.append({
            "session_id": sid,
            "version": ver or 1,
            "created_at": created or "",
            "score": score.get("score", 0) if isinstance(score, dict) else 0,
            "grade": score.get("grade", "?") if isinstance(score, dict) else "?",
        })

    # 1. In-memory sessions
    for sid, s in sessions.items():
        if s.get("user_email") != email:
            continue
        _add_version(sid, s.get("feature_title", ""), s.get("version", 1),
                     s.get("created_at"), s.get("readiness_score"),
                     s.get("navigator"), s.get("sentinel"))

    # 2. Database
    try:
        with get_db() as conn:
            cur = conn.cursor(cursor_factory=__import__("psycopg2").extras.RealDictCursor)
            cur.execute(
                "SELECT id, feature_title, version, created_at, readiness_score, "
                "navigator_data, sentinel_data FROM sessions_db "
                "WHERE LOWER(TRIM(feature_title))=%s AND user_email=%s",
                (title_lower, email),
            )
            for row in cur.fetchall():
                nav = json.loads(row["navigator_data"]) if row.get("navigator_data") else None
                sen = json.loads(row["sentinel_data"]) if row.get("sentinel_data") else None
                sc = json.loads(row["readiness_score"]) if row.get("readiness_score") else None
                _add_version(row["id"], row["feature_title"], row.get("version", 1),
                             row.get("created_at"), sc, nav, sen)
            cur.close()
    except Exception:
        pass

    # 3. Disk (final.json files)
    if SESSIONS_DIR.exists():
        for f in sorted(SESSIONS_DIR.glob("*/final.json"), reverse=True):
            try:
                r = json.loads(f.read_text())
                s = r.get("session", {})
                if s.get("user_email") != email:
                    continue
                nav = r.get("navigator", {})
                sen = r.get("sentinel", {})
                score = s.get("readiness_score") or compute_readiness_score(nav, sen)
                _add_version(s.get("id", ""), s.get("feature_title", ""),
                             s.get("version", 1), s.get("created_at"), score, nav, sen)
            except Exception:
                pass

    versions.sort(key=lambda v: v["version"])
    return {"feature_title": feature_title_display, "versions": versions}


# ── Reanalyze ─────────────────────────────────────────────────────────────────

@router.post("/api/sessions/{session_id}/analyze")
async def reanalyze(
    session_id: str,
    background_tasks: BackgroundTasks,
    body: Optional[Dict[str, Any]] = Body(None),
    email: str = Depends(verify_token),
):
    source = None
    source_integrations = {}
    # Try memory, then DB, then disk via load_session_state
    s = load_session_state(session_id)
    if s:
        _check_session_owner(s if not s.get("session") else s, email)
        meta = s.get("session", s) if isinstance(s.get("session"), dict) else s
        source = {"feature_title": meta.get("feature_title", ""), "feature_description": meta.get("feature_description", "")}
        source_integrations = meta.get("integrations") or {}
    else:
        final_path = SESSIONS_DIR / session_id / "final.json"
        if final_path.exists():
            rec = json.loads(final_path.read_text())
            _check_session_owner(rec, email)
            s_data = rec.get("session", {})
            source = {"feature_title": s_data.get("feature_title", ""), "feature_description": s_data.get("feature_description", "")}
            source_integrations = s_data.get("integrations") or {}
    if not source:
        raise HTTPException(status_code=404, detail="Source session not found")

    new_title = (body or {}).get("feature_title", source["feature_title"])
    new_desc  = (body or {}).get("feature_description", source["feature_description"])
    new_title = sanitize_input(new_title, "feature_title")
    new_desc  = sanitize_input(new_desc,  "feature_description")
    integration_defaults = apply_integration_patch(get_user_integration_settings(email), source_integrations)

    new_version = _get_next_version(new_title, email)
    new_id = str(uuid.uuid4())
    sessions[new_id] = {
        "id": new_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "feature_title": new_title,
        "feature_description": new_desc,
        "status": "pending",
        "navigator": None, "sentinel": None, "herald": None, "error": None,
        "user_email": email,
        "pii_detected": [],
        "validation_warnings": [],
        "readiness_score": None,
        "parent_session_id": session_id,
        "version": new_version,
        "integrations": integration_defaults,
    }
    persist_session_state(new_id)
    create_agent_run(new_id, new_title, new_desc, email)
    background_tasks.add_task(_run_pipeline, new_id, new_title, new_desc)
    return {
        "session_id": new_id,
        "status": "created",
        "parent_session_id": session_id,
        "feature_title": new_title,
        "version": new_version,
    }


# ── Compare ───────────────────────────────────────────────────────────────────

@router.get("/api/compare")
async def compare_sessions(a: str, b: str, email: str = Depends(verify_token)):
    def _load(sid):
        if sid in sessions:
            return sessions[sid]
        fp = SESSIONS_DIR / sid / "final.json"
        if fp.exists():
            return json.loads(fp.read_text())
        raise HTTPException(status_code=404, detail=f"Session {sid} not found")

    sa, sb = _load(a), _load(b)
    _check_session_owner(sa, email)
    _check_session_owner(sb, email)

    def _extract(s):
        nav = s.get("navigator") or {}
        sen = s.get("sentinel") or {}
        meta = s.get("session") or s
        return {
            "id":            meta.get("id", ""),
            "feature_title": meta.get("feature_title", ""),
            "created_at":    meta.get("created_at", ""),
            "score":         (meta.get("readiness_score") or {}).get("score"),
            "grade":         (meta.get("readiness_score") or {}).get("grade"),
            "risks":         (nav.get("risk_register") or {}).get("risks", []),
            "checklist":     (nav.get("readiness_checklist") or {}).get("checklist", []),
            "test_cases":    (sen.get("test_cases") or {}).get("test_cases", []),
        }

    return {"a": _extract(sa), "b": _extract(sb)}


# ── Heatmap ───────────────────────────────────────────────────────────────────

@router.get("/api/sessions/{session_id}/heatmap")
async def get_risk_heatmap(session_id: str, email: str = Depends(verify_token)):
    s = None
    if session_id in sessions:
        s = sessions[session_id]
    else:
        fp = SESSIONS_DIR / session_id / "final.json"
        if fp.exists():
            s = json.loads(fp.read_text())
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    _check_session_owner(s, email)
    nav   = s.get("navigator") or {}
    risks = (nav.get("risk_register") or {}).get("risks", [])
    levels = ["Low", "Medium", "High"]
    matrix = {lik: {imp: [] for imp in levels} for lik in levels}
    for r in risks:
        lik = r.get("likelihood", "Medium")
        imp = r.get("impact", "Medium")
        if lik in levels and imp in levels:
            matrix[lik][imp].append({"id": r.get("id", ""), "title": r.get("title", ""),
                                     "severity": r.get("severity", ""), "category": r.get("category", "")})
    return {
        "session_id": session_id,
        "feature_title": (s.get("session") or s).get("feature_title", ""),
        "matrix": matrix, "levels": levels, "total_risks": len(risks),
        "summary": {
            "high":   sum(1 for r in risks if r.get("severity") == "High"),
            "medium": sum(1 for r in risks if r.get("severity") == "Medium"),
            "low":    sum(1 for r in risks if r.get("severity") == "Low"),
        },
    }


# ── Email notification ────────────────────────────────────────────────────────

@router.post("/api/sessions/{session_id}/notify")
async def notify_by_email(session_id: str, email: str = Depends(verify_token)):
    s = sessions.get(session_id)
    if not s:
        fp = SESSIONS_DIR / session_id / "final.json"
        if fp.exists():
            s = json.loads(fp.read_text())
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    meta  = s.get("session") or s
    score = (meta.get("readiness_score") or {})
    nav   = s.get("navigator") or {}
    risks = (nav.get("risk_register") or {}).get("risks", [])
    html = f"""<html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
    <div style="background:#6366f1;color:white;padding:20px;border-radius:8px 8px 0 0;">
      <h1 style="margin:0;font-size:20px;">ReleaseOps Report Ready</h1></div>
    <div style="padding:20px;background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
      <h2 style="color:#6366f1;">{meta.get('feature_title','')}</h2>
      <p>Score: <strong>{score.get('score','N/A')}/100 — Grade {score.get('grade','?')}</strong></p>
      <p>{len(risks)} risks identified.</p></div></body></html>"""
    ok = send_email(email, f"ReleaseOps Report: {meta.get('feature_title','')}", html)
    return {"sent": ok}
