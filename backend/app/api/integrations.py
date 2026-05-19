"""Integration routes — Slack, Jira, GitHub, Linear, Confluence, Notion, webhooks, email."""
import json, uuid, requests as http_requests
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, Request

from app.deps import (
    verify_token, sessions, get_db, audit, send_email,
    sanitize_input, verify_api_key, logger, persist_session_state,
    get_user_integration_settings, update_user_integration_settings,
)
from app.models.schemas import (
    ConfluenceExport, NotionExport, WebhookAnalyzeRequest,
    EmailNotifyRequest, IntegrationConfig,
)
from app.infra.config import SESSIONS_DIR

router = APIRouter(tags=["integrations"])


@router.get("/api/integrations")
async def get_integration_defaults(email: str = Depends(verify_token)):
    return {"integrations": get_user_integration_settings(email)}


@router.patch("/api/integrations")
async def set_integration_defaults(body: IntegrationConfig, email: str = Depends(verify_token)):
    return {"status": "ok", "integrations": update_user_integration_settings(email, body.model_dump(exclude_unset=True))}


# ═══════════════════════════════════════════════════════════════════════════════
# Slack notification
# ═══════════════════════════════════════════════════════════════════════════════

def send_slack_notification(webhook_url: str, session: dict, score: dict):
    """POST a rich Slack message when analysis completes."""
    try:
        title = session.get("feature_title", "Feature")
        s = score.get("score", "?")
        grade = score.get("grade", "?")
        highs = score.get("summary", {}).get("high_risks", 0)
        msg = {
            "text": f"ReleaseOps analysis complete: *{title}*",
            "blocks": [
                {"type": "section", "text": {"type": "mrkdwn",
                 "text": f"*ReleaseOps — {title}*\nReadiness Score: *{s}/100 (Grade {grade})* · {highs} high risks identified"}},
                {"type": "section", "fields": [
                    {"type": "mrkdwn", "text": f"*Test Cases:* {score['summary'].get('test_cases', 0)}"},
                    {"type": "mrkdwn", "text": f"*Guardrails:* {score['summary'].get('guardrails', 0)}"},
                    {"type": "mrkdwn", "text": f"*Must-Do Items:* {score['summary'].get('must_checklist', 0)}"},
                    {"type": "mrkdwn", "text": f"*High Risks Covered:* {score['summary'].get('covered_highs', 0)}/{highs}"},
                ]},
            ]
        }
        http_requests.post(webhook_url, json=msg, timeout=10)
        logger.info(json.dumps({"event": "slack_sent", "title": title}))
    except Exception as e:
        logger.warning(json.dumps({"event": "slack_failed", "error": str(e)}))


# ═══════════════════════════════════════════════════════════════════════════════
# Jira issue creation
# ═══════════════════════════════════════════════════════════════════════════════

def create_jira_issues(jira_url: str, jira_token: str, project: str,
                       nav: dict, session_id: str) -> list:
    """Create Jira issues for Must-Do checklist items."""
    checklist = nav.get("readiness_checklist", {}).get("checklist", [])
    must_items = [c for c in checklist if c.get("priority") == "Must"]
    headers = {"Authorization": f"Basic {jira_token}", "Content-Type": "application/json"}
    created = []
    for item in must_items[:10]:
        try:
            payload = {
                "fields": {
                    "project": {"key": project},
                    "summary": f"[ReleaseOps] {item.get('item', 'Checklist item')}"[:255],
                    "description": f"Category: {item.get('category', '')} | Owner: {item.get('owner_role', '')} | Session: {session_id}",
                    "issuetype": {"name": "Task"},
                }
            }
            r = http_requests.post(f"{jira_url}/rest/api/2/issue", headers=headers,
                                   json=payload, timeout=15)
            if r.status_code in (200, 201):
                created.append(r.json().get("key", ""))
        except Exception as e:
            logger.warning(json.dumps({"event": "jira_issue_failed", "error": str(e)}))
    logger.info(json.dumps({"event": "jira_issues_created", "count": len(created), "keys": created}))
    return created


# ═══════════════════════════════════════════════════════════════════════════════
# GitHub PR comment
# ═══════════════════════════════════════════════════════════════════════════════

def post_github_pr_comment(token: str, repo: str, pr: int,
                           nav: dict, score: dict, feature_title: str):
    """Post a risk summary comment on a GitHub PR."""
    try:
        risks = nav.get("risk_register", {}).get("risks", [])
        high_r = [r for r in risks if r.get("severity") == "High"]
        s = score.get("score", "?")
        grade = score.get("grade", "?")
        lines = [
            f"## ReleaseOps Release Readiness — {feature_title}",
            "",
            f"**Readiness Score: {s}/100 (Grade {grade})**",
            "",
            "| Metric | Value |",
            "|---|---|",
            f"| High Risks | {len(high_r)} |",
            f"| Test Cases | {score['summary'].get('test_cases', 0)} |",
            f"| Guardrails | {score['summary'].get('guardrails', 0)} |",
            f"| Must-Do Items | {score['summary'].get('must_checklist', 0)} |",
        ]
        if high_r:
            lines += ["", "### High Severity Risks"]
            for r in high_r[:5]:
                lines.append(f"- **{r.get('id', '')} {r.get('title', '')}** — {r.get('category', '')}")
        body = "\n".join(lines)
        headers = {"Authorization": f"token {token}", "Accept": "application/vnd.github+json"}
        r = http_requests.post(
            f"https://api.github.com/repos/{repo}/issues/{pr}/comments",
            headers=headers, json={"body": body}, timeout=15
        )
        logger.info(json.dumps({"event": "github_comment_posted", "status": r.status_code}))
    except Exception as e:
        logger.warning(json.dumps({"event": "github_comment_failed", "error": str(e)}))


# ═══════════════════════════════════════════════════════════════════════════════
# Linear issue creation
# ═══════════════════════════════════════════════════════════════════════════════

def create_linear_issues(linear_token: str, team_id: str, nav: dict, session_id: str) -> list:
    """Create Linear issues for Must-Do checklist items via GraphQL API."""
    checklist = nav.get("readiness_checklist", {}).get("checklist", [])
    must_items = [c for c in checklist if c.get("priority") == "Must"]
    headers = {"Authorization": linear_token, "Content-Type": "application/json"}
    created = []
    for item in must_items[:10]:
        try:
            mutation = """
            mutation CreateIssue($title: String!, $description: String!, $teamId: String!) {
              issueCreate(input: {title: $title, description: $description, teamId: $teamId}) {
                success
                issue { id identifier url }
              }
            }
            """
            variables = {
                "title": f"[ReleaseOps] {item.get('item', 'Checklist item')[:200]}",
                "description": (
                    f"**Category:** {item.get('category', '')}\n"
                    f"**Owner:** {item.get('owner_role', '')}\n"
                    f"**Priority:** {item.get('priority', '')}\n"
                    f"**Session:** {session_id}"
                ),
                "teamId": team_id,
            }
            r = http_requests.post(
                "https://api.linear.app/graphql",
                headers=headers,
                json={"query": mutation, "variables": variables},
                timeout=15,
            )
            if r.status_code == 200:
                data = r.json()
                issue = data.get("data", {}).get("issueCreate", {}).get("issue", {})
                if issue.get("identifier"):
                    created.append(issue["identifier"])
        except Exception as e:
            logger.warning(json.dumps({"event": "linear_issue_failed", "error": str(e)}))
    logger.info(json.dumps({"event": "linear_issues_created", "count": len(created), "ids": created}))
    return created


# ═══════════════════════════════════════════════════════════════════════════════
# Custom HMAC-signed webhook
# ═══════════════════════════════════════════════════════════════════════════════

def send_custom_webhook(webhook_url: str, webhook_secret: str,
                        session_id: str, session: dict, nav: dict,
                        score: dict, feature_title: str):
    """POST analysis results to a custom webhook endpoint with HMAC-SHA256 signature."""
    import hmac, hashlib as _hashlib
    try:
        risks = nav.get("risk_register", {}).get("risks", [])
        payload = {
            "event": "analysis_complete",
            "session_id": session_id,
            "feature_title": feature_title,
            "readiness_score": score.get("score"),
            "grade": score.get("grade"),
            "summary": score.get("summary", {}),
            "high_risks": len([r for r in risks if r.get("severity") == "High"]),
            "total_risks": len(risks),
            "status": (session.get("session") or session).get("status", "complete"),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        body_bytes = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        headers = {"Content-Type": "application/json"}
        if webhook_secret:
            sig = hmac.new(webhook_secret.encode("utf-8"), body_bytes, _hashlib.sha256).hexdigest()
            headers["X-ReleaseOps-Signature"] = f"sha256={sig}"
        r = http_requests.post(webhook_url, data=body_bytes, headers=headers, timeout=15)
        logger.info(json.dumps({"event": "webhook_sent", "url": webhook_url, "status": r.status_code}))
    except Exception as e:
        logger.warning(json.dumps({"event": "webhook_failed", "error": str(e)}))
        raise


# ═══════════════════════════════════════════════════════════════════════════════
# Post-pipeline integration dispatcher (called after pipeline completes)
# ═══════════════════════════════════════════════════════════════════════════════

def dispatch_integrations(session_id: str, session: dict, nav: dict, score: dict, feature_title: str) -> dict:
    """Fire integrations after analysis completes. Returns results dict."""
    integ = session.get("integrations", {})
    results: dict = {}
    if integ.get("slack_webhook"):
        try:
            send_slack_notification(integ["slack_webhook"], session, score)
            results["slack"] = "sent"
        except Exception as e:
            results["slack"] = f"failed: {e}"
    if integ.get("jira_url") and integ.get("jira_token") and integ.get("jira_project"):
        try:
            created = create_jira_issues(integ["jira_url"], integ["jira_token"],
                                         integ["jira_project"], nav, session_id)
            results["jira"] = f"created {len(created)} issues"
        except Exception as e:
            results["jira"] = f"failed: {e}"
    if integ.get("github_token") and integ.get("github_repo") and integ.get("github_pr"):
        try:
            post_github_pr_comment(integ["github_token"], integ["github_repo"],
                                   integ["github_pr"], nav, score, feature_title)
            results["github"] = "posted"
        except Exception as e:
            results["github"] = f"failed: {e}"
    if integ.get("linear_token") and integ.get("linear_team_id"):
        try:
            created = create_linear_issues(integ["linear_token"], integ["linear_team_id"],
                                           nav, session_id)
            results["linear"] = f"created {len(created)} issues"
        except Exception as e:
            results["linear"] = f"failed: {e}"
    if integ.get("webhook_url"):
        try:
            send_custom_webhook(integ["webhook_url"], integ.get("webhook_secret", ""),
                                session_id, session, nav, score, feature_title)
            results["webhook"] = "sent"
        except Exception as e:
            results["webhook"] = f"failed: {e}"
    if results:
        logger.info(json.dumps({"event": "integrations_complete", "session_id": session_id, "results": results}))
    return results


# ═══════════════════════════════════════════════════════════════════════════════
# API Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

def _load_session_data(session_id: str):
    """Load session from memory or disk."""
    if session_id in sessions:
        return sessions[session_id]
    fp = SESSIONS_DIR / session_id / "final.json"
    if fp.exists():
        return json.loads(fp.read_text())
    return None


def _check_owner(session_data: dict, email: str):
    """Raise 403 unless the authenticated user owns this session."""
    meta = session_data.get("session") or session_data
    owner = meta.get("user_email")
    if not owner or owner != email:
        raise HTTPException(status_code=403, detail="Access denied")


# ── Linear export ─────────────────────────────────────────────────────────────

from pydantic import BaseModel

class LinearExportRequest(BaseModel):
    linear_token: str
    linear_team_id: str


@router.post("/api/sessions/{session_id}/export/linear")
async def export_to_linear(session_id: str, body: LinearExportRequest, email: str = Depends(verify_token)):
    """Create Linear issues for all Must-Do checklist items in a session."""
    s = _load_session_data(session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    _check_owner(s, email)
    nav = s.get("navigator") or {}
    if not nav:
        raise HTTPException(status_code=400, detail="Session not yet complete")
    created = create_linear_issues(body.linear_token, body.linear_team_id, nav, session_id)
    return {"created": len(created), "issue_ids": created}


# ── Confluence export ─────────────────────────────────────────────────────────

@router.post("/api/sessions/{session_id}/export/confluence")
async def export_to_confluence(session_id: str, body: ConfluenceExport, email: str = Depends(verify_token)):
    s = _load_session_data(session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    _check_owner(s, email)
    meta = s.get("session") or s
    nav = s.get("navigator") or {}
    risks = (nav.get("risk_register") or {}).get("risks", [])
    score = (meta.get("readiness_score") or {})

    content = f"<h2>Feature: {meta.get('feature_title', '')}</h2>"
    if score:
        content += f"<p><strong>Readiness Score: {score.get('score', '?')}/100 — Grade {score.get('grade', '?')}</strong></p>"
    content += f"<p>{len(risks)} risks identified.</p>"
    content += "<h3>Risk Summary</h3><table><tbody>"
    content += "<tr><th>ID</th><th>Title</th><th>Severity</th><th>Category</th></tr>"
    for r in risks[:20]:
        content += f"<tr><td>{r.get('id', '')}</td><td>{r.get('title', '')}</td><td>{r.get('severity', '')}</td><td>{r.get('category', '')}</td></tr>"
    content += "</tbody></table>"
    content += f"<p><em>Generated by ReleaseOps · Session {session_id[:8]}</em></p>"

    payload = {
        "type": "page",
        "title": f"ReleaseOps: {meta.get('feature_title', '')}",
        "space": {"key": body.space_key},
        "body": {"storage": {"value": content, "representation": "storage"}}
    }
    if body.parent_page_id:
        payload["ancestors"] = [{"id": body.parent_page_id}]

    try:
        r = http_requests.post(
            f"{body.confluence_url.rstrip('/')}/wiki/rest/api/content",
            headers={"Authorization": body.api_token, "Content-Type": "application/json"},
            json=payload, timeout=20
        )
        r.raise_for_status()
        page = r.json()
        audit(email, "confluence_export", session_id)
        return {"page_id": page.get("id"), "url": f"{body.confluence_url}/wiki/spaces/{body.space_key}/pages/{page.get('id')}"}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Confluence error: {str(e)}")


# ── Notion export ─────────────────────────────────────────────────────────────

@router.post("/api/sessions/{session_id}/export/notion")
async def export_to_notion(session_id: str, body: NotionExport, email: str = Depends(verify_token)):
    s = _load_session_data(session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    _check_owner(s, email)
    meta = s.get("session") or s
    nav = s.get("navigator") or {}
    risks = (nav.get("risk_register") or {}).get("risks", [])
    score = (meta.get("readiness_score") or {})

    blocks = [
        {"object": "block", "type": "heading_1",
         "heading_1": {"rich_text": [{"type": "text", "text": {"content": f"ReleaseOps: {meta.get('feature_title', '')}"}}]}},
        {"object": "block", "type": "paragraph",
         "paragraph": {"rich_text": [{"type": "text", "text": {"content": f"Score: {score.get('score', '?')}/100  |  Grade: {score.get('grade', '?')}  |  Risks: {len(risks)}"}}]}},
        {"object": "block", "type": "heading_2",
         "heading_2": {"rich_text": [{"type": "text", "text": {"content": "Risk Register"}}]}},
    ]
    for r in risks[:10]:
        blocks.append({"object": "block", "type": "bulleted_list_item",
                       "bulleted_list_item": {"rich_text": [{"type": "text", "text": {"content": f"[{r.get('severity', '')}] {r.get('title', '')} — {r.get('category', '')}"}}]}})

    payload = {
        "parent": {"type": "page_id", "page_id": body.parent_page_id},
        "properties": {"title": {"title": [{"type": "text", "text": {"content": f"ReleaseOps: {meta.get('feature_title', '')}"}}]}},
        "children": blocks
    }
    try:
        r = http_requests.post(
            "https://api.notion.com/v1/pages",
            headers={"Authorization": f"Bearer {body.notion_token}", "Content-Type": "application/json", "Notion-Version": "2022-06-28"},
            json=payload, timeout=20
        )
        r.raise_for_status()
        page = r.json()
        audit(email, "notion_export", session_id)
        return {"page_id": page.get("id"), "url": page.get("url")}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Notion error: {str(e)}")


# ── Webhook / CI/CD trigger ──────────────────────────────────────────────────

# pipeline runner — set by main.py at startup
_run_pipeline_fn = None

def set_webhook_pipeline_runner(fn):
    global _run_pipeline_fn
    _run_pipeline_fn = fn


@router.post("/api/webhook/analyze")
async def webhook_analyze(body: WebhookAnalyzeRequest, request: Request, bg: BackgroundTasks):
    """Trigger analysis from CI/CD pipeline — authenticates via API key."""
    auth_header = request.headers.get("Authorization", "")
    api_key = auth_header.replace("Bearer ", "").strip()
    owner_email = verify_api_key(api_key)
    if not owner_email:
        raise HTTPException(status_code=401, detail="Invalid API key")

    title = sanitize_input(body.feature_title, "feature_title")
    desc = sanitize_input(body.feature_description, "feature_description")
    session_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    sessions[session_id] = {
        "id": session_id, "feature_title": title, "feature_description": desc,
        "status": "running", "created_at": now, "user_email": owner_email,
        "version": 1, "source": "webhook",
        "navigator": None, "sentinel": None, "herald": None, "error": None,
        "validation_warnings": [], "pii_detected": [], "readiness_score": None,
        "integrations": {},
    }
    persist_session_state(session_id)

    if _run_pipeline_fn:
        bg.add_task(_run_pipeline_fn, session_id, title, desc)

    audit(owner_email, "webhook_analyze", session_id)
    return {"session_id": session_id, "status": "queued"}
