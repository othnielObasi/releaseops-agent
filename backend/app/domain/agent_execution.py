from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone
from typing import Any

import psycopg2.extras

from app.infra.database import get_db


RUN_STEPS = [
    ("intake", "Intake", "Classify title, description, data sensitivity, actors, and release context."),
    ("plan", "Plan", "Select frameworks, evidence targets, review owners, gates, and execution path."),
    ("navigator", "Navigator", "Build the release spec, personas, workflow, checklist, and initial risks."),
    ("sentinel", "Sentinel", "Stress-test risks and generate tests, guardrails, and validation strategy."),
    ("herald", "Herald", "Package release notes, stakeholder summary, and launch decision artifacts."),
    ("scoring", "Score", "Compute readiness score, grade, decision, and evidence completeness."),
    ("integrations", "Execute", "Dispatch webhooks, tickets, notifications, and evidence package actions."),
]

MIN_CONTEXT_WORDS = 12


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _json(value: Any) -> str:
    return json.dumps(value or {})


def _parse(value: Any, default: Any):
    if value in (None, ""):
        return default
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except Exception:
        return default


def create_agent_run(session_id: str, feature_title: str, feature_description: str, user_email: str | None = None):
    now = utc_now()
    summary = {
        "feature_title": feature_title,
        "user_email": user_email,
        "system_of_record": "vultr-postgres",
    }
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO agent_runs (session_id, status, current_step, summary, started_at, updated_at)
            VALUES (%s, 'planned', 'intake', %s, %s, %s)
            ON CONFLICT (session_id) DO UPDATE SET
                summary = EXCLUDED.summary,
                updated_at = EXCLUDED.updated_at
            """,
            (session_id, _json(summary), now, now),
        )
        for index, (step_key, name, detail) in enumerate(RUN_STEPS):
            status = "complete" if step_key == "intake" else "pending"
            cur.execute(
                """
                INSERT INTO agent_run_steps
                    (id, session_id, step_key, name, status, detail, sort_order, started_at, completed_at, updated_at)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (session_id, step_key) DO NOTHING
                """,
                (
                    str(uuid.uuid4()),
                    session_id,
                    step_key,
                    name,
                    status,
                    detail,
                    index,
                    now if step_key == "intake" else None,
                    now if step_key == "intake" else None,
                    now,
                ),
            )
        cur.close()
    add_event(session_id, "intake", "step_complete", "Release intake captured and stored.", {"title": feature_title})
    sync_blockers(session_id, derive_context_blockers(feature_title, feature_description))


def start_run(session_id: str):
    now = utc_now()
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE agent_runs SET status='running', current_step='plan', started_at=COALESCE(started_at,%s), updated_at=%s WHERE session_id=%s",
            (now, now, session_id),
        )
        cur.close()
    complete_step(session_id, "plan", "Execution plan selected.")


def start_step(session_id: str, step_key: str, message: str | None = None):
    now = utc_now()
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE agent_runs SET status='running', current_step=%s, updated_at=%s WHERE session_id=%s",
            (step_key, now, session_id),
        )
        cur.execute(
            "UPDATE agent_run_steps SET status='running', started_at=COALESCE(started_at,%s), updated_at=%s WHERE session_id=%s AND step_key=%s",
            (now, now, session_id, step_key),
        )
        cur.close()
    add_event(session_id, step_key, "step_started", message or f"{step_key} started.")


def complete_step(session_id: str, step_key: str, message: str | None = None, output_ref: str | None = None):
    now = utc_now()
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE agent_run_steps
            SET status='complete', completed_at=%s, updated_at=%s, output_ref=COALESCE(%s, output_ref)
            WHERE session_id=%s AND step_key=%s
            """,
            (now, now, output_ref, session_id, step_key),
        )
        cur.close()
    add_event(session_id, step_key, "step_complete", message or f"{step_key} completed.", {"output_ref": output_ref} if output_ref else {})


def fail_step(session_id: str, step_key: str, message: str):
    now = utc_now()
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE agent_runs SET status='failed', current_step=%s, completed_at=%s, updated_at=%s WHERE session_id=%s",
            (step_key, now, now, session_id),
        )
        cur.execute(
            "UPDATE agent_run_steps SET status='failed', completed_at=%s, updated_at=%s WHERE session_id=%s AND step_key=%s",
            (now, now, session_id, step_key),
        )
        cur.close()
    add_event(session_id, step_key, "step_failed", message)
    sync_blockers(session_id, [{
        "id": f"RUN-{step_key}-failed",
        "type": "PIPELINE",
        "title": f"{step_key.title()} failed",
        "reason": message,
        "owner_role": "Engineering",
        "severity": "High",
        "step_key": step_key,
    }], replace_existing=False)


def complete_run(session_id: str, summary: dict | None = None):
    now = utc_now()
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE agent_runs SET status='complete', current_step='integrations', completed_at=%s, updated_at=%s, summary=%s WHERE session_id=%s",
            (now, now, _json(summary), session_id),
        )
        cur.close()
    complete_step(session_id, "integrations", "Post-run integration dispatch completed.")


def add_event(session_id: str, step_key: str | None, event_type: str, message: str, metadata: dict | None = None):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO agent_execution_events (id, session_id, step_key, event_type, message, metadata, created_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s)
            """,
            (str(uuid.uuid4()), session_id, step_key, event_type, message, _json(metadata), utc_now()),
        )
        cur.close()


def derive_context_blockers(feature_title: str, feature_description: str) -> list[dict]:
    text = f"{feature_title or ''} {feature_description or ''}".strip()
    words = re.findall(r"[A-Za-z0-9]+", text)
    blockers = []
    if len(words) < MIN_CONTEXT_WORDS:
        blockers.append({
            "id": "CTX-description-too-short",
            "type": "CONTEXT",
            "title": "Feature description is too thin",
            "reason": "Add users, data types, business action, deployment surface, and failure impact before production approval.",
            "owner_role": "Product",
            "severity": "Medium",
            "step_key": "intake",
        })
    lower = text.lower()
    if not any(token in lower for token in ["data", "pii", "customer", "patient", "user", "transaction", "record"]):
        blockers.append({
            "id": "CTX-data-scope-missing",
            "type": "CONTEXT",
            "title": "Data scope is not explicit",
            "reason": "Specify what data the AI workflow can read, write, store, or expose.",
            "owner_role": "Product",
            "severity": "Medium",
            "step_key": "intake",
        })
    if not any(token in lower for token in ["approve", "block", "escalate", "refund", "delete", "send", "create", "update", "recommend"]):
        blockers.append({
            "id": "CTX-action-scope-missing",
            "type": "CONTEXT",
            "title": "Business action is unclear",
            "reason": "Describe the decisions or actions the agent is allowed to take.",
            "owner_role": "Product",
            "severity": "Medium",
            "step_key": "plan",
        })
    return blockers


def sync_blockers(session_id: str, blockers: list[dict], replace_existing: bool = True):
    now = utc_now()
    with get_db() as conn:
        cur = conn.cursor()
        if replace_existing:
            cur.execute(
                "UPDATE agent_blockers SET status='resolved', resolved_at=%s, updated_at=%s WHERE session_id=%s AND status='open'",
                (now, now, session_id),
            )
        for blocker in blockers or []:
            blocker_id = blocker.get("id") or f"BLK-{uuid.uuid4().hex[:10]}"
            storage_id = f"{session_id}:{blocker_id}"
            cur.execute(
                """
                INSERT INTO agent_blockers
                    (id, session_id, step_key, blocker_type, title, reason, owner_role, severity, status, source_ref, created_at, updated_at)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,'open',%s,%s,%s)
                ON CONFLICT (id) DO UPDATE SET
                    status='open',
                    reason=EXCLUDED.reason,
                    owner_role=EXCLUDED.owner_role,
                    severity=EXCLUDED.severity,
                    source_ref=EXCLUDED.source_ref,
                    resolved_at=NULL,
                    updated_at=EXCLUDED.updated_at
                """,
                (
                    storage_id,
                    session_id,
                    blocker.get("step_key"),
                    blocker.get("type") or blocker.get("blocker_type") or "GENERAL",
                    blocker.get("title") or "Release blocker",
                    blocker.get("reason") or "",
                    blocker.get("owner_role") or "Product",
                    blocker.get("severity") or "Medium",
                    _json(blocker.get("source_ref") or {"blocker_id": blocker_id, "risk_id": blocker.get("risk_id"), "category": blocker.get("category")}),
                    now,
                    now,
                ),
            )
        cur.close()


def get_agent_run(session_id: str) -> dict:
    with get_db() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM agent_runs WHERE session_id=%s", (session_id,))
        run = cur.fetchone()
        cur.execute("SELECT * FROM agent_run_steps WHERE session_id=%s ORDER BY sort_order ASC", (session_id,))
        steps = cur.fetchall()
        cur.execute("SELECT * FROM agent_blockers WHERE session_id=%s ORDER BY created_at ASC", (session_id,))
        blockers = cur.fetchall()
        cur.execute("SELECT * FROM agent_execution_events WHERE session_id=%s ORDER BY created_at ASC", (session_id,))
        events = cur.fetchall()
        cur.close()
    if not run:
        return {"status": "missing", "steps": [], "blockers": [], "events": []}
    return {
        "session_id": session_id,
        "status": run["status"],
        "current_step": run["current_step"],
        "summary": _parse(run["summary"], {}),
        "started_at": run["started_at"],
        "completed_at": run["completed_at"],
        "updated_at": run["updated_at"],
        "steps": [dict(row) for row in steps],
        "blockers": [{**dict(row), "source_ref": _parse(row.get("source_ref"), {})} for row in blockers],
        "events": [{**dict(row), "metadata": _parse(row.get("metadata"), {})} for row in events],
    }
