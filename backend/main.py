"""
ReleaseOps – Release Readiness Copilot (slim entry-point)
All business logic lives in app.api.*, app.agents.*, app.domain.*, app.infra.*
"""
import uuid, asyncio, logging, contextvars, json, os
import time as _time
from collections import defaultdict
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.responses import FileResponse, PlainTextResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.infra.config import (
    STATIC_DIR, LOG_DIR, LOG_LEVEL, LOG_TO_FILE, PORT,
)
from app.infra.database import init_db
from app.domain.regulation_engine import init_regulation_db
from app.deps import (
    sessions, reload_sessions_from_disk, bootstrap_admin, require_admin,
    logger, get_db, load_users, save_users,
)

# ── Route modules ─────────────────────────────────────────────────────────────
from app.api.auth import router as auth_router
from app.api.sessions import router as sessions_router, set_pipeline_runner
from app.api.admin import router as admin_router
from app.api.governance import router as governance_router
from app.api.regulation import router as regulation_router
from app.api.integrations import router as integrations_router, set_webhook_pipeline_runner
from app.api.teams import router as teams_router
from app.api.webhooks import router as webhooks_router

# ── Pipeline (agents) ─────────────────────────────────────────────────────────
from app.agents.pipeline import run_pipeline

# ═══════════════════════════════════════════════════════════════════════════════
# Logging
# ═══════════════════════════════════════════════════════════════════════════════

from datetime import datetime, timezone

_trace_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("trace_id", default="")


class JsonFormatter(logging.Formatter):
    def format(self, record):
        return json.dumps({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
            "trace_id": _trace_id_var.get(""),
        })


_lg = logging.getLogger("ReleaseOps")
_lg.setLevel(getattr(logging, LOG_LEVEL, logging.INFO))
_lg.propagate = False
if not _lg.handlers:
    sh = logging.StreamHandler()
    sh.setFormatter(JsonFormatter())
    _lg.addHandler(sh)
    if LOG_TO_FILE:
        fh = logging.FileHandler(str(LOG_DIR / "ReleaseOps.log"))
        fh.setFormatter(JsonFormatter())
        _lg.addHandler(fh)


# ═══════════════════════════════════════════════════════════════════════════════
# Lifespan & background tasks
# ═══════════════════════════════════════════════════════════════════════════════

async def _periodic_cleanup():
    """Hourly: evict stale sessions, clear expired rate-limit entries."""
    while True:
        await asyncio.sleep(3600)
        now = _time.time()
        cutoff = now - 86400
        stale = [
            sid for sid, s in list(sessions.items())
            if (s.get("session") or s).get("status") in ("complete", "error")
            and s.get("created_at")
            and _time.mktime(_time.strptime(s["created_at"][:19], "%Y-%m-%dT%H:%M:%S")) < cutoff
        ]
        for sid in stale:
            sessions.pop(sid, None)
        logger.info(json.dumps({"event": "periodic_cleanup", "stale_sessions_evicted": len(stale)}))


@asynccontextmanager
async def _lifespan(app):
    init_db()
    init_regulation_db()
    bootstrap_admin()
    reload_sessions_from_disk()
    cleanup_task = asyncio.create_task(_periodic_cleanup())
    logger.info(json.dumps({"event": "releaseops_start"}))
    yield
    cleanup_task.cancel()


# ═══════════════════════════════════════════════════════════════════════════════
# FastAPI App
# ═══════════════════════════════════════════════════════════════════════════════

app = FastAPI(title="ReleaseOps", version="2.0.0", lifespan=_lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        tid = request.headers.get("X-Request-ID") or str(uuid.uuid4())[:8]
        _trace_id_var.set(tid)
        response = await call_next(request)
        response.headers["X-Request-ID"] = tid
        response.headers["X-Content-Type-Options"]  = "nosniff"
        response.headers["X-Frame-Options"]          = "DENY"
        response.headers["X-XSS-Protection"]         = "1; mode=block"
        response.headers["Referrer-Policy"]           = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"]        = "geolocation=(), microphone=(), camera=()"
        return response

app.add_middleware(SecurityHeadersMiddleware)


# ── Register routers ─────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(sessions_router)
app.include_router(admin_router)
app.include_router(governance_router)
app.include_router(regulation_router)
app.include_router(integrations_router)
app.include_router(teams_router)
app.include_router(webhooks_router)


# ── Wire pipeline runners (avoids circular imports) ──────────────────────────
set_pipeline_runner(run_pipeline)
set_webhook_pipeline_runner(run_pipeline)


# ═══════════════════════════════════════════════════════════════════════════════
# Top-level routes (health, metrics, static, frontend catch-all)
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/health")
async def health():
    return {"status": "ok", "sessions": len(sessions)}


@app.get("/health")
async def legacy_health():
    return await health()


@app.get("/api/metrics")
async def metrics():
    total = len(sessions)
    complete = sum(1 for s in sessions.values() if (s.get("session") or s).get("status") == "complete")
    error = sum(1 for s in sessions.values() if (s.get("session") or s).get("status") == "error")
    return {"total_sessions": total, "complete": complete, "error": error, "running": total - complete - error}


@app.get("/metrics", response_class=PlainTextResponse)
async def legacy_metrics():
    data = await metrics()
    lines = [
        "# HELP releaseops_sessions_total Total ReleaseOps sessions",
        "# TYPE releaseops_sessions_total gauge",
        f"releaseops_sessions_total {data['total_sessions']}",
        "# HELP releaseops_sessions_complete Completed ReleaseOps sessions",
        "# TYPE releaseops_sessions_complete gauge",
        f"releaseops_sessions_complete {data['complete']}",
        "# HELP releaseops_sessions_error Failed ReleaseOps sessions",
        "# TYPE releaseops_sessions_error gauge",
        f"releaseops_sessions_error {data['error']}",
        "# HELP releaseops_sessions_running Running ReleaseOps sessions",
        "# TYPE releaseops_sessions_running gauge",
        f"releaseops_sessions_running {data['running']}",
    ]
    return "\n".join(lines) + "\n"


@app.get("/api/audit")
async def get_audit_log(limit: int = 100, email: str = Depends(require_admin)):
    import psycopg2.extras
    with get_db() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
        "SELECT * FROM audit_log ORDER BY created_at DESC LIMIT %s", (min(limit, 500),)
        )
        rows = cur.fetchall()
        cur.close()
    return [dict(r) for r in rows]


def _frontend_redirect_target(request: Request, full_path: str = "") -> str | None:
    configured_frontend = os.getenv("FRONTEND_URL", "").strip().rstrip("/")
    base_url = configured_frontend
    host = request.url.hostname or "localhost"
    scheme = request.url.scheme
    path = f"/{full_path.lstrip('/')}" if full_path else ""

    if not base_url and request.url.port == 3001:
        base_url = f"{scheme}://{host}"

    if not base_url:
        return None

    return f"{base_url}{path}" or "/"


@app.get("/")
async def redirect_root_to_frontend(request: Request):
    target = _frontend_redirect_target(request)
    if not target:
        return PlainTextResponse("ReleaseOps API is running on this port. Open the frontend on port 80.")
    return RedirectResponse(url=target, status_code=307)


@app.get("/static/{filename}")
async def serve_static_file(filename: str):
    file_path = (STATIC_DIR / filename).resolve()
    if not str(file_path).startswith(str(STATIC_DIR.resolve())):
        raise HTTPException(status_code=403, detail="Access denied")
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(str(file_path), filename=filename)


@app.get("/{full_path:path}")
async def redirect_frontend_routes(full_path: str, request: Request):
    target = _frontend_redirect_target(request, full_path)
    if not target:
        raise HTTPException(status_code=404, detail="Not found")
    return RedirectResponse(url=target, status_code=307)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
