"""Governance routes — sign-offs, gates, certificates, audit log."""
import json, uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends

import psycopg2.extras

from app.deps import (
    verify_token, require_admin, sessions, get_db, audit, send_email, logger,
    normalize_session, SESSIONS_DIR,
)
from app.models.schemas import SignOffRequest, GateCreate, GateEvaluateRequest
from app.domain.regulation_engine import get_session_regulation_assessment

router = APIRouter(prefix="/api", tags=["governance"])


def _resolve_session(session_id: str) -> dict:
    """Return session dict from memory, loading from disk if needed."""
    s = sessions.get(session_id)
    if s:
        return s
    final_path = SESSIONS_DIR / session_id / "final.json"
    if final_path.exists():
        import json as _json
        rec = _json.loads(final_path.read_text())
        flat = normalize_session(rec, session_id)
        sessions[session_id] = flat
        return flat
    return None


def _check_owner(session_data: dict, email: str):
    """Raise 403 unless the authenticated user owns this session."""
    owner = session_data.get("user_email")
    if not owner or owner != email:
        raise HTTPException(status_code=403, detail="Access denied")


# ═══════════════════════════════════════════════════════════════════════════════
# Sign-offs — role-based approval workflow
# ═══════════════════════════════════════════════════════════════════════════════

VALID_SIGN_OFF_ROLES = {"pm", "legal", "qa", "security"}

@router.post("/sessions/{session_id}/sign-off")
async def submit_sign_off(session_id: str, body: SignOffRequest, email: str = Depends(verify_token)):
    """Submit a sign-off (approval or rejection) for a session."""
    s = _resolve_session(session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    _check_owner(s, email)
    if body.role not in VALID_SIGN_OFF_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(VALID_SIGN_OFF_ROLES)}")
    if body.status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Status must be 'approved' or 'rejected'")

    now = datetime.now(timezone.utc).isoformat()
    with get_db() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
        "SELECT id FROM governance_signoffs WHERE session_id=%s AND role=%s",
        (session_id, body.role)
        )
        existing = cur.fetchone()
        if existing:
            cur.execute(
            "UPDATE governance_signoffs SET status=%s, user_email=%s, signed_at=%s, comment=%s WHERE id=%s",
            (body.status, email, now, body.comment, existing["id"])
        )
        else:
            cur.execute(
            """INSERT INTO governance_signoffs (id, session_id, role, status, user_email, signed_at, comment)
               VALUES (%s,%s,%s,%s,%s,%s,%s)""",
            (str(uuid.uuid4()), session_id, body.role, body.status, email, now, body.comment)
        )
        cur.close()

    audit(email, "sign_off", session_id, metadata={"role": body.role, "status": body.status})
    return {"session_id": session_id, "role": body.role, "status": body.status, "signed_by": email, "signed_at": now}


@router.get("/sessions/{session_id}/sign-offs")
async def list_sign_offs(session_id: str, email: str = Depends(verify_token)):
    """List all sign-offs for a session."""
    s = _resolve_session(session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    _check_owner(s, email)
    with get_db() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
        "SELECT * FROM governance_signoffs WHERE session_id=%s ORDER BY signed_at",
        (session_id,)
        )
        rows = cur.fetchall()
        cur.close()
    sign_offs = [dict(r) for r in rows]
    existing_roles = {so["role"] for so in sign_offs}
    for role in VALID_SIGN_OFF_ROLES:
        if role not in existing_roles:
            sign_offs.append({"role": role, "status": "pending", "user_email": None, "signed_at": None})
    return {"session_id": session_id, "sign_offs": sign_offs}


# ═══════════════════════════════════════════════════════════════════════════════
# Gates — CI/CD and PR check configurations
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/gates")
async def list_gates(email: str = Depends(verify_token)):
    with get_db() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM gate_configs ORDER BY updated_at DESC")
        rows = cur.fetchall()
        cur.close()
    return {"gates": [dict(r) for r in rows]}


@router.post("/gates")
async def create_gate(body: GateCreate, email: str = Depends(verify_token)):
    gate_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
        """INSERT INTO gate_configs (id, name, gate_type, min_score, required_signoffs, required_frameworks, active, updated_at)
           VALUES (%s,%s,%s,%s,%s,%s,1,%s)""",
        (gate_id, body.name, body.gate_type, body.min_score,
         json.dumps(body.required_sign_offs), json.dumps(body.required_frameworks), now)
        )
        cur.close()
    audit(email, "gate_created", gate_id, metadata={"min_score": body.min_score})
    return {"gate_id": gate_id, "name": body.name, "gate_type": body.gate_type, "min_score": body.min_score}


@router.post("/gates/{gate_id}/evaluate")
async def evaluate_gate(gate_id: str, body: GateEvaluateRequest, email: str = Depends(verify_token)):
    s = _resolve_session(body.session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    _check_owner(s, email)
    with get_db() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM gate_configs WHERE id=%s AND active=1", (gate_id,))
        gate = cur.fetchone()
        if not gate:
            raise HTTPException(status_code=404, detail="Gate not found or inactive")

        score_data = s.get("readiness_score") or {}
        session_score = score_data.get("score", 0) if isinstance(score_data, dict) else 0
        score_passed = session_score >= gate["min_score"]

        required_signoffs = json.loads(gate["required_signoffs"]) if gate["required_signoffs"] else []
        cur.execute(
        "SELECT role, status FROM governance_signoffs WHERE session_id=%s AND status='approved'",
        (body.session_id,)
        )
        sign_offs = cur.fetchall()
        approved_roles = {so["role"] for so in sign_offs}
        missing_signoffs = [r for r in required_signoffs if r not in approved_roles]
        signoffs_passed = len(missing_signoffs) == 0

        required_frameworks = json.loads(gate["required_frameworks"]) if gate["required_frameworks"] else []
        missing_frameworks = []
        if required_frameworks:
            cur.execute(
                """SELECT DISTINCT r.framework_id FROM risk_regulation_mappings rrm
                   JOIN requirements r ON rrm.requirement_id = r.id
                   WHERE rrm.session_id=%s""",
                (body.session_id,)
            )
            existing_mappings = cur.fetchall()
            assessed_fws = {m["framework_id"] for m in existing_mappings}
            missing_frameworks = [f for f in required_frameworks if f not in assessed_fws]
        frameworks_passed = len(missing_frameworks) == 0

        passed = score_passed and signoffs_passed and frameworks_passed

        cur.execute(
        """INSERT INTO gate_evaluations (id, gate_id, session_id, passed, score, missing_signoffs, missing_frameworks, evaluated_at)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s)""",
        (str(uuid.uuid4()), gate_id, body.session_id, int(passed), session_score,
         json.dumps(missing_signoffs), json.dumps(missing_frameworks), datetime.now(timezone.utc).isoformat())
        )
        cur.close()

    audit(email, "gate_evaluated", gate_id, metadata={"session_id": body.session_id, "passed": passed})

    return {
        "gate_id": gate_id,
        "session_id": body.session_id,
        "passed": passed,
        "score": session_score,
        "min_score": gate["min_score"],
        "score_passed": score_passed,
        "signoffs_passed": signoffs_passed,
        "missing_signoffs": missing_signoffs,
        "frameworks_passed": frameworks_passed,
        "missing_frameworks": missing_frameworks,
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Compliance Certificate — styled HTML generation
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/sessions/{session_id}/certificate")
async def generate_certificate(session_id: str, email: str = Depends(verify_token)):
    s = _resolve_session(session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    _check_owner(s, email)

    meta = s.get("session", s) if isinstance(s.get("session"), dict) else s
    status = meta.get("status", "unknown")
    if status not in ("complete",):
        raise HTTPException(
            status_code=409,
            detail=f"Cannot generate certificate: session status is '{status}'. Analysis must be complete.",
        )

    sign_offs = []
    try:
        with get_db() as conn:
            cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cur.execute(
                "SELECT * FROM governance_signoffs WHERE session_id=%s", (session_id,)
            )
            sign_offs = cur.fetchall()
            cur.close()
    except Exception:
        pass  # proceed with empty sign-offs

    reg_assessment = get_session_regulation_assessment(session_id)

    score_data = meta.get("readiness_score") or s.get("readiness_score") or {}
    cert_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    score = score_data.get("score") if isinstance(score_data, dict) else score_data
    grade = score_data.get("grade") if isinstance(score_data, dict) else None
    decision = score_data.get("decision") if isinstance(score_data, dict) else None

    sign_off_rows = ""
    for so_d in sign_offs:
        badge_color = "#22c55e" if so_d.get("status") == "approved" else "#f59e0b"
        sign_off_rows += f"""<tr>
            <td>{so_d.get('role', '').upper()}</td>
            <td><span style="color:{badge_color};font-weight:700">{so_d.get('status', 'pending').upper()}</span></td>
            <td>{so_d.get('user_email', '—')}</td>
            <td>{so_d.get('signed_at', '—')[:19] if so_d.get('signed_at') else '—'}</td>
        </tr>"""

    framework_rows = ""
    for m in reg_assessment.get("mappings", []):
        framework_rows += f"""<tr>
            <td>{m.get('framework', '')}</td>
            <td>{m.get('requirement', '')}</td>
            <td>{m.get('status', 'assessed')}</td>
        </tr>"""

    decision_display = decision or ("GO" if (score or 0) >= 70 else "NO-GO")
    decision_color = "#22c55e" if decision_display == "GO" else "#ef4444"
    grade_display = grade or "?"
    score_display = score if score is not None else 0

    feature_title = meta.get("feature_title", s.get("feature_title", "Untitled"))
    created_at = meta.get("created_at", "")[:19]

    certificate = {
        "certificate_id": cert_id,
        "session_id": session_id,
        "feature_title": feature_title,
        "generated_at": now,
        "generated_by": email,
        "readiness_score": score,
        "grade": grade,
        "decision": decision_display,
        "sign_offs": [dict(so) for so in sign_offs],
        "regulation_assessment": reg_assessment,
        "frameworks_assessed": [m.get("framework", "") for m in reg_assessment.get("mappings", [])],
        "status": "issued",
        "html": f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>LaunchGuard Compliance Certificate — {cert_id[:8]}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
  *{{margin:0;padding:0;box-sizing:border-box}}
  body{{font-family:'Inter',system-ui,sans-serif;background:#0f0f1a;color:#e2e8f0;padding:40px 20px}}
  .cert{{max-width:800px;margin:0 auto;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);border:1px solid #334155;border-radius:16px;overflow:hidden}}
  .cert-header{{background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:40px;text-align:center}}
  .cert-header h1{{font-size:28px;font-weight:800;color:#fff;letter-spacing:-0.5px}}
  .cert-header .subtitle{{font-size:14px;color:rgba(255,255,255,0.8);margin-top:6px}}
  .cert-header .cert-id{{font-size:11px;color:rgba(255,255,255,0.6);margin-top:12px;font-family:monospace}}
  .cert-body{{padding:32px 40px}}
  .meta-grid{{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:28px}}
  .meta-item label{{display:block;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;font-weight:600;margin-bottom:4px}}
  .meta-item span{{font-size:15px;font-weight:600;color:#f1f5f9}}
  .score-panel{{display:flex;align-items:center;justify-content:center;gap:40px;padding:28px;background:#0f172a;border-radius:12px;margin-bottom:28px;border:1px solid #334155}}
  .score-circle{{width:100px;height:100px;border-radius:50%;border:4px solid {decision_color};display:flex;flex-direction:column;align-items:center;justify-content:center}}
  .score-circle .number{{font-size:32px;font-weight:800;color:{decision_color}}}
  .score-circle .label{{font-size:10px;color:#94a3b8;text-transform:uppercase}}
  .verdict{{text-align:center}}
  .verdict .grade{{font-size:48px;font-weight:800;color:{decision_color}}}
  .verdict .decision{{font-size:18px;font-weight:700;color:{decision_color};text-transform:uppercase;letter-spacing:2px}}
  h2{{font-size:16px;font-weight:700;margin-bottom:12px;color:#e2e8f0;padding-bottom:6px;border-bottom:1px solid #334155}}
  table{{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px}}
  th{{background:#1e293b;padding:8px 12px;text-align:left;font-weight:600;color:#94a3b8;text-transform:uppercase;font-size:10px;letter-spacing:0.5px}}
  td{{padding:8px 12px;border-bottom:1px solid #1e293b;color:#cbd5e1}}
  .cert-footer{{padding:20px 40px;background:#0f172a;border-top:1px solid #334155;text-align:center;font-size:11px;color:#64748b}}
  .stamp{{display:inline-block;border:2px solid {decision_color};color:{decision_color};padding:6px 20px;border-radius:4px;font-size:14px;font-weight:800;letter-spacing:3px;transform:rotate(-3deg);margin-top:12px}}
  @media print{{body{{background:#fff;color:#1e293b;padding:20px}}.cert{{border:2px solid #e2e8f0;background:#fff}}.cert-header{{background:#6366f1;-webkit-print-color-adjust:exact;print-color-adjust:exact}}.cert-body{{padding:24px 32px}}h2{{color:#1e293b}}td{{color:#334155}}.score-panel{{background:#f8fafc;border:1px solid #e2e8f0}}.cert-footer{{background:#f8fafc}}th{{background:#f1f5f9;-webkit-print-color-adjust:exact;print-color-adjust:exact}}}}
</style>
</head>
<body>
<div class="cert">
  <div class="cert-header">
    <h1>🛡 LaunchGuard Compliance Certificate</h1>
    <div class="subtitle">AI Release Readiness Certification</div>
    <div class="cert-id">Certificate ID: {cert_id}</div>
  </div>
  <div class="cert-body">
    <div class="meta-grid">
      <div class="meta-item"><label>Feature</label><span>{feature_title}</span></div>
      <div class="meta-item"><label>Session</label><span>{session_id[:12]}…</span></div>
      <div class="meta-item"><label>Generated</label><span>{now[:19].replace('T',' ')}</span></div>
      <div class="meta-item"><label>Issued By</label><span>{email}</span></div>
    </div>
    <div class="score-panel">
      <div class="score-circle">
        <div class="number">{score_display}</div>
        <div class="label">/ 100</div>
      </div>
      <div class="verdict">
        <div class="grade">Grade {grade_display}</div>
        <div class="decision">{decision_display}</div>
      </div>
    </div>
    <h2>✍️ Sign-Off Status</h2>
    <table>
      <tr><th>Role</th><th>Status</th><th>Signed By</th><th>Date</th></tr>
      {sign_off_rows if sign_off_rows else '<tr><td colspan="4" style="text-align:center;color:#64748b">No sign-offs recorded</td></tr>'}
    </table>
    {f'<h2>📋 Regulatory Frameworks</h2><table><tr><th>Framework</th><th>Requirement</th><th>Status</th></tr>{framework_rows}</table>' if framework_rows else ''}
    <div style="text-align:center;margin-top:24px">
      <div class="stamp">{decision_display}</div>
    </div>
  </div>
  <div class="cert-footer">
    This certificate was generated by LaunchGuard AI Release Governance Platform.<br/>
    Session created: {created_at} · Certificate issued: {now[:19].replace('T',' ')} UTC
  </div>
</div>
</body>
</html>""",
    }

    audit(email, "certificate_generated", session_id, metadata={"cert_id": cert_id})
    return certificate


# ═══════════════════════════════════════════════════════════════════════════════
# Audit log
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/audit")
async def get_audit_log(limit: int = 100, email: str = Depends(require_admin)):
    with get_db() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
        "SELECT * FROM audit_log ORDER BY created_at DESC LIMIT %s", (min(limit, 1000),)
        )
        rows = cur.fetchall()
        cur.close()
    return {"audit_log": [dict(r) for r in rows]}
