"""Regulation Engine API routes — frameworks, requirements, compliance mapping."""
import json
from fastapi import APIRouter, HTTPException, Depends

from app.deps import verify_token, sessions, get_db, audit, normalize_session, SESSIONS_DIR
from app.domain.regulation_engine import (
    get_frameworks, get_framework_detail, get_framework_requirements,
    get_session_regulation_assessment, get_regulation_updates,
    map_risks_to_regulations, classify_eu_ai_act_risk,
    COMPLIANCE_TEMPLATES,
)

router = APIRouter(prefix="/api", tags=["regulation"])


def _resolve_session(session_id: str) -> dict:
    """Return session dict from memory, loading from disk if needed."""
    s = sessions.get(session_id)
    if s:
        return s
    from pathlib import Path
    final_path = SESSIONS_DIR / session_id / "final.json"
    if final_path.exists():
        import json as _json
        rec = _json.loads(final_path.read_text())
        flat = normalize_session(rec, session_id)
        sessions[session_id] = flat
        return flat
    return None


def _check_owner(session_data: dict, email: str):
    owner = session_data.get("user_email")
    if not owner or owner != email:
        raise HTTPException(status_code=403, detail="Access denied")


# ── Framework CRUD ────────────────────────────────────────────────────────────

@router.get("/regulations/frameworks")
async def list_frameworks(status: str = None):
    """List all supported regulatory frameworks."""
    return {"frameworks": get_frameworks(status)}


@router.get("/regulations/frameworks/{framework_id}")
async def get_framework(framework_id: str):
    """Get full framework details with requirements."""
    fw = get_framework_detail(framework_id)
    if not fw:
        raise HTTPException(status_code=404, detail="Framework not found")
    return fw


@router.get("/regulations/frameworks/{framework_id}/requirements")
async def list_requirements(framework_id: str):
    """List requirements for a specific framework."""
    reqs = get_framework_requirements(framework_id)
    return {"framework_id": framework_id, "requirements": reqs, "count": len(reqs)}


# ── Session-level regulation assessment ───────────────────────────────────────

@router.get("/sessions/{session_id}/regulation-assessment")
async def session_regulation_assessment(session_id: str, email: str = Depends(verify_token)):
    """Get regulation mapping for a session's risks."""
    s = _resolve_session(session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    _check_owner(s, email)
    return get_session_regulation_assessment(session_id)


@router.post("/sessions/{session_id}/regulation-assessment")
async def run_regulation_assessment(session_id: str, email: str = Depends(verify_token)):
    """Run regulation mapping for a session's risks (or re-run)."""
    s = _resolve_session(session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    _check_owner(s, email)
    nav = s.get("navigator") or {}
    risks = (nav.get("risk_register") or {}).get("risks", [])
    if not risks:
        raise HTTPException(status_code=400, detail="Session has no risks to assess")
    session_text = s.get("feature_description", "")
    result = map_risks_to_regulations(session_id, risks, session_text)
    audit(email, "regulation_assessment", session_id)
    return result


# ── EU AI Act classification ──────────────────────────────────────────────────

@router.get("/sessions/{session_id}/eu-ai-act-classification")
async def eu_ai_act_classification(session_id: str, email: str = Depends(verify_token)):
    """Auto-classify a session's feature into EU AI Act risk tiers."""
    s = _resolve_session(session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    _check_owner(s, email)
    nav = s.get("navigator") or {}
    risks = (nav.get("risk_register") or {}).get("risks", [])
    desc = s.get("feature_description", "")
    return classify_eu_ai_act_risk(desc, risks)


# ── Compliance templates ──────────────────────────────────────────────────────

@router.get("/compliance")
async def list_compliance_templates():
    """List available compliance templates."""
    return {
        "templates": [
            {"id": k, "name": v["name"], "framework_id": v["framework_id"], "items_count": len(v["items"])}
            for k, v in COMPLIANCE_TEMPLATES.items()
        ]
    }


@router.get("/compliance/{standard_id}")
async def get_compliance_template(standard_id: str):
    """Get a specific compliance template with all checklist items."""
    tmpl = COMPLIANCE_TEMPLATES.get(standard_id)
    if not tmpl:
        raise HTTPException(status_code=404, detail=f"Unknown compliance standard: {standard_id}")
    return tmpl


@router.post("/sessions/{session_id}/compliance/{standard_id}")
async def apply_compliance_checklist(session_id: str, standard_id: str, email: str = Depends(verify_token)):
    """Apply a compliance framework's checklist items to a session."""
    s = _resolve_session(session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    _check_owner(s, email)
    tmpl = COMPLIANCE_TEMPLATES.get(standard_id)
    if not tmpl:
        raise HTTPException(status_code=404, detail=f"Unknown standard: {standard_id}")
    nav = s.get("navigator") or {}
    checklist = nav.get("readiness_checklist", {}).get("checklist", [])
    existing_ids = {c.get("id") for c in checklist}
    added = 0
    for item in tmpl["items"]:
        comp_id = f"COMP-{standard_id.upper()}-{item['id']}"
        if comp_id not in existing_ids:
            checklist.append({
                "id": comp_id,
                "category": f"Compliance/{standard_id.upper()}",
                "item": item["item"],
                "owner_role": item["owner"],
                "priority": item["priority"],
                "source": standard_id,
                "article": item.get("article", ""),
            })
            added += 1
    if "readiness_checklist" not in nav:
        nav["readiness_checklist"] = {}
    nav["readiness_checklist"]["checklist"] = checklist
    s["navigator"] = nav
    audit(email, "compliance_applied", session_id, metadata={"standard": standard_id, "items_added": added})
    return {"standard": standard_id, "items_added": added, "total_checklist_items": len(checklist)}


# ── Regulation updates ────────────────────────────────────────────────────────

@router.get("/regulations/updates")
async def list_regulation_updates(status: str = None):
    """List recent regulation changes."""
    return {"updates": get_regulation_updates(status)}
