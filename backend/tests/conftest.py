"""
Test configuration — use a dedicated PostgreSQL test database
so tests never pollute production data.
"""
import os
import shutil
import subprocess
import tempfile

import pytest

# Create a temp directory BEFORE any app code imports
_test_tmpdir = tempfile.mkdtemp(prefix="releaseops_test_")
os.environ["RELEASEOPS_DATA_DIR"] = os.path.join(_test_tmpdir, "data")
os.environ["RELEASEOPS_SESSIONS_DIR"] = os.path.join(_test_tmpdir, "sessions")
os.environ["RELEASEOPS_LOG_DIR"] = os.path.join(_test_tmpdir, "logs")
os.environ["RELEASEOPS_DOWNLOADS_DIR"] = os.path.join(_test_tmpdir, "downloads")
os.environ.setdefault("DEMO_MODE", "true")

# Point to the test PostgreSQL instance (must be running before pytest starts)
_PG_HOST = os.environ.get("TEST_PG_HOST", "localhost")
_PG_PORT = os.environ.get("TEST_PG_PORT", "5433")
_PG_USER = "releaseops"
_PG_PASS = "test_secret"
_PG_DB   = f"releaseops_test_{os.getpid()}"

# Create the test database
_admin_url = f"postgresql://{_PG_USER}:{_PG_PASS}@{_PG_HOST}:{_PG_PORT}/releaseops_test"
os.environ["DATABASE_URL"] = f"postgresql://{_PG_USER}:{_PG_PASS}@{_PG_HOST}:{_PG_PORT}/{_PG_DB}"

import psycopg2

def _create_test_db():
    conn = psycopg2.connect(_admin_url)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(f"DROP DATABASE IF EXISTS {_PG_DB}")
    cur.execute(f"CREATE DATABASE {_PG_DB}")
    cur.close()
    conn.close()

def _drop_test_db():
    try:
        conn = psycopg2.connect(_admin_url)
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute(f"DROP DATABASE IF EXISTS {_PG_DB}")
        cur.close()
        conn.close()
    except Exception:
        pass

_create_test_db()


def pytest_configure(config):
    """Initialise DB tables in the test PostgreSQL database before any test imports."""
    from app.infra.database import init_db
    from app.domain.regulation_engine import init_regulation_db
    from app.deps import bootstrap_admin

    init_db()
    init_regulation_db()
    bootstrap_admin()


def pytest_unconfigure(config):
    """Clean up temp directory and drop test database after test session."""
    shutil.rmtree(_test_tmpdir, ignore_errors=True)
    _drop_test_db()
