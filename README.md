<div align="center">

# ReleaseOps Agent

### AI-Powered Release Readiness Platform

Ship AI features with confidence — automated risk analysis, compliance mapping, and release governance in one platform.

[![Python 3.12](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## What is ReleaseOps Agent?

ReleaseOps Agent is a release readiness copilot that runs three specialized AI agents in sequence to transform a feature description into a complete pre-launch package — risk register, test plan, guardrails, release notes, and compliance mapping — in under 90 seconds.

**Before LaunchGuard:** Teams spend days manually compiling risk assessments, writing test plans, and checking regulation alignment before shipping AI features.

**After LaunchGuard:** Paste your feature description, get a structured readiness report with actionable items, risk scores, and compliance evidence — ready for stakeholder review.

---

## Core Pipeline

Three AI agents orchestrated by [LangGraph](https://github.com/langchain-ai/langgraph) run in sequence:

| Agent | Role | Output |
|-------|------|--------|
| **Navigator** | Release Spec & Risk Designer | Problem statement, personas, user stories, risk register, readiness checklist |
| **Sentinel** | Test & Guardrail Planner | Testing strategy, linked test cases, guardrails with implementation guidance |
| **Herald** | Docs & GTM Storyteller | Release notes, landing page copy, pitch deck outline |

Each output is validated, scored (0–100 readiness grade), and persisted for audit.

---

## Key Features

| Category | Capabilities |
|----------|-------------|
| **Risk Analysis** | Automated risk register across Safety, Security, Privacy, and UX/Business categories. Readiness scoring with letter grades (A–F). Risk heatmap visualization. |
| **Compliance** | Maps to 7 regulation frameworks — EU AI Act, OWASP Top 10 LLM, NIST AI RMF, ISO 42001, GDPR, SOC 2, HIPAA. EU AI Act risk classification. Compliance certificates. |
| **Governance** | Role-based sign-offs (PM, Legal, QA, Security). Configurable CI/CD quality gates. Full audit trail with structured logging. |
| **Integrations** | Slack notifications, Jira issue creation, GitHub PR comments, Linear issues, Confluence/Notion export, webhook/CI-CD triggers. |
| **Collaboration** | Team workspaces with invite flow. Session annotations. Shareable report links. Email notifications. Branding customization. |
| **Analysis Tools** | Session version comparison (diff). Re-analysis with version tracking. Evidence pack export (auditor-ready ZIP). PDF export. Trend analytics. |

---

## Architecture

```
launchguard/
├── backend/                        # FastAPI + LangGraph (Python 3.12)
│   ├── main.py                     # Slim entry-point (189 lines) — router wiring & startup
│   ├── app/
│   │   ├── agents/
│   │   │   └── pipeline.py         # LangGraph orchestration, prompts, demo mode, validation
│   │   ├── api/                    # 7 route modules — 80 endpoints
│   │   │   ├── auth.py             # Signup, login, profile, preferences
│   │   │   ├── sessions.py         # CRUD, pipeline trigger, export, compare, share
│   │   │   ├── admin.py            # Admin login, user management, stats
│   │   │   ├── governance.py       # Sign-offs, quality gates, certificates, audit
│   │   │   ├── regulation.py       # Frameworks, EU AI Act, compliance mapping
│   │   │   ├── integrations.py     # Slack, Jira, GitHub, Linear, Confluence, Notion, webhooks
│   │   │   └── teams.py            # Workspaces, invites, branding, API keys, templates
│   │   ├── domain/                 # Business logic (pure functions)
│   │   │   ├── regulation_engine.py # 7-framework regulation engine (788 lines)
│   │   │   ├── scoring.py          # Readiness score computation
│   │   │   ├── blockers.py         # Launch blocker derivation
│   │   │   ├── evidence_pack.py    # Auditor-ready evidence ZIP builder
│   │   │   ├── diff.py             # Session comparison engine
│   │   │   └── regulation_mapping.py
│   │   ├── infra/                  # Infrastructure concerns
│   │   │   ├── config.py           # Centralized env-var configuration
│   │   │   ├── database.py         # SQLite schema & connection management
│   │   │   ├── security.py         # Security middleware & headers
│   │   │   └── auth.py             # JWT & auth infrastructure
│   │   ├── models/
│   │   │   └── schemas.py          # Pydantic request/response models
│   │   └── deps.py                 # Shared dependencies, session store, rate limiting
│   ├── tests/                      # pytest + pytest-asyncio test suite
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                       # React 19 + Vite 8
│   ├── src/
│   │   ├── components/             # UI primitives, Pipeline view, Heatmap
│   │   ├── pages/                  # Landing, Dashboard, Sessions, Detail, Admin, Settings
│   │   ├── services/api.js         # API client layer
│   │   └── theme.js                # Design tokens
│   ├── Dockerfile
│   └── nginx.conf
└── docker-compose.yml
```

---

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 18+
- An OpenAI API key (or run in demo mode without one)

### Development Setup

```bash
# Clone
git clone https://github.com/othnielObasi/launchguard.git
cd launchguard

# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # Configure your keys (see Environment Variables below)
python main.py                # Starts on http://localhost:3001

# Frontend (separate terminal)
cd frontend
npm install
npm run dev                   # Starts on http://localhost:5173
```

### Docker (Production)

```bash
docker compose up --build
# Frontend:  http://localhost:3000
# Backend:   http://localhost:3001
# API Docs:  http://localhost:3001/docs
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | **Yes** | — | Secret key for signing JWT tokens |
| `OPENAI_API_KEY` | No | — | OpenAI API key. If unset, runs in demo mode with deterministic responses |
| `DEMO_MODE` | No | `true` | Force demo mode on/off |
| `MODEL_NAVIGATOR` | No | `gpt-4o-mini` | Model for Navigator agent |
| `MODEL_SENTINEL` | No | `gpt-4o` | Model for Sentinel agent |
| `MODEL_HERALD` | No | `gpt-4o-mini` | Model for Herald agent |
| `ADMIN_EMAIL` | No | `admin@launchguard.dev` | Bootstrap admin account email |
| `ADMIN_PASSWORD` | No | — | Bootstrap admin account password |
| `SMTP_HOST` | No | — | SMTP server for email notifications |
| `PORT` | No | `3001` | Backend server port |

---

## API Overview

LaunchGuard exposes **80 REST endpoints** organized across 7 route modules. Full interactive docs available at `/docs` (Swagger UI) and `/redoc`.

<details>
<summary><strong>Auth</strong> — Authentication & user management</summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Create account |
| POST | `/api/auth/login` | Sign in |
| GET | `/api/auth/me` | Current user profile |
| PATCH | `/api/auth/preferences` | Update notification preferences |

</details>

<details>
<summary><strong>Sessions</strong> — Analysis pipeline & results</summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sessions` | Start new analysis |
| GET | `/api/sessions` | List all sessions |
| GET | `/api/sessions/{id}` | Get session detail (with polling) |
| GET | `/api/sessions/{id}/heatmap` | Risk severity heatmap data |
| GET | `/api/sessions/{id}/export` | Export as ZIP |
| GET | `/api/sessions/{id}/export/pdf` | Export as PDF |
| GET | `/api/sessions/{id}/export/evidence` | Auditor evidence pack |
| POST | `/api/sessions/{id}/share` | Generate shareable link |
| GET | `/api/sessions/{id}/versions` | Version history |
| GET | `/api/compare` | Side-by-side session diff |

</details>

<details>
<summary><strong>Governance</strong> — Sign-offs, gates & certificates</summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sessions/{id}/sign-off` | Submit role sign-off |
| GET | `/api/sessions/{id}/sign-offs` | List sign-off status |
| POST | `/api/gates` | Create quality gate |
| POST | `/api/gates/{id}/evaluate` | Evaluate gate criteria |
| POST | `/api/sessions/{id}/certificate` | Generate compliance certificate |

</details>

<details>
<summary><strong>Regulation</strong> — Compliance frameworks</summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/regulations/frameworks` | List all 7 frameworks |
| GET | `/api/sessions/{id}/regulation-assessment` | Full regulation mapping |
| GET | `/api/sessions/{id}/eu-ai-act-classification` | EU AI Act risk tier |
| GET | `/api/compliance` | Compliance templates |

</details>

<details>
<summary><strong>Integrations</strong> — External tool connections</summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| PATCH | `/api/sessions/{id}/integrations` | Configure Slack/Jira/GitHub/Linear |
| POST | `/api/sessions/{id}/export/confluence` | Export to Confluence |
| POST | `/api/sessions/{id}/export/notion` | Export to Notion |
| POST | `/api/sessions/{id}/export/linear` | Create Linear issues |
| POST | `/api/webhook/analyze` | Webhook/CI-CD trigger |

</details>

<details>
<summary><strong>Teams</strong> — Workspaces & collaboration</summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/teams` | Create workspace |
| POST | `/api/teams/{id}/invite` | Invite member |
| PATCH | `/api/teams/{id}/branding` | Update team branding |
| POST | `/api/keys` | Create API key |
| POST | `/api/templates` | Create analysis template |
| POST | `/api/sessions/{id}/annotations` | Add annotation |

</details>

---

## Security

LaunchGuard implements defense-in-depth security:

- **Input Sanitization** — 20 prompt injection patterns blocked at the API boundary
- **Output Guardrails** — LLM responses scanned for instruction-override language
- **Rate Limiting** — Per-IP (10 req/min) and per-user (20 req/min) sliding windows
- **Brute-Force Protection** — Admin login locked after 5 failed attempts (15 min cooldown)
- **Security Headers** — X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy
- **PII Detection** — Scans input for email, SSN, phone, credit card, passport, ID patterns
- **JWT Auth** — 72-hour token expiry with bcrypt password hashing
- **Audit Trail** — Every state-changing action logged with user, IP, timestamp

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.12, FastAPI 0.111, LangGraph 0.2, Pydantic v2 |
| AI | OpenAI GPT-4o / GPT-4o-mini (configurable per agent) |
| Database | SQLite with WAL mode |
| Frontend | React 19, Vite 8 |
| Auth | JWT (python-jose), bcrypt (passlib) |
| Deploy | Docker, Nginx, Gunicorn |
| Testing | pytest, pytest-asyncio, httpx |

---

## License

MIT
