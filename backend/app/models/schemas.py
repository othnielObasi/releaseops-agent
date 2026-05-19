"""Pydantic models for request/response validation — v3 aligned."""
from typing import Optional, List
from pydantic import BaseModel


# ── Auth ──────────────────────────────────────────────────────────────────────
class SignupRequest(BaseModel):
    name: str
    email: Optional[str] = None
    password: str

class LoginRequest(BaseModel):
    email: Optional[str] = None
    name: Optional[str] = None
    identifier: Optional[str] = None
    password: str


# ── Sessions ──────────────────────────────────────────────────────────────────
class SessionCreate(BaseModel):
    feature_title: str
    feature_description: str
    parent_session_id: Optional[str] = None
    industry: Optional[str] = None


class IntegrationConfig(BaseModel):
    slack_webhook:   Optional[str] = None
    jira_url:        Optional[str] = None
    jira_token:      Optional[str] = None
    jira_project:    Optional[str] = None
    github_token:    Optional[str] = None
    github_repo:     Optional[str] = None
    github_pr:       Optional[int] = None
    linear_token:    Optional[str] = None
    linear_team_id:  Optional[str] = None
    webhook_url:     Optional[str] = None
    webhook_secret:  Optional[str] = None


# ── Governance ────────────────────────────────────────────────────────────────
class SignOffRequest(BaseModel):
    role: str          # pm | legal | qa | security
    status: str        # approved | rejected
    comment: Optional[str] = None

class GateCreate(BaseModel):
    name: str = "Production Gate"
    gate_type: str = "ci_cd"          # ci_cd | pr_check | manual
    min_score: int = 70
    required_sign_offs: List[str] = []  # ["pm","legal","qa","security"]
    required_frameworks: List[str] = []

class GateEvaluateRequest(BaseModel):
    session_id: str


# ── Regulation ────────────────────────────────────────────────────────────────
class ComplianceApplyRequest(BaseModel):
    standard_id: str   # gdpr | soc2 | hipaa | eu_ai_act


# ── Admin ─────────────────────────────────────────────────────────────────────
class APIKeyCreate(BaseModel):
    name: str

class TeamCreate(BaseModel):
    name: str
    brand_color: Optional[str] = "#6366f1"

class TeamInvite(BaseModel):
    email: str
    role: Optional[str] = "member"

class BrandingUpdate(BaseModel):
    brand_color: Optional[str] = None
    brand_logo_url: Optional[str] = None
    brand_name: Optional[str] = None


# ── Templates ─────────────────────────────────────────────────────────────────
class TemplateCreate(BaseModel):
    name: str
    category: Optional[str] = ""
    title: Optional[str] = ""
    industry: Optional[str] = ""
    description: str
    tags: Optional[List[str]] = []


# ── Misc ──────────────────────────────────────────────────────────────────────
class AnnotationCreate(BaseModel):
    ref_type: str
    ref_id: str
    text: str

class EmailNotifyRequest(BaseModel):
    to_email: str
    message: Optional[str] = ""

class ConfluenceExport(BaseModel):
    confluence_url: str
    space_key: str
    api_token: str
    parent_page_id: Optional[str] = None

class NotionExport(BaseModel):
    notion_token: str
    parent_page_id: str

class WebhookAnalyzeRequest(BaseModel):
    feature_title: str
    feature_description: str
    callback_url: Optional[str] = None

class NotifPrefs(BaseModel):
    notification_email: Optional[bool] = True
