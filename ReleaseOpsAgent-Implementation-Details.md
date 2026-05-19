# ReleaseOps v3 — Implementation Details

## Overview

This document details the production restructuring of ReleaseOps, combining the **V2 backend** (FastAPI + LangGraph) with the **V3 enterprise UI** (React 19) into a clean, modular project structure.

---

## 1. Project Structure

```
ReleaseOps/
├── .gitignore                          # Root ignore (Python, Node, env, data)
├── README.md                           # Project overview & quick start
├── docker-compose.yml                  # Orchestrates backend + frontend
│
├── backend/                            # FastAPI + LangGraph (Python 3.12)
│   ├── main.py                         # Monolithic API (38+ endpoints, 3500+ lines)
│   ├── agents.py                       # LangGraph agent definitions
│   ├── schemas.py                      # Pydantic models
│   ├── requirements.txt                # Python dependencies
│   ├── Dockerfile                      # Python 3.12-slim, Gunicorn
│   ├── gunicorn.conf.py                # WSGI config
│   ├── .env.example                    # Environment template
│   ├── app/
│   │   ├── domain/                     # Business logic modules
│   │   │   ├── scoring.py              # 0-100 readiness score, A-F grades
│   │   │   ├── blockers.py             # Release-blocking issue detection
│   │   │   ├── diff.py                 # Session-to-session comparison
│   │   │   ├── regulation_mapping.py   # Heuristic compliance framework detection
│   │   │   └── evidence_pack.py        # Auditor-ready ZIP builder
│   │   └── infra/                      # Infrastructure modules (NEW)
│   │       ├── config.py               # Centralised env-var configuration
│   │       ├── database.py             # SQLite connection manager + schema
│   │       ├── security.py             # Prompt injection, PII, rate limiting
│   │       └── auth.py                 # JWT, password hashing, user CRUD
│   ├── mock/                           # Demo session JSON files
│   ├── static/                         # Legacy HTML files
│   └── tests/                          # API tests + E2E specs
│
├── frontend/                           # React 19 + Vite 8
│   ├── package.json                    # Dependencies & scripts
│   ├── vite.config.js                  # Dev proxy → localhost:3001
│   ├── index.html                      # SPA entry point
│   ├── Dockerfile                      # Multi-stage: Node build → Nginx
│   ├── nginx.conf                      # SPA fallback + API proxy
│   ├── ReleaseOpsUI.jsx               # Original monolithic v3 UI (archived)
│   └── src/
│       ├── main.jsx                    # React DOM entry
│       ├── App.jsx                     # Navigation & layout
│       ├── theme.js                    # Design tokens & global CSS
│       ├── components/
│       │   ├── ui/index.jsx            # 7 reusable primitives
│       │   ├── Pipeline.jsx            # 3-agent pipeline visualisation
│       │   └── Heatmap.jsx             # Risk likelihood/impact grid
│       ├── pages/
│       │   ├── Landing.jsx             # Marketing landing page
│       │   ├── Dashboard.jsx           # Readiness overview + trends
│       │   ├── SessionsList.jsx        # Session table + compare mode
│       │   ├── SessionDetail.jsx       # 6-tab session detail (largest page)
│       │   ├── CompareView.jsx         # Side-by-side session diff
│       │   ├── Admin.jsx               # Developer dashboard + audit log
│       │   ├── Settings.jsx            # Teams, API keys, integrations, gates
│       │   ├── NewCheck.jsx            # Modal: create + run pipeline
│       │   └── GuidePanel.jsx          # Slide-out help panel
│       ├── data/
│       │   ├── sessions.js             # Demo session objects + audit log
│       │   └── regulations.js          # 7 frameworks + gate config
│       └── services/
│           └── api.js                  # Fetch wrappers for all endpoints
│
└── ReleaseOps-Codebase-Review.md      # Prior review document
```

---

## 2. Backend — Critical Fixes Applied

### 2.1 Hardcoded EFS Paths Removed

**Problem:** 7 references to `/mnt/efs/spaces/684db6ae-...` — an AWS EFS mount path from the original deployment environment — were scattered throughout `main.py`. These would cause `FileNotFoundError` on any other machine.

**Fix:** Replaced all 7 occurrences with portable constants backed by environment variables:

```python
# Before (broken on any non-EFS env)
MOCK_DIR = "/mnt/efs/spaces/684db6ae-.../mock"

# After (portable)
MOCK_DIR = os.path.join(BASE_DIR, "mock")
STATIC_DIR = os.path.join(BASE_DIR, "static")
DOWNLOADS_DIR = os.path.join(BASE_DIR, "downloads")
```

### 2.2 Leaked Secrets Replaced

**Problem:** `.env` file contained real credentials:
- OpenAI API key (`sk-proj-...`)
- `CLIENT_SECRET` value
- `ADMIN_PASSWORD` value

**Fix:** All secrets replaced with placeholder values (`your-openai-api-key-here`, etc.). Added `.env.example` as a template. The `.gitignore` now excludes `.env` files.

### 2.3 DEMO_MODE Double-Definition Fixed

**Problem:** `DEMO_MODE` was defined twice in `main.py` — first as a simple `os.getenv()` read (line ~113), then again as a computed variable that also checked for empty `OPENAI_API_KEY`. The first definition was silently overridden.

**Fix:** Removed the redundant first assignment, keeping only the computed version that correctly falls back to demo mode when no API key is configured.

### 2.4 ORG_ID Hardcoded Default Removed

**Problem:** `ORG_ID` had a hardcoded UUID default (`684db6ae-...`), tying the app to a specific tenant.

**Fix:** Default changed to empty string. Each deployment must set its own `ORG_ID`.

### 2.5 Path Traversal Protection Added

**Problem:** The static file serving endpoint accepted user-provided filenames without validation, allowing `../../etc/passwd` style attacks.

**Fix:** Added `pathlib.Path.resolve()` check to ensure the resolved path stays within the intended static directory:

```python
full_path = (Path(STATIC_DIR) / filename).resolve()
if not str(full_path).startswith(str(Path(STATIC_DIR).resolve())):
    raise HTTPException(status_code=403, detail="Forbidden")
```

### 2.6 Frontend Null Check

**Problem:** The `serve_frontend()` catch-all route would crash with a `FileNotFoundError` if the frontend build directory didn't exist.

**Fix:** Added an existence check before attempting to serve `index.html`.

---

## 3. Backend — New Infrastructure Modules

Four modules were extracted from `main.py` to prepare for full modularisation. These are currently standalone — `main.py` has not yet been wired to import from them (that's a future step).

### 3.1 `app/infra/config.py` — Centralised Configuration

All `os.getenv()` reads consolidated into one module:

| Category | Variables |
|----------|-----------|
| Paths | `BASE_DIR`, `DATA_DIR`, `LOG_DIR`, `SESSIONS_DIR`, `MOCK_DIR`, `STATIC_DIR`, `DOWNLOADS_DIR` |
| API Keys | `OPENAI_API_KEY`, `CLIENT_ID`, `CLIENT_SECRET`, `ADMIN_PASSWORD` |
| JWT | `JWT_SECRET`, `JWT_ALGORITHM`, `JWT_EXPIRATION_HOURS` |
| App | `DEMO_MODE`, `DEBUG`, `ORG_ID`, `PORT` |
| Models | `MODEL_PRIMARY`, `MODEL_SECONDARY` (routing for gpt-4o vs gpt-4o-mini) |

### 3.2 `app/infra/database.py` — SQLite Manager

- `get_db()`: context manager yielding SQLite connection with WAL mode, foreign keys enabled
- `init_db()`: creates all governance tables (users, sessions, analysis_results, audit_log, risks, test_cases, guardrails, checklist_items, plus 2 new: `governance_signoffs`, `gate_configs`)
- `audit(action, email, status, reason, ip, user_agent)`: structured audit logging

### 3.3 `app/infra/security.py` — Security Utilities

- **Prompt injection detection**: 26 regex patterns covering ignore-previous, system-prompt extraction, encoding tricks, role impersonation
- **PII detection**: 6 types (email, phone, SSN, credit card, passport, date of birth)
- **Output guard**: Scans LLM responses for PII leakage + prompt injection artifacts
- **Rate limiter**: `RateLimiter` class (sliding window), pre-configured:
  - `ip_limiter`: 10 requests per 60 seconds
  - `user_limiter`: 20 requests per 60 seconds
- **Admin brute-force protection**: Lockout after 5 failed attempts

### 3.4 `app/infra/auth.py` — Authentication

- `create_token(email, role)`: JWT generation with expiry
- `verify_token(token)`: decode + validate
- `require_admin`: FastAPI dependency for admin-only endpoints
- `hash_password` / `verify_password`: bcrypt via passlib
- `bootstrap_admin()`: creates initial admin user from env vars
- Role constants: `ROLE_ADMIN`, `ROLE_USER`

---

## 4. Frontend — Component Decomposition

The monolithic 284-line `ReleaseOpsUI.jsx` was decomposed into 18 files across 5 layers:

### 4.1 Design System — `src/theme.js`

Extracted all design tokens into a single source of truth:

| Export | Purpose |
|--------|---------|
| `T` | 30+ colour tokens (bg, surface, border, green, purple, red, orange, blue, teal, pink, yellow, text) |
| `FONT_SANS` | Inter / SF Pro Display / system-ui |
| `FONT_MONO` | JetBrains Mono / SF Mono |
| `GLOBAL_CSS` | Scrollbar styles, animations (fadeUp, pulse, spin, glow), delay classes |

### 4.2 UI Primitives — `src/components/ui/index.jsx`

7 reusable components extracted from inline functions:

| Component | Props | Purpose |
|-----------|-------|---------|
| `Badge` | `color`, `size`, `style` | Colour-coded status/category labels |
| `Card` | `style`, `onClick`, `className` | Bordered container with hover effect |
| `Button` | `variant`, `size`, `onClick`, `disabled` | 6 variants (primary, cta, danger, success, ghost, default) |
| `ProgressBar` | `percent`, `color`, `height` | Animated horizontal bar |
| `CircularScore` | `score`, `size` | SVG ring with score + grade (A-F) |
| `Label` | `children` | Uppercase section header |
| `Spinner` | `size`, `color` | CSS-animated loading indicator |

### 4.3 Feature Components

| Component | File | Description |
|-----------|------|-------------|
| `Pipeline` | `src/components/Pipeline.jsx` | 3-agent progress visualisation with live log streaming. Tracks Navigator → Sentinel → Herald phases with animated glow and per-agent log output. |
| `Heatmap` | `src/components/Heatmap.jsx` | Risk likelihood × impact matrix. Builds a 3×3 grid, places risks in cells, colour-codes by severity. |

### 4.4 Pages (9 files in `src/pages/`)

| Page | Lines | Description |
|------|-------|-------------|
| `Landing.jsx` | ~65 | Hero section, regulation engine showcase (4 frameworks), governance features (6 cards), CTA |
| `Dashboard.jsx` | ~85 | 6-stat overview, SVG score trend chart, recent sessions list, governance status (gate config, drift alerts, pending sign-offs) |
| `SessionsList.jsx` | ~80 | Filterable table (all/live/demo), compare mode with 2-session checkbox selection, sortable columns |
| `SessionDetail.jsx` | ~300 | Largest page — 6 tabs decomposed into sub-components: `OverviewTab` (score breakdown, risk severity, checklist, GTM preview), `SpecTab` (heatmap, risk register, readiness checklist), `TestsTab` (test cases, guardrails), `DocsTab` (release notes, GTM page, pitch deck), `RegulationTab` (EU AI Act classification, OWASP vulnerabilities, NIST mapping, compliance summary), `GovernanceTab` (sign-offs, gate evaluation, compliance certificate, drift monitor, audit trail) |
| `CompareView.jsx` | ~60 | Side-by-side cards with scores, stats, EU tier, risks, sign-offs, and score delta |
| `Admin.jsx` | ~75 | Developer dashboard with 4 stats, 3 tabs (users, login history with paginated table, regulation framework updates) |
| `Settings.jsx` | ~60 | 4 tabs: teams/workspace, API keys, integrations (Slack, Jira, GitHub, Linear, Webhook), gate configuration |
| `NewCheck.jsx` | ~65 | Modal overlay — form (industry preset, title, description, release type) → runs pipeline with live logs → redirects to session detail |
| `GuidePanel.jsx` | ~55 | Slide-out panel — quick start steps, agent descriptions, regulation engine overview, governance feature list |

### 4.5 App Shell — `src/App.jsx`

- State management: `page`, `authenticated`, `sessionId`, `showNew`, `showGuide`, `compareA`/`compareB`
- Sticky navbar with nav links (Dashboard, Sessions, Admin, Settings), + New Check button, Guide toggle, user menu
- Conditional rendering of all 7 page components + 2 overlays (NewCheck modal, GuidePanel)
- Footer with AI disclaimer

### 4.6 Data Layer — `src/data/`

| File | Exports |
|------|---------|
| `sessions.js` | `S_DATA` (5 demo sessions with full risk/governance/drift data), `AUDIT_LOG` (10 entries) |
| `regulations.js` | `REG_FRAMEWORKS` (7 frameworks with articles/requirements), `GATE_CONFIG` (production gate rules) |

### 4.7 API Service Layer — `src/services/api.js`

Centralised fetch wrappers with auth header injection and error normalisation:

| Module | Endpoints |
|--------|-----------|
| `auth` | `login`, `signup`, `me` |
| `sessions` | `list`, `get`, `create`, `delete` |
| `analysis` | `run`, `status`, `results` |
| `governance` | `signoffs`, `signoff`, `gates`, `evaluateGate` |
| `admin` | `users`, `auditLog`, `stats` |
| `exports` | `evidencePack`, `certificate` |
| `health` | Health check |

All requests proxy through Vite dev server (`/api` → `localhost:3001`).

---

## 5. Docker & Deployment

### 5.1 Backend Dockerfile (existing, unchanged)

- Base: `python:3.12-slim`
- Installs system deps (gcc, curl), pip installs from `requirements.txt`
- Creates required dirs, runs as non-root `appuser`
- Healthcheck on `/health`
- Entry: `gunicorn -c gunicorn.conf.py main:app`

### 5.2 Frontend Dockerfile (new)

- **Build stage**: `node:20-alpine`, `npm ci`, `npm run build`
- **Serve stage**: `nginx:alpine`, copies build output + custom `nginx.conf`
- Serves SPA with `/api/` proxy to backend container

### 5.3 Nginx Configuration (new)

- SPA fallback: `try_files $uri $uri/ /index.html`
- API proxy: `/api/` → `http://backend:3001/api/`
- Static asset caching: `/assets/` with 1-year expiry + immutable

### 5.4 Docker Compose (new)

- 2 services: `backend` (port 3001), `frontend` (port 3000)
- Named volumes for backend data and logs
- Frontend depends on backend
- Both services restart unless stopped

---

## 6. Build Verification

```
$ cd frontend && npx vite build
✓ 30 modules transformed
dist/index.html                  0.64 kB │ gzip:  0.39 kB
dist/assets/index-y2Ga56W-.js  261.05 kB │ gzip: 77.00 kB
✓ built in 193ms
```

---

## 7. Remaining Work

| Item | Status | Notes |
|------|--------|-------|
| Wire `main.py` to import from `app/infra/` modules | Pending | `main.py` still has duplicated inline logic alongside the new extracted modules |
| Replace demo data with live API calls | Pending | Components currently use hardcoded `S_DATA`; API service layer is ready |
| Add CSS modules or Tailwind | Optional | Currently all inline styles (carried over from v3 UI) |
| Add React Router | Optional | Currently using state-based navigation |
| Add error boundaries | Pending | No error handling on component failures |
| Add loading states | Pending | No skeleton/loading UI during API calls |
| Clean up old directories | Pending | `releaseops_codebase_prod_updated/`, `releaseops_codebase_v2_updated/`, root JSX files still present |
| CI/CD pipeline | Pending | No GitHub Actions workflow yet |
| Environment-specific configs | Pending | No staging/production env differentiation |

---

## 8. Tech Stack Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| Backend Runtime | Python | 3.12 |
| Backend Framework | FastAPI | 0.111.0 |
| Agent Orchestration | LangGraph | 0.2.28 |
| LLM | OpenAI (gpt-4o / gpt-4o-mini) | — |
| Data Validation | Pydantic | 2.7.4 |
| Database | SQLite (WAL mode) | — |
| Auth | python-jose (JWT) + passlib (bcrypt) | — |
| WSGI | Gunicorn + UvicornWorker | — |
| Frontend Runtime | React | 19.2.4 |
| Build Tool | Vite | 8.0.1 |
| Reverse Proxy | Nginx | alpine |
| Containerisation | Docker + Docker Compose | — |
