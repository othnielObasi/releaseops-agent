# ReleaseOps Agent — Codebase & UI Review

**Date:** March 20, 2026  
**Reviewer:** GitHub Copilot  
**Assets Reviewed:**
- `releaseops-agent_codebase_prod_updated/` (Production Backend)
- `releaseops-agent_codebase_v2_updated/` (V2 Backend)
- `releaseops-agent-ui.jsx` (UI v1)
- `releaseops-agent-ui (1).jsx` (UI v2)
- `releaseops-agent-ui (2).jsx` (UI v3)

---

## 1. System Overview

**ReleaseOps Agent** is an AI-powered Release Readiness Copilot that uses a three-agent LangGraph pipeline (Navigator → Sentinel → Herald) to transform feature descriptions into structured release-readiness artifacts:

```
Input (feature_title, feature_description)
  ↓
[Navigator] → Release Spec, Risk Register, Readiness Checklist
  ↓
[Sentinel] → Testing Strategy, Test Cases, Guardrails
  ↓
[Herald]   → Release Notes, Landing Copy, Pitch Deck Outline
  ↓
Output: LaunchGuardSessionResponse + Readiness Score (0–100)
```

---

## 2. Production Backend Review (`launchguard_codebase_prod_updated/`)

### Architecture

| Component        | Technology                            |
|------------------|---------------------------------------|
| Framework        | FastAPI + LangGraph                   |
| Database         | SQLite (9 tables)                     |
| Authentication   | JWT (72h) + Bcrypt                    |
| LLMs             | OpenAI (gpt-4o, gpt-4o-mini)         |
| Deployment       | Docker + Gunicorn (auto-scaling workers) |
| Security         | Prompt injection filters, PII detection, rate limiting |

### File Structure

| File                        | Purpose                                                     | LOC   |
|-----------------------------|-------------------------------------------------------------|-------|
| `main.py`                   | Monolithic core: all API endpoints, agents, scoring, integrations | ~3500 |
| `agents.py`                 | Stub/placeholder agent implementations                      | ~450  |
| `schemas.py`                | Pydantic data models (strict type safety)                   | ~200  |
| `gunicorn.conf.py`          | Production WSGI config (auto-workers, 120s timeout)         | ~40   |
| `Dockerfile`                | Python 3.12-slim, non-root user, healthcheck                | ~30   |
| `docker-compose.yml`        | Service definition with named volumes                       | ~40   |
| `requirements.txt`          | FastAPI, LangGraph, OpenAI, auth, testing deps              | ~15   |
| `tests/test_api.py`         | Pytest integration tests (auth, sessions, keys, teams)      | ~200  |
| `tests/e2e.spec.js`         | Playwright E2E tests (15 scenarios)                         | ~300  |
| `types/launchguard.ts`      | TypeScript interfaces for frontend integration              | ~200  |
| `.github/workflows/ci.yml`  | CI/CD: lint, test, E2E, Docker build (4 jobs)               | ~130  |
| `app/` (all `__init__.py`)  | Empty structural placeholders for planned modular refactor   | —     |

### API Endpoints (38 total)

| Category     | Endpoints                                                                 |
|--------------|---------------------------------------------------------------------------|
| Auth         | `/api/auth/signup`, `/api/auth/login`, `/api/auth/me`, `/api/admin/login` |
| Sessions     | `/api/sessions` (POST/GET), `/api/sessions/{id}`, `/api/history`          |
| Export       | `/api/sessions/{id}/export/{pdf,zip,linear,confluence,notion}`            |
| Sharing      | `/api/sessions/{id}/share`, `/api/shared/{token}`                         |
| Integrations | Slack, Jira, GitHub PR, Linear, Email (fire-and-forget)                   |
| Teams        | `/api/teams/{create,list,invite,members}`                                 |
| Templates    | `/api/templates` (built-in + custom)                                      |
| Compliance   | `/api/compliance` (GDPR, SOC2, HIPAA checklists)                         |
| Webhook      | `/api/webhook/analyze` (CI/CD trigger)                                    |
| Admin        | `/api/admin/{login,users,stats}`                                          |
| Health       | `/health`, `/metrics` (Prometheus format)                                 |

### Security Features

- 26 regex patterns blocking prompt injection / jailbreak attempts
- Output guards on LLM responses
- PII detection (email, SSN, phone, credit card, passport, ID)
- Input sanitization (2,000 char max per field)
- Rate limiting: 10 req/min per IP, 20 req/min per user
- Admin brute-force protection: 5 failures → 15 min lockout
- HMAC-SHA256 API key hashing
- Role-based access control (super_admin vs user)
- Audit logging (user actions, integrations)

### Readiness Scoring Formula

```
score = (
  risk_coverage      × 0.30    # % High risks with tests/guardrails
  + spec_completeness × 0.20   # % spec fields filled
  + test_coverage     × 0.20   # min(100, test_count × 10)
  + guardrail_coverage × 0.15  # min(100, guardrail_count × 12)
  + checklist_readiness × 0.15 # Must-item completion
) − unmitigated_penalty         # −8 per uncovered High risk
```

### Issues Found

| Severity | Issue |
|----------|-------|
| 🔴 Critical | Hardcoded EFS mount path instead of environment variable |
| 🔴 Critical | Rate-limit stores are in-memory — reset on server restart |
| 🟠 Warning  | Admin password (`ADMIN_PASSWORD` env var) stored unhashed initially |
| 🟠 Warning  | JWT tokens issued with no refresh mechanism |
| 🟠 Warning  | Duplicate logging handler setup (lines 90–91) |
| 🟡 Note     | `agents.py` is stub-only — real logic duplicated in `main.py` |
| 🟡 Note     | `app/` package is structural placeholders only — no modular refactor done |
| 🟡 Note     | Test coverage is integration-only; no unit tests for business logic |

---

## 3. V2 Backend Review (`launchguard_codebase_v2_updated/`)

### What's the Same

Identical foundation to prod: FastAPI, SQLite, JWT auth, prompt injection, rate limiting, all 38+ API endpoints, all integrations.

### What's New — Domain Modules

| Module                  | Purpose                                                           |
|-------------------------|-------------------------------------------------------------------|
| `app/domain/scoring.py` | Readiness score 0–100 with letter grades (A–F), GO / GO_WITH_MITIGATIONS / NO_GO decisions |
| `app/domain/blockers.py` | Identifies release-blocking issues with ownership assignment (Engineering, Security, Legal, Product) |
| `app/domain/diff.py`    | Version-to-version session comparison (score delta, risks added/removed, severity changes) |
| `app/domain/regulation_mapping.py` | Heuristic compliance framework detection (OWASP LLM Top 10, GDPR, NIST AI RMF, EU AI Act) |
| `app/domain/evidence_pack.py` | Builds auditor-ready ZIP: summary, risks CSV, test plan, guardrails, compliance JSON, blockers |

### New V2 API Endpoints

| Endpoint                                  | Purpose                                |
|-------------------------------------------|----------------------------------------|
| `/api/sessions/{id}/v2/summary`           | Score + blockers + compliance          |
| `/api/sessions/{id}/v2/diff`              | Version comparison                     |
| `/api/sessions/{id}/v2/compliance`        | Framework mappings                     |
| `/api/sessions/{id}/export/evidence`      | Compliance evidence pack (ZIP)         |

### Scoring Module Detail (`scoring.py`)

```python
Output:
{
  "score": 0-100,
  "grade": "A" | "B" | "C" | "D" | "F",
  "decision": "GO" (≥75) | "GO_WITH_MITIGATIONS" (≥60) | "NO_GO" (<60),
  "breakdown": { risk_coverage, spec_completeness, test_coverage, guardrail_coverage, checklist_readiness },
  "summary": { high_risks, med_risks, covered_highs, test_cases, guardrails, must_checklist }
}
```

### Blockers Module Detail (`blockers.py`)

Blocker Rules:
1. High-severity risk with NO test coverage AND NO guardrail coverage → **BLOCKER**
2. High-severity risk with NO mitigation ideas → **BLOCKER**
3. Any Must-priority checklist item → **BLOCKER** (until completion tracking added)

Output assigns blockers to owner roles: Engineering, Security, Legal/Compliance, or Product.

### Regulation Mapping Detail (`regulation_mapping.py`)

| Framework         | Trigger Keywords                                              |
|-------------------|---------------------------------------------------------------|
| OWASP LLM Top 10  | prompt injection, jailbreak, data exfil, tool misuse         |
| GDPR              | PII, personal data, data retention                           |
| NIST AI RMF       | Always included (general governance)                         |
| EU AI Act         | biometric, medical, credit, employment, law enforcement, critical infrastructure |

> **Note:** Includes a disclaimer: "This compliance mapping is heuristic and not legal advice."

### Evidence Pack Detail (`evidence_pack.py`)

ZIP contents:
- `session_summary.json` — metadata + readiness score
- `final.json` — all outputs (single source of truth)
- `readiness_report.md` — human-readable summary with blockers and compliance
- `risk_register.csv` — tabular export for Excel
- `test_plan.md` — formatted test strategy and cases
- `guardrails.md` — guardrail details with implementation ideas
- `gtm_assets.md` — marketing release notes and landing copy
- `compliance.json` — frameworks and controls
- `blockers.json` — blocker list with ownership

### V2-Specific Issues

| Severity | Issue |
|----------|-------|
| 🟠 Warning | Regulation mapping is keyword-heuristic (not ML-based), may miss edge cases |
| 🟠 Warning | All prod issues carry over (in-memory rate limits, hardcoded paths, etc.) |
| 🟡 Note   | `main.py` still monolithic — domain modules not fully wired in |

---

## 4. UI v1 Review (`launchguard-ui.jsx`)

### Overview

| Attribute          | Detail                                  |
|--------------------|-----------------------------------------|
| Maturity           | **Prototype**                           |
| Pages              | 7 (Dashboard, Pipeline, Live Analysis, Risk Register, Demos, Artefacts, Settings) |
| Framework          | React (hooks: useState, useEffect, useRef) |
| State Management   | Local React state                       |
| API Integration    | **None** — hardcoded mock data          |
| Design System      | Dark theme (teal + gold), "Outfit" + "JetBrains Mono" fonts |

### Components

- Primitives: `Badge`, `Card`, `AgentBadge`, `SeverityBadge`
- Pages: `PipelineFlow`, `LiveAnalysis`, `DashboardPage`, `PipelinePage`, `RisksPage`, `DemosPage`, `ArtefactsPage`, `SettingsPage`
- Main export: `LaunchGuardUI`

### Features

- Sidebar navigation with "LIVE" status indicator
- Live analysis simulator (47-second pipeline animation)
- Risk register with 6 pre-loaded risks
- 3 demo scenarios (Legal AI, Vague Feature, Real-time Trading)
- Artefacts gallery (10 output types)
- Quality tier selection (Standard vs Premium)

### Issues

| Severity | Issue |
|----------|-------|
| 🟠 Warning | No API integration — demo-only |
| 🟠 Warning | XSS risk: risk descriptions rendered without sanitization |
| 🟠 Warning | No input validation on feature description textarea |
| 🟡 Note   | No error boundaries — crashes on undefined data |
| 🟡 Note   | Scrollbar styling may break on non-Chrome browsers |

---

## 5. UI v2 Review (`launchguard-ui (1).jsx`)

### Overview

| Attribute          | Detail                                  |
|--------------------|-----------------------------------------|
| Maturity           | **MVP**                                 |
| Pages              | 6 main + Guide + History                |
| Framework          | React (hooks + useCallback)             |
| State Management   | Local React state                       |
| API Integration    | **None** — mock data                    |
| Design System      | "Geist" + "Inter var" fonts, enhanced animations |

### What's New vs v1

- Professional marketing landing page
- Readiness Score as circular gauge with A–F grading
- Risk heatmap (3×3 likelihood × impact matrix)
- Staggered animations (0.04s delay increments)
- History page with trend visualization
- Industry preset dropdown
- Better button variants (primary, danger, success, ghost, cta)
- Results viewer with 4-tab interface (Overview, Spec & Risks, Tests & Docs)

### Issues

| Severity | Issue |
|----------|-------|
| 🔴 Critical | History "View" button always loads demo "legal" session regardless of selection |
| 🟠 Warning  | XSS risks (card click handlers, log output) |
| 🟠 Warning  | No form validation on signup/login |
| 🟠 Warning  | Test/risk array mapping bug: modulo index mismatch if risks < tests |
| 🟡 Note     | No accessibility (missing aria-labels, divs as buttons) |

---

## 6. UI v3 Review (`launchguard-ui (2).jsx`)

### Overview

| Attribute          | Detail                                  |
|--------------------|-----------------------------------------|
| Maturity           | **Enterprise**                          |
| Pages              | 6 main + Admin + Settings + Modals      |
| Framework          | React (hooks)                           |
| State Management   | Local React state                       |
| API Integration    | **None** — production-structured mock data |
| Design System      | Ultra-compact tokens, abbreviated component names |

### Major New Features (Not in v1/v2)

#### Regulation Engine — 7 Compliance Frameworks

| Framework        | Requirements | Jurisdiction |
|------------------|-------------|--------------|
| EU AI Act        | 87          | EU           |
| OWASP LLM Top 10 | 10         | Global       |
| NIST AI RMF      | 72          | US           |
| ISO/IEC 42001    | 39          | Global       |
| GDPR             | 12          | EU           |
| SOC 2 Type II    | 23          | US           |
| HIPAA            | 18          | US           |

#### Governance System

- Role-based sign-offs: PM, Legal, QA, Security (approved/rejected/pending)
- CI/CD Production Gate: score threshold (≥65) + required sign-offs
- Gate evaluation with pass/fail + blocker list
- Compliance certificate generation (auditor-ready)

#### Drift Monitoring

- Per-session monitoring (Weekly/Daily schedule)
- Score delta tracking (regression alerts)
- Auto-alerts on risk profile changes

#### Session Comparison

- Side-by-side view of 2 sessions
- Score diff, risk/test/guard metric comparison
- Sign-off status comparison

#### Admin Dashboard

- User statistics and login history
- Audit trail with IP/user-agent tracking
- Regulation framework status board

#### Session Detail — 6 Tabs

1. **Overview** — readiness score + breakdown
2. **Spec & Risks** — heatmap, problem statement, full register
3. **Tests & Guardrails** — 5 guardrail types
4. **Docs & Launch** — release notes, GTM page, pitch deck
5. **Regulation** — EU AI Act tier, OWASP vulns, NIST mapping, framework compliance
6. **Governance** — sign-offs, gate evaluation, certificate, drift monitor, audit trail

### Issues

| Severity | Issue |
|----------|-------|
| 🔴 Critical | Sign-off UI has no persistence — refresh loses all approvals |
| 🔴 Critical | Gate evaluation assumes all sessions require same sign-off roles |
| 🔴 Critical | Drift score delta displayed but never recomputed on re-scan |
| 🔴 Critical | PDF Certificate generation button has no handler |
| 🟠 Warning  | Regulation mapping is hardcoded per demo session (not dynamic) |
| 🟠 Warning  | EU AI Act tier is manually/statically assigned per session |
| 🟠 Warning  | Compare view doesn't handle missing sessions |
| 🟠 Warning  | Audit logs expose email addresses in plain text |
| 🟠 Warning  | Admin dashboard has no access control enforcement |
| 🟠 Warning  | XSS: session titles/descriptions rendered unsanitized |
| 🟡 Note     | No CSRF protection |
| 🟡 Note     | No rate limiting on "Run Readiness Check" button |
| 🟡 Note     | No accessibility (divs as buttons, no aria-labels, no keyboard nav) |
| 🟡 Note     | No error boundaries or undefined data handling |

---

## 7. Comparison Matrix

### Backend: Prod vs V2

| Feature                  | Prod | V2  |
|--------------------------|------|-----|
| FastAPI + LangGraph      | ✅   | ✅  |
| JWT Auth + Bcrypt        | ✅   | ✅  |
| Prompt Injection Defense | ✅   | ✅  |
| PII Detection            | ✅   | ✅  |
| Rate Limiting            | ✅   | ✅  |
| 38+ API Endpoints        | ✅   | ✅  |
| Integrations (Slack, Jira, GitHub, etc.) | ✅ | ✅ |
| Modular Scoring          | ❌   | ✅  |
| Blocker Detection        | ❌   | ✅  |
| Version Diffing          | ❌   | ✅  |
| Regulation Mapping       | ❌   | ✅  |
| Evidence Pack Export     | ❌   | ✅  |
| V2 Summary/Diff/Compliance APIs | ❌ | ✅ |

### UI: v1 vs v2 vs v3

| Feature              | v1 (Prototype) | v2 (MVP)    | v3 (Enterprise) |
|----------------------|:--------------:|:-----------:|:---------------:|
| Pages                | 7              | 6 + extras  | 6 + admin + modals |
| Landing Page         | ❌             | ✅          | ✅              |
| Readiness Gauge      | Simple %       | Circular + grade | Circular + grade |
| Risk Heatmap         | ❌             | ✅          | ✅              |
| Regulation Engine    | ❌             | ❌          | ✅ (7 frameworks) |
| Governance/Sign-offs | ❌             | ❌          | ✅              |
| CI/CD Gate           | ❌             | ❌          | ✅              |
| Drift Monitoring     | ❌             | ❌          | ✅              |
| Session Comparison   | ❌             | ❌          | ✅              |
| Admin Dashboard      | ❌             | ❌          | ✅              |
| History/Trends       | ❌             | ✅          | ✅              |
| Detail Tabs          | N/A            | 4           | 6               |
| API Integration      | ❌ (mock)      | ❌ (mock)   | ❌ (mock)       |

---

## 8. Recommendation

### Selected Assets

| Asset | Action | Reason |
|-------|--------|--------|
| `launchguard_codebase_v2_updated/` | **USE** | Superset of prod — has modular domain layer |
| `launchguard-ui (2).jsx` (v3)     | **USE** | Enterprise features align with V2 backend |
| `launchguard_codebase_prod_updated/` | Skip | Strict subset of V2 |
| `launchguard-ui.jsx` (v1)           | Skip | Prototype only |
| `launchguard-ui (1).jsx` (v2)       | Skip | MVP subset of v3 |

### Integration Work Required

1. **Connect v3 UI to V2 backend APIs** — replace hardcoded mock data with `fetch()` calls to `/v2/summary`, `/v2/diff`, `/v2/compliance`, `/export/evidence`
2. **Persist governance** — add backend tables for sign-offs, gate configs, drift schedules
3. **Dynamic regulation mapping** — wire v3 regulation tab to V2 `regulation_mapping.py`
4. **Frontend input sanitization** — sanitize all user input before rendering and before sending to backend
5. **Accessibility pass** — semantic HTML, ARIA attributes, keyboard handlers
6. **Rate limit persistence** — move from in-memory to Redis-backed stores
7. **Error boundaries** — add React error boundaries to prevent full-app crashes
8. **JWT refresh mechanism** — implement token refresh flow

---

*End of Review*
