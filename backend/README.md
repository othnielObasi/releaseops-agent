# ReleaseOps — Release Readiness Copilot

**Multi-agent AI system for automated feature release governance**

> **Live App**: https://6pycqjui.run.complete.dev/
> **Version**: 2.0.0 — Last updated: 2026-03-03

---

## Table of Contents

1. [The Problem](#the-problem)
2. [The Solution](#the-solution)
3. [Who It's For](#who-its-for)
4. [How It Works](#how-it-works)
5. [Feature Walkthrough](#feature-walkthrough)
6. [High-Impact Features](#high-impact-features)
7. [Architecture Overview](#architecture-overview)
8. [Technology Stack](#technology-stack)
9. [Prerequisites](#prerequisites)
10. [Getting Started](#getting-started)
11. [Environment Variables](#environment-variables)
12. [Running the Application](#running-the-application)
13. [Docker](#docker)
14. [File Structure](#file-structure)
15. [API Endpoints](#api-endpoints)
16. [Agent Prompts and Validation](#agent-prompts-and-validation)
17. [Usage Patterns](#usage-patterns)
18. [CI/CD & Testing](#cicd--testing)
19. [Production Considerations](#production-considerations)
20. [Changelog](#changelog)

---

## The Problem

Shipping AI-powered features is fundamentally different from shipping traditional software — and most teams are not ready for it.

### The Reality Today

When a product team decides to ship an AI feature, they typically face a scattered, manual, and slow process:

- **No structured spec** — feature descriptions live in Slack threads, Notion notes, or a PM's head. There is no formal problem statement, no defined personas, no documented success metrics.
- **Invisible risks** — AI features introduce categories of risk that traditional engineering checklists miss entirely: hallucination, bias, privacy violations through inference, prompt injection, adversarial misuse, regulatory non-compliance. These risks are rarely identified before launch.
- **No test strategy for AI** — QA teams are equipped to test deterministic code, not probabilistic AI outputs. There are no standard playbooks for evaluating large language model behaviour in production.
- **Disconnected documentation** — release notes, stakeholder communications, and internal launch packages are written independently, often by different people, often too late.
- **Compliance as an afterthought** — GDPR, HIPAA, and SOC 2 requirements are discovered after architecture decisions are locked in, leading to expensive rework or regulatory exposure.
- **No institutional learning** — each feature is analysed in isolation. There is no way to compare the risk profile of v1 to v2, or to see whether the team's readiness is improving over time.

### The Cost

The consequences are real and measurable:

- AI features ship with unidentified high-severity risks that become incidents within weeks of launch
- Legal and compliance reviews block releases at the last minute, causing multi-week delays
- QA teams spend days writing test cases manually for each AI feature with no consistent framework
- Engineering teams re-do work when compliance requirements emerge late in the cycle
- Product managers can't communicate launch readiness to executives in a clear, defensible way
- There is no shared language between product, engineering, legal, and QA when evaluating AI feature health

---

## The Solution

**ReleaseOps** is a release readiness copilot that transforms a plain-language feature description into a complete, structured launch package in under 60 seconds.

It uses a three-agent AI pipeline — Navigator, Sentinel, and Herald — to automatically produce everything a cross-functional team needs to ship an AI feature responsibly:

| What you put in | What you get out |
|---|---|
| Feature title + plain-English description | Structured Release Spec (problem, personas, user stories, NFRs, metrics) |
| | Risk Register with severity scoring across 4 categories |
| | Readiness Checklist with priority and owner assignment |
| | Full Testing Strategy with linked test cases |
| | AI Guardrails across 5 implementation layers |
| | Release Notes, Landing Copy, and Pitch Deck slides |
| | Compliance-ready checklist items (GDPR / SOC 2 / HIPAA) |
| | Exportable package for engineering handoff |

ReleaseOps does not replace human judgment — it ensures that judgment is applied to the right questions, with the right structure, at the right time.

---

## Who It's For

ReleaseOps is built for the people responsible for getting AI features from idea to production safely and quickly.

### Product Managers
- Get a complete, structured spec from a rough feature concept in seconds
- Identify risks before committing to architecture or timelines
- Produce stakeholder-ready summaries, release notes, and pitch decks automatically
- Track readiness scores across feature iterations to show improvement over time

### Engineering Teams
- Receive a formal spec with NFRs, use cases, and success metrics ready for handoff
- Understand the full risk landscape before making architectural decisions
- Get implementation-level guidance on guardrails and mitigations
- Trigger analysis directly from CI/CD pipelines via webhook

### QA and Test Engineers
- Receive a complete testing strategy with concrete test cases already written
- Test cases are linked directly to the risks that motivated them — full traceability
- Guardrail recommendations cover every layer: preprocessing, model call, postprocessing, UI, and access control
- No more starting from a blank page for every new AI feature

### Legal, Compliance, and Security Teams
- Apply GDPR, SOC 2, or HIPAA compliance checklists to any session with one click
- All outputs are clearly labelled as AI-generated and require human sign-off before production use
- Full audit log of every action for governance and accountability
- PII detection runs on all input before it reaches any LLM

### Executives and Stakeholders
- Receive a clear readiness score (0–100, grade A–F) with a breakdown by dimension
- Share a read-only public link to any completed analysis
- Understand risk posture in plain language, without reading technical documents
- See side-by-side comparison of risk profiles across feature versions

---

## How It Works

ReleaseOps operates as a sequential three-agent pipeline, where each agent builds on the previous one's structured output.

```
User Input (feature title + description)
         │
         ▼
 ┌──────────────────────────────────────────┐
 │  Input Validation Layer                  │
 │  • PII Detection (email, SSN, phone,     │
 │    credit card regex scanning)           │
 │  • Prompt Injection Guard (16-pattern    │
 │    blocklist + output safety scan)       │
 └──────────────────────────────────────────┘
         │
         ▼
 ┌──────────────────────────────────────────┐
 │  🧭 NAVIGATOR AGENT                      │
 │                                          │
 │  Analyses the feature concept and        │
 │  produces:                               │
 │  • Release Spec (problem, personas,      │
 │    use cases, user stories, NFRs,        │
 │    success metrics)                      │
 │  • Risk Register (Safety, Security,      │
 │    Privacy, UX/Business — scored by      │
 │    likelihood × impact)                  │
 │  • Readiness Checklist (Must / Should /  │
 │    NiceToHave, with owner roles)         │
 └──────────────────────────────────────────┘
         │
         ▼
 ┌──────────────────────────────────────────┐
 │  🛡️ SENTINEL AGENT                       │
 │                                          │
 │  Reviews Navigator output and produces:  │
 │  • Testing Strategy (Unit, Integration,  │
 │    E2E, AI Eval levels)                  │
 │  • Test Cases (linked to specific risks, │
 │    with abstract inputs and expected     │
 │    behaviours)                           │
 │  • Guardrails (PreProcessing,            │
 │    ModelCall, PostProcessing, UI,        │
 │    AccessControl — with implementation   │
 │    guidance)                             │
 └──────────────────────────────────────────┘
         │
         ▼
 ┌──────────────────────────────────────────┐
 │  📣 HERALD AGENT                         │
 │                                          │
 │  Synthesises all outputs into:           │
 │  • Release Notes (stakeholder-ready)     │
 │  • Landing / Marketing Copy             │
 │  • Pitch Deck outline (slide-by-slide)  │
 └──────────────────────────────────────────┘
         │
         ▼
 ┌──────────────────────────────────────────┐
 │  Session Storage & Export                │
 │  • SQLite DB + immutable disk JSON       │
 │  • ZIP export / HTML PDF report          │
 │  • Teams · API Keys · Annotations        │
 │  • Audit Log · Compliance Templates      │
 └──────────────────────────────────────────┘
```

Every LLM call uses **async retry with exponential backoff** (3 attempts, 1.5 s base delay) and Pydantic schema validation to ensure structured, reliable output even when the model is unpredictable.

### The Readiness Score

On completion, ReleaseOps computes a **0–100 composite readiness score** graded A–F, broken down by five dimensions:

| Dimension | What it measures |
|---|---|
| Risk Coverage | Breadth and severity distribution of identified risks |
| Spec Completeness | Presence of personas, NFRs, use cases, and success metrics |
| Test Coverage | Number and variety of test cases relative to risk count |
| Guardrail Strength | Coverage of implementation layers |
| Checklist Readiness | Ratio of Must-Do items vs. total items |

---

## Feature Walkthrough

### 1. Run a Readiness Check

Enter a feature title and description in natural language. Use the **Industry Preset** dropdown to auto-fill a template for your sector (FinTech, HealthTech, B2B SaaS, LegalTech, and more). Click **Run Readiness Check** and watch the three-agent pipeline run in real time.

The interface shows live pipeline progress across all three agents, updating every 2 seconds until completion (up to 120 seconds for complex features).

### 2. Overview Tab

A high-level dashboard showing:
- **Readiness Score** card (0–100, grade A–F, with dimensional breakdown)
- Total risk count, checklist items, test cases, and guardrails at a glance
- Risk severity breakdown (Critical / High / Medium / Low)
- **Must-Do checklist** — the highest-priority items before shipping, with owner roles
- Version history — all previous analyses of the same feature, with score progression

### 3. Spec & Risks Tab

The most detailed tab, covering:
- **Risk Heatmap** — 3×3 likelihood × impact matrix with all risks plotted. Click any cell to see the risks inside it.
- **Release Spec** — problem statement, personas with needs and pain points, core use cases, user stories, NFRs, and success metrics
- **Risk Register** — full expandable table. Click any row to see detailed description, mitigation ideas, and linked test cases.
- **Readiness Checklist** — grouped by category (Engineering, Legal, QA, etc.), with priority and owner role
- **Compliance Bar** — click GDPR, SOC 2, or HIPAA to instantly merge that standard's checklist items into the session

### 4. Tests & Guardrails Tab

- **Testing Strategy** — four-level matrix (Unit, Integration, E2E, AI Eval) with descriptions and primary owners
- **Test Cases** — full list with linked risks, category, abstract input, expected behaviour, and automation recommendation. Click any row to expand.
- **Guardrails** — implementation-level recommendations across five layers, each with a specific implementation idea and the risks it mitigates

### 5. Docs & Launch Tab

- **Release Notes** — structured stakeholder communication (summary, what's new, why it matters, known limitations)
- **Landing Copy** — hero title, subtitle, tagline, key benefits, feature sections, trust & safety statement, and CTA
- **Pitch Deck** — slide-by-slide outline with key points, objectives, and speaker notes

### 6. Session Action Bar

For every completed live session, the full action bar appears at the top:

| Button | Action |
|---|---|
| 🔄 Re-analyze | Fork the session with updated title or description |
| 🔗 Share | Generate a public read-only link (shareable without login) |
| ⬇ Package | Download a ZIP with all agent outputs as individual JSON files |
| 📄 PDF | Download a branded HTML report for printing or sharing |
| ✉ Email | Send the full report to any email address |
| ⚡ Compare | Side-by-side risk comparison with any other session |

---

## High-Impact Features

### 1. Team Workspaces

Create shared organisational workspaces with role-based access. Invite colleagues by email. All sessions run by workspace members are visible to the team.

```
POST   /api/teams                        Create workspace
GET    /api/teams                        List my workspaces
POST   /api/teams/{id}/invite            Invite member by email
GET    /api/teams/accept/{token}         Accept invitation
GET    /api/teams/{id}/members           List members
DELETE /api/teams/{id}/members/{email}   Remove member
```

Roles: `owner`, `admin`, `member`

### 2. Custom Branding

Personalise exported reports with your organisation's identity:

```
PATCH  /api/teams/{id}/branding          Update brand colour, logo URL, org name
GET    /api/teams/{id}/branding          Get current branding config
```

### 3. PDF / HTML Export

Polished, stakeholder-ready reports:

```
GET    /api/sessions/{id}/export/pdf     Download branded HTML report
GET    /api/sessions/{id}/export         Download full ZIP (navigator + sentinel + herald JSONs)
GET    /static/{filename}                Serve static assets (e.g. codebase ZIP downloads)
```

### 4. Email Notifications

Send the analysis report directly to any email on completion:

```
POST   /api/sessions/{id}/notify         { "to_email": "...", "session_id": "..." }
PATCH  /api/auth/preferences             Toggle email notification opt-in
```

Configure `SMTP_*` environment variables to enable.

### 5. Confluence & Notion Push

One-click publish to your team's documentation platform:

```
POST   /api/sessions/{id}/export/confluence   { confluence_url, confluence_token, space_key }
POST   /api/sessions/{id}/export/notion       { notion_token, parent_page_id }
```

### 6. API Access & API Keys

Full REST API with key-based authentication for CI/CD integration:

```
POST   /api/keys           { "name": "CI Pipeline" }  → returns ro_... key
GET    /api/keys           List active keys
DELETE /api/keys/{id}      Revoke key
```

Keys are prefixed `ro_` and stored as SHA-256 hashes at rest.

### 7. Webhook Trigger

Embed ReleaseOps directly in your release pipeline:

```bash
curl -X POST https://your-domain/api/webhook/analyze \
  -H "Authorization: Bearer ro_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "feature_title": "Smart Recommendations",
    "feature_description": "...",
    "notify_email": "team@company.com"
  }'
```

Returns `{ "session_id": "...", "status": "queued" }` immediately; analysis runs in the background.

### 8. Side-by-Side Comparison

Compare the risk profile of any two sessions to measure improvement across iterations:

```
GET    /api/compare?a={sessionId}&b={sessionId}
```

Returns both sessions' risk counts, readiness scores, checklist sizes, and test case totals side-by-side.

### 9. Risk Heatmap

Visual 3×3 likelihood × impact matrix rendered in the Spec & Risks tab:

```
GET    /api/sessions/{id}/heatmap
```

Returns a `matrix` object keyed by `Low/Medium/High` likelihood and impact, with risk items in each cell, plus summary counts.

### 10. Inline Annotations

Add inline comments to any specific risk, checklist item, test case, or guardrail:

```
POST   /api/sessions/{id}/annotations   { ref_type, ref_id, text }
GET    /api/sessions/{id}/annotations
DELETE /api/sessions/{id}/annotations/{ann_id}
```

`ref_type`: `"risk"` | `"checklist"` | `"test"` | `"guardrail"`

### 11. Compliance Templates

Pre-loaded regulatory checklists that merge into any session with one click:

```
GET    /api/compliance                              List GDPR, SOC 2, HIPAA templates
GET    /api/compliance/{standard_id}               Full checklist (gdpr | soc2 | hipaa)
POST   /api/sessions/{id}/compliance/{standard_id} Apply to session checklist
```

Clicking **GDPR**, **SOC2**, or **HIPAA** in the Spec & Risks tab merges that standard's checklist items into the session's Readiness Checklist. The tab re-renders immediately with a toast confirmation, and changes are persisted to disk (survive server restarts). Requires authentication; not available for demo sessions.

### 12. Integrations

| Tool | Trigger |
|---|---|
| **Slack** | Webhook notification on session completion |
| **Jira** | Auto-creates issues for every Must-Do checklist item |
| **GitHub** | Posts a risk summary comment on a PR |
| **Linear** | Creates issues via GraphQL for Must-Do items |

Configure via `PATCH /api/sessions/{id}/integrations`.

### 13. Trust and Safety

ReleaseOps is built with safety-first principles throughout:

- **PII Detection** — regex scanning on all input before LLM processing (email, SSN, phone, credit card patterns)
- **Prompt Injection Guards** — 16-pattern blocklist with output safety scanning after every LLM call
- **Audit Log** — every key action recorded with email, IP address, and timestamp
- **Human Review Gates** — all outputs are labelled AI-generated and require explicit sign-off before use in production decisions
- **Rate Limiting** — per-IP (10/min) and per-user (20/min) sliding window limiters
- **Secure Headers** — X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy on all responses
- **Brute-Force Protection** — admin login locked after 5 failures per IP (15-minute window)

---

## Architecture Overview

### LangGraph State Machine

```python
class ReleaseOpsState(TypedDict):
    session_id: str
    feature_title: str
    feature_description: str
    navigator_output: dict
    sentinel_output: dict
    herald_output: dict
    error: Optional[str]
```

Nodes: `navigator_node` → `sentinel_node` → `herald_node` → `END`

Each node calls its respective LLM with a structured prompt, validates the response against a Pydantic schema, and stores the result in the state. If any node fails after 3 retries, the pipeline transitions to an error state and the session is marked as `error` — the partial results (if any) are still preserved and displayed.

### Session Lifecycle

```
POST /api/sessions
  → session created (status: pending)
  → background task queued
  → LangGraph pipeline runs asynchronously
  → polling: GET /api/sessions/{id} every 2s
  → status transitions: pending → running → complete | error
  → on complete: results written to SQLite + disk JSON
```

### Storage Strategy

| Store | Contents |
|---|---|
| `data/releaseops.db` | Users, teams, API keys, annotations, audit log, session metadata |
| `sessions/{id}/final.json` | Complete agent outputs — immutable once written |
| `sessions/{id}/navigator.json` | Navigator output only |
| `sessions/{id}/sentinel.json` | Sentinel output only |
| `sessions/{id}/herald.json` | Herald output only |
| `data/templates.json` | User-saved custom templates |
| `data/share_tokens.json` | Public share link tokens |

---

## Technology Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI 0.111 (Python 3.10+) |
| Agent Orchestration | LangGraph 0.2 + LangChain 0.3 |
| LLM Provider | Deploy.ai / OpenAI API (GPT-4o / GPT-4o-mini) |
| Frontend | Vanilla JavaScript SPA (dark + light themes) |
| Authentication | JWT (python-jose) + bcrypt (passlib) |
| Data Validation | Pydantic 2.7 |
| Storage | SQLite + JSON disk |
| Logging | JSON structured logs with trace IDs |
| CI/CD | GitHub Actions (lint → test → E2E → Docker build) |
| E2E Testing | Playwright |

---

## Prerequisites

- Python **3.10+**
- pip
- A [Deploy.ai](https://deploy.ai) account with `CLIENT_ID` and `CLIENT_SECRET`
- A `.env` file for local development (see [Environment Variables](#environment-variables))

---

## Getting Started

### 1. Clone the repository

```bash
git clone <repo-url>
cd releaseops-agent
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure environment variables

Copy the example below into a `.env` file in the project root.

### 4. Run the server

```bash
python main.py
# or for background execution:
nohup python main.py > logs/server.log 2>&1 &
```

The app will be available at `http://localhost:3001`.

---

## Environment Variables

```env
# ── Deploy.ai / LLM API ───────────────────────────────────────────────────
AUTH_URL=https://api-auth.dev.deploy.ai/oauth2/token
API_URL=https://core-api.dev.deploy.ai
CLIENT_ID=your_client_id
CLIENT_SECRET=your_client_secret
ORG_ID=your_org_id

# ── Demo Mode ─────────────────────────────────────────────────────────────
# Set true to bypass LLM calls and use deterministic pre-built responses
DEMO_MODE=false

# ── JWT Authentication ────────────────────────────────────────────────────
JWT_SECRET=your_jwt_secret_key          # change in production
JWT_ALGORITHM=HS256
JWT_EXPIRE_HOURS=72

# ── Admin Account ─────────────────────────────────────────────────────────
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=your_secure_admin_password

# ── Email Notifications (optional) ───────────────────────────────────────
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_USER=notifications@yourdomain.com
SMTP_PASSWORD=your_smtp_password
FROM_EMAIL=notifications@yourdomain.com
```

> **Demo Mode**: When `DEMO_MODE=true`, all three agents return deterministic, feature-aware outputs without any LLM API calls — ideal for demos, onboarding, and CI pipelines.

---

## Running the Application

### Development (foreground)

```bash
python main.py
```

### Background (persistent)

```bash
nohup python main.py > logs/server.log 2>&1 &
```

### With Uvicorn (hot reload)

```bash
uvicorn main:app --host 0.0.0.0 --port 3001 --reload
```

### With Gunicorn (multi-worker)

```bash
gunicorn main:app -c gunicorn.conf.py
```

---

## Docker

### Build and run locally

```bash
docker build -t releaseops .
docker run -p 3001:3001 --env-file .env releaseops
```

### Docker Compose (recommended for local dev)

```bash
docker-compose up --build
```

---

## File Structure

```
ReleaseOps/
├── main.py                     # FastAPI app, LangGraph pipeline, all API routes (~3,600 lines)
├── agents.py                   # Agent stub implementations
├── schemas.py                  # Pydantic output schemas for all three agents
├── requirements.txt            # Python dependencies
├── gunicorn.conf.py            # Gunicorn multi-worker configuration
├── users.json                  # User authentication store (file-based)
├── Dockerfile                  # Production container image
├── docker-compose.yml          # Local dev orchestration
├── .github/
│   └── workflows/
│       └── ci.yml              # GitHub Actions: lint → test → E2E → Docker
├── static/
│   ├── index.html              # SPA: dark/light theme, all UI logic (~5,700 lines)
│   └── admin.html              # Admin panel
├── mock/                       # Pre-built demo scenarios
│   ├── session_legal.json
│   ├── session_highrisk.json
│   └── session_vague.json
├── sessions/                   # Immutable per-session JSON artefacts
│   └── {session_id}/
│       ├── navigator.json
│       ├── sentinel.json
│       ├── herald.json
│       └── final.json
├── data/
│   ├── releaseops.db          # SQLite: teams, API keys, annotations, audit, sessions_db
│   ├── templates.json          # User-saved custom templates
│   └── share_tokens.json       # Public share link tokens
├── tests/
│   ├── test_api.py             # pytest unit + API tests
│   ├── e2e.spec.js             # Playwright end-to-end tests (15 scenarios)
│   └── __init__.py
└── logs/
    └── releaseops.json        # JSON structured logs (trace_id, level, timestamp)
```

---

## API Endpoints

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | /api/auth/signup | — | Register a new user |
| POST | /api/auth/login | — | Authenticate, receive JWT |
| GET | /api/auth/me | JWT | Current authenticated user |
| PATCH | /api/auth/preferences | JWT | Update notification preferences |

### Analysis Sessions

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | /api/sessions | JWT (opt) | Create and start analysis |
| GET | /api/sessions/{id} | — | Poll status + results |
| GET | /api/sessions/{id}/export | — | Download ZIP package |
| GET | /api/sessions/{id}/export/pdf | — | Download HTML report |
| POST | /api/sessions/{id}/analyze | — | Re-run / fork session |
| GET | /api/sessions/{id}/versions | — | All versions of same feature |
| GET | /api/sessions/{id}/heatmap | — | Risk likelihood×impact matrix |
| POST | /api/sessions/{id}/notify | JWT | Email report to address |
| PATCH | /api/sessions/{id}/integrations | — | Set Slack/Jira/GitHub/Linear config |
| POST | /api/sessions/{id}/share | — | Generate public share token |
| POST | /api/sessions/{id}/compliance/{std} | JWT | Apply GDPR/SOC2/HIPAA checklist |
| POST | /api/sessions/{id}/annotations | JWT | Add inline comment |
| GET | /api/sessions/{id}/annotations | — | Get comments for session |
| DELETE | /api/sessions/{id}/annotations/{ann} | JWT | Delete own comment |
| POST | /api/sessions/{id}/export/confluence | JWT | Push report to Confluence |
| POST | /api/sessions/{id}/export/notion | JWT | Push report to Notion |
| POST | /api/sessions/{id}/export/linear | — | Create Linear issues |

### Shared Views

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | /api/shared/{token} | — | Public read-only session view |
| GET | /api/compare | — | `?a={id}&b={id}` comparison |

### API Keys & Webhook

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | /api/keys | JWT | Generate API key |
| GET | /api/keys | JWT | List active keys |
| DELETE | /api/keys/{id} | JWT | Revoke key |
| POST | /api/webhook/analyze | API Key | CI/CD trigger endpoint |

### Teams & Branding

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | /api/teams | JWT | Create workspace |
| GET | /api/teams | JWT | List my workspaces |
| POST | /api/teams/{id}/invite | JWT | Invite member by email |
| GET | /api/teams/accept/{token} | JWT | Accept invitation |
| GET | /api/teams/{id}/members | JWT | List members |
| DELETE | /api/teams/{id}/members/{email} | JWT | Remove member |
| PATCH | /api/teams/{id}/branding | JWT | Update brand colour/logo/name |
| GET | /api/teams/{id}/branding | JWT | Get branding config |

### Templates & Compliance

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | /api/templates | — | Built-in + custom templates |
| POST | /api/templates | JWT | Save custom template |
| DELETE | /api/templates/{id} | JWT | Delete own template |
| GET | /api/compliance | — | List GDPR/SOC2/HIPAA templates |
| GET | /api/compliance/{std} | — | Full compliance checklist |

### History & Trends

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | /api/history | JWT | User's completed analysis history |
| GET | /api/trends | JWT | Readiness score trend data |

### Observability & Admin

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | /health | — | Health check |
| GET | /metrics | — | Prometheus metrics |
| GET | /api/audit | Admin JWT | Full audit log |
| POST | /api/admin/login | — | Admin authentication |
| GET | /api/admin/users | Admin JWT | List all users |
| GET | /api/admin/users/{email}/history | Admin JWT | User detail + sessions |
| GET | /api/admin/stats | Admin JWT | Platform statistics |

---

## Agent Prompts and Validation

### Navigator Agent

**Input**: `{ feature_title: str, feature_description: str }`

**Output**:

```json
{
  "release_spec": {
    "problem": "...",
    "target_users": [],
    "personas": [{ "name", "role", "needs", "pain_points" }],
    "core_use_cases": [],
    "user_stories": [],
    "non_functional_requirements": [],
    "success_metrics": [],
    "meta": { "confidence": "Low|Medium|High", "needs_more_detail": bool, "missing_fields": [] }
  },
  "risk_register": {
    "risks": [{ "id", "title", "category", "likelihood", "impact", "severity", "mitigation_ideas" }]
  },
  "readiness_checklist": {
    "checklist": [{ "id", "category", "item", "owner_role", "priority" }]
  }
}
```

### Sentinel Agent

**Input**: Full Navigator output

**Output**:

```json
{
  "testing_strategy": { "levels": [{ "level", "description", "primary_owners", "notes" }] },
  "test_cases": { "test_cases": [{ "id", "name", "linked_risks", "category", "abstract_input", "expected_behavior", "automation" }] },
  "guardrails": { "guardrails": [{ "id", "name", "description", "risk_ids", "where_applied", "implementation_idea" }] }
}
```

### Herald Agent

**Input**: `feature_title` + Navigator + Sentinel outputs

**Output**:

```json
{
  "release_notes": { "title", "version", "summary", "whats_new", "why_it_matters", "known_limitations" },
  "landing_copy": { "hero_title", "hero_subtitle", "tagline", "key_benefits", "feature_sections", "trust_and_safety", "cta" },
  "pitch_outline": { "slides": [{ "id", "title", "key_points", "objective", "notes_for_speaker" }] }
}
```

---

## Usage Patterns

### Individual Analysis

1. Sign up or log in via the web interface
2. Choose **Live Analysis** mode; enter feature title and description (or apply a preset template)
3. Monitor real-time pipeline progress: Navigator → Sentinel → Herald
4. Review results across 4 tabs: **Overview · Spec & Risks · Tests & Guardrails · Docs & Launch**
5. In Spec & Risks: view the **Risk Heatmap**, apply a **Compliance template** (GDPR/SOC2/HIPAA), and add **inline annotations**
6. On completion, the full action bar appears: **🔄 Re-analyze · 🔗 Share · ⬇ Package · 📄 PDF · ✉ Email · ⚡ Compare**
7. Export the complete package (ZIP or HTML report), or push to Confluence / Notion

### Team Collaboration

1. Create a **Team Workspace** — invite colleagues by email
2. Set **Custom Branding** — org name, colour, logo for exported reports
3. Generate an **API Key** and trigger analyses from CI/CD pipelines
4. Share session URLs publicly via 🔗 Share for stakeholder review
5. Use **Side-by-side Comparison** (⚡ Compare) to track risk improvement across feature iterations

### CI/CD Integration

```bash
# In your release pipeline:
curl -X POST https://your-releaseops-url/api/webhook/analyze \
  -H "Authorization: Bearer ro_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "feature_title": "Payment Fraud Detection v2",
    "feature_description": "...",
    "notify_email": "release-team@company.com"
  }'
```

### Demo Showcase

1. Switch to **Demo Showcase** mode (no login required)
2. Load any of the three pre-built scenarios: **AI Legal Email Assistant**, **Real-Time AI Trading Platform**, or **Smart Notifications** (vague input)
3. Explore the full Risk Heatmap, compliance tools, and export options — no API calls needed

---

## CI/CD & Testing

### GitHub Actions Pipeline (`.github/workflows/ci.yml`)

```
push / PR
    │
    ├─► Lint      flake8 + black + isort
    ├─► Test      pytest (unit + API tests, DEMO_MODE=true)
    ├─► E2E       Playwright (15 scenarios against live server)
    └─► Docker    docker buildx — validates the production image builds
```

### Running tests locally

```bash
# Unit + API tests
DEMO_MODE=true JWT_SECRET=test pytest tests/ -v

# Playwright E2E (requires server running on :3001)
DEMO_MODE=true python main.py &
npx playwright test tests/e2e.spec.js
```

### Playwright E2E coverage (`tests/e2e.spec.js`)

| # | Test |
|---|---|
| 1 | Health endpoint returns `ok` |
| 2 | Home page loads with correct title |
| 3 | User signup flow |
| 4 | Login after signup |
| 5 | `/api/auth/me` returns user info |
| 6 | `POST /api/sessions` creates session |
| 7 | Session completes within 30 s (demo mode) |
| 8 | Templates endpoint returns 4+ built-in presets |
| 9 | Compliance endpoint returns GDPR/SOC2/HIPAA |
| 10 | API key create + revoke lifecycle |
| 11 | Team workspace creation |
| 12 | Mock sessions endpoint returns demos |
| 13 | `/metrics` returns Prometheus format |
| 14 | Rate limiting returns HTTP 429 on flood |
| 15 | Frontend session board is accessible via URL |

---

## Production Considerations

| Concern | Guidance |
|---|---|
| **LLM calls** | Set `DEMO_MODE=false`; configure `CLIENT_ID` and `CLIENT_SECRET` |
| **Session storage** | Completed sessions persisted to SQLite `sessions_db` table + immutable JSON on disk |
| **User storage** | `users.json` is file-based; replace with Postgres for multi-instance setups |
| **Rate limiting** | Per-IP (10/min) and per-user (20/min) built-in; add nginx upstream limiting for extra protection |
| **LLM reliability** | Retry with exponential backoff (3 attempts, 1.5 s base) on all agent calls |
| **Observability** | Structured JSON logs with `trace_id` per request; Prometheus `/metrics` endpoint |
| **HTTPS** | Required for JWT token security in production |
| **Secrets** | Never commit `.env`; use a secret manager in production |
| **Email** | Configure `SMTP_*` variables to enable email notifications and team invites |
| **Multi-worker** | Use `gunicorn -c gunicorn.conf.py` for production; or Docker Compose |

---

## Changelog

### v2.0.0 — 2026-03-03
- All 6 session action buttons (🔄 Re-analyze, 🔗 Share, ⬇ Package, 📄 PDF, ✉ Email, ⚡ Compare) now correctly appear for completed live sessions
- Compliance template apply now persists merged checklist to disk (survives server restarts)
- Compliance apply re-renders the Spec & Risks tab immediately with a toast notification instead of a blocking alert
- Fixed backend `KeyError` when applying compliance to sessions loaded from disk rather than memory
- Added `/static/{filename}` route for serving static file downloads (codebase ZIP etc.)
- Added comprehensive problem statement and feature walkthrough documentation

---

**License**: MIT
**Maintainer**: ReleaseOps Team
**Version**: 2.0.0
**Live App**: https://6pycqjui.run.complete.dev/


## V2 Governance Endpoints

- `GET /api/sessions/{id}/v2/summary` → readiness score + blockers + compliance mapping
- `GET /api/sessions/{id}/v2/diff` → diff against previous version (same feature title)
- `GET /api/sessions/{id}/v2/compliance` → lightweight compliance mapping (heuristic)
- `GET /api/sessions/{id}/export/evidence` → evidence pack ZIP (md/csv/json)
