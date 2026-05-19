"""
Database access — PostgreSQL connection manager and schema initialization.
"""
import json
import logging
from contextlib import contextmanager
from datetime import datetime, timezone
from urllib.parse import urlparse

import psycopg2
import psycopg2.extras

from app.infra.config import DATABASE_URL

logger = logging.getLogger("ReleaseOps")

# ── Connection pool (simple thread-safe approach) ─────────────────────────────

_parsed = urlparse(DATABASE_URL)
_pg_params = {
    "dbname": _parsed.path.lstrip("/"),
    "user": _parsed.username,
    "password": _parsed.password,
    "host": _parsed.hostname,
    "port": _parsed.port or 5432,
}


@contextmanager
def get_db():
    """Yield a PostgreSQL connection; auto-commits on success, rolls back on error."""
    conn = psycopg2.connect(**_pg_params)
    conn.autocommit = False
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _execute_ddl(conn, sql: str):
    """Execute a DDL statement, ignoring 'already exists' errors."""
    cur = conn.cursor()
    try:
        cur.execute(sql)
    except psycopg2.errors.DuplicateTable:
        conn.rollback()
    except psycopg2.errors.DuplicateObject:
        conn.rollback()
    finally:
        cur.close()


def init_db():
    """Create all required tables if they don't exist."""
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("""
        CREATE TABLE IF NOT EXISTS api_keys (
            id TEXT PRIMARY KEY,
            key_hash TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            created_at TEXT NOT NULL,
            last_used TEXT,
            is_active INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS teams (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            owner_email TEXT NOT NULL,
            brand_color TEXT DEFAULT '#6366f1',
            brand_logo_url TEXT,
            brand_name TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS team_members (
            team_id TEXT NOT NULL,
            email TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'member',
            joined_at TEXT NOT NULL,
            PRIMARY KEY (team_id, email)
        );

        CREATE TABLE IF NOT EXISTS team_invites (
            id TEXT PRIMARY KEY,
            team_id TEXT NOT NULL,
            inviter_email TEXT NOT NULL,
            invitee_email TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'member',
            token TEXT NOT NULL UNIQUE,
            status TEXT DEFAULT 'pending',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS annotations (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            ref_type TEXT NOT NULL,
            ref_id TEXT NOT NULL,
            text TEXT NOT NULL,
            email TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS audit_log (
            id SERIAL PRIMARY KEY,
            email TEXT,
            action TEXT NOT NULL,
            resource_id TEXT,
            metadata TEXT,
            ip TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sessions_db (
            id TEXT PRIMARY KEY,
            feature_title TEXT NOT NULL,
            feature_description TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            user_email TEXT,
            readiness_score TEXT,
            created_at TEXT NOT NULL,
            completed_at TEXT,
            parent_session_id TEXT,
            version INTEGER DEFAULT 1,
            navigator_data TEXT,
            sentinel_data TEXT,
            herald_data TEXT,
            integrations_data TEXT,
            error_text TEXT,
            pii_detected TEXT,
            validation_warnings TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_db_email ON sessions_db(user_email);
        CREATE INDEX IF NOT EXISTS idx_sessions_db_created ON sessions_db(created_at);

        CREATE TABLE IF NOT EXISTS governance_signoffs (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            user_email TEXT,
            signed_at TEXT,
            comment TEXT,
            UNIQUE(session_id, role)
        );

        CREATE TABLE IF NOT EXISTS gate_configs (
            id TEXT PRIMARY KEY DEFAULT 'default',
            name TEXT NOT NULL DEFAULT 'Default Gate',
            gate_type TEXT NOT NULL DEFAULT 'ci_cd',
            min_score INTEGER NOT NULL DEFAULT 65,
            required_signoffs TEXT NOT NULL DEFAULT '["PM","Legal","QA","Security"]',
            required_frameworks TEXT NOT NULL DEFAULT '["NIST AI RMF"]',
            active INTEGER NOT NULL DEFAULT 1,
            updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS gate_evaluations (
            id TEXT PRIMARY KEY,
            gate_id TEXT NOT NULL,
            session_id TEXT NOT NULL,
            passed INTEGER NOT NULL DEFAULT 0,
            score INTEGER DEFAULT 0,
            missing_signoffs TEXT DEFAULT '[]',
            missing_frameworks TEXT DEFAULT '[]',
            evaluated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS llm_settings (
            id TEXT PRIMARY KEY DEFAULT 'global',
            default_provider TEXT NOT NULL DEFAULT 'openai',
            failover_provider TEXT DEFAULT NULL,
            openai_api_key TEXT DEFAULT '',
            anthropic_api_key TEXT DEFAULT '',
            model_navigator TEXT DEFAULT '',
            model_sentinel TEXT DEFAULT '',
            model_herald TEXT DEFAULT '',
            updated_by TEXT,
            updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS users (
            email TEXT PRIMARY KEY,
            name TEXT NOT NULL DEFAULT '',
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            created_at TEXT NOT NULL,
            integrations TEXT DEFAULT '{}'
        );

        CREATE TABLE IF NOT EXISTS login_history (
            id SERIAL PRIMARY KEY,
            email TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            ip TEXT,
            user_agent TEXT,
            success BOOLEAN NOT NULL DEFAULT true,
            reason TEXT DEFAULT ''
        );
        CREATE INDEX IF NOT EXISTS idx_login_history_email ON login_history(email);

        CREATE TABLE IF NOT EXISTS share_tokens (
            token TEXT PRIMARY KEY,
            data TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS agent_runs (
            session_id TEXT PRIMARY KEY,
            status TEXT NOT NULL DEFAULT 'planned',
            current_step TEXT,
            summary TEXT DEFAULT '{}',
            started_at TEXT,
            completed_at TEXT,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS agent_run_steps (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            step_key TEXT NOT NULL,
            name TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            detail TEXT DEFAULT '',
            output_ref TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0,
            started_at TEXT,
            completed_at TEXT,
            updated_at TEXT NOT NULL,
            UNIQUE(session_id, step_key)
        );
        CREATE INDEX IF NOT EXISTS idx_agent_run_steps_session ON agent_run_steps(session_id);

        CREATE TABLE IF NOT EXISTS agent_blockers (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            step_key TEXT,
            blocker_type TEXT NOT NULL,
            title TEXT NOT NULL,
            reason TEXT NOT NULL,
            owner_role TEXT DEFAULT 'Product',
            severity TEXT DEFAULT 'Medium',
            status TEXT NOT NULL DEFAULT 'open',
            source_ref TEXT DEFAULT '{}',
            created_at TEXT NOT NULL,
            resolved_at TEXT,
            updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_agent_blockers_session ON agent_blockers(session_id);

        CREATE TABLE IF NOT EXISTS agent_execution_events (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            step_key TEXT,
            event_type TEXT NOT NULL,
            message TEXT NOT NULL,
            metadata TEXT DEFAULT '{}',
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_agent_execution_events_session ON agent_execution_events(session_id);
        """)
        cur.close()
        conn.commit()
    logger.info("Database initialized")


def get_llm_settings() -> dict:
    """Read LLM settings from DB; returns None if no row exists (use env defaults)."""
    with get_db() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM llm_settings WHERE id = 'global'")
        row = cur.fetchone()
        cur.close()
        if row:
            return dict(row)
    return None


def save_llm_settings(settings: dict, admin_email: str):
    """Upsert LLM settings."""
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO llm_settings (id, default_provider, failover_provider,
                openai_api_key, anthropic_api_key,
                model_navigator, model_sentinel, model_herald,
                updated_by, updated_at)
            VALUES ('global', %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT(id) DO UPDATE SET
                default_provider   = EXCLUDED.default_provider,
                failover_provider  = EXCLUDED.failover_provider,
                openai_api_key     = EXCLUDED.openai_api_key,
                anthropic_api_key  = EXCLUDED.anthropic_api_key,
                model_navigator    = EXCLUDED.model_navigator,
                model_sentinel     = EXCLUDED.model_sentinel,
                model_herald       = EXCLUDED.model_herald,
                updated_by         = EXCLUDED.updated_by,
                updated_at         = EXCLUDED.updated_at
        """, (
            settings.get("default_provider", "openai"),
            settings.get("failover_provider"),
            settings.get("openai_api_key", ""),
            settings.get("anthropic_api_key", ""),
            settings.get("model_navigator", ""),
            settings.get("model_sentinel", ""),
            settings.get("model_herald", ""),
            admin_email,
            datetime.now(timezone.utc).isoformat(),
        ))
        cur.close()


def audit(email: str, action: str, resource_id: str = "", metadata: dict = None, ip: str = ""):
    """Write an audit-log entry."""
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO audit_log (email, action, resource_id, metadata, ip, created_at) VALUES (%s, %s, %s, %s, %s, %s)",
            (email, action, resource_id, json.dumps(metadata or {}), ip, datetime.now(timezone.utc).isoformat()),
        )
        cur.close()
