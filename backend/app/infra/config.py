"""
Centralized configuration — all env-var reads in one place.
Import `cfg` from this module instead of reading os.getenv() scattered across files.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# ── Paths (portable — use env vars or sensible defaults) ─────────────────────
BASE_DIR      = Path(os.getenv("RELEASEOPS_BASE_DIR", Path(__file__).resolve().parent.parent.parent))
DATA_DIR      = Path(os.getenv("RELEASEOPS_DATA_DIR", BASE_DIR / "data"))
LOG_DIR       = Path(os.getenv("RELEASEOPS_LOG_DIR", BASE_DIR / "logs"))
SESSIONS_DIR  = Path(os.getenv("RELEASEOPS_SESSIONS_DIR", BASE_DIR / "sessions"))
MOCK_DIR      = Path(os.getenv("RELEASEOPS_MOCK_DIR", BASE_DIR / "mock"))
STATIC_DIR    = Path(os.getenv("RELEASEOPS_STATIC_DIR", BASE_DIR / "static"))
DOWNLOADS_DIR = Path(os.getenv("RELEASEOPS_DOWNLOADS_DIR", BASE_DIR / "downloads"))

for _p in (DATA_DIR, LOG_DIR, SESSIONS_DIR, MOCK_DIR, STATIC_DIR, DOWNLOADS_DIR):
    _p.mkdir(parents=True, exist_ok=True)

USERS_FILE         = DATA_DIR / "users.json"
LOGIN_HISTORY_FILE = DATA_DIR / "login_history.json"

# ── Database ─────────────────────────────────────────────────────────────────
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{DATA_DIR / 'releaseops.db'}"
)

# ── Deploy AI ────────────────────────────────────────────────────────────────
AUTH_URL      = os.getenv("AUTH_URL", "https://api-auth.dev.deploy.ai/oauth2/token")
API_URL       = os.getenv("API_URL", "https://core-api.dev.deploy.ai")
CLIENT_ID     = os.getenv("CLIENT_ID", "")
CLIENT_SECRET = os.getenv("CLIENT_SECRET", "")
ORG_ID        = os.getenv("ORG_ID", "")

# ── Email (SMTP) ─────────────────────────────────────────────────────────────
SMTP_HOST     = os.getenv("SMTP_HOST", "")
SMTP_PORT     = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER     = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
FROM_EMAIL    = os.getenv("FROM_EMAIL", "noreply@releaseops.dev")
PUBLIC_APP_URL = os.getenv("PUBLIC_APP_URL", "").rstrip("/")
CLERK_JWT_ISSUER = os.getenv("CLERK_JWT_ISSUER", "").rstrip("/")
CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY", "")
CLERK_WEBHOOK_SECRET = os.getenv("CLERK_WEBHOOK_SECRET", "")

# ── LLM Provider ─────────────────────────────────────────────────────────────
LLM_PROVIDER    = os.getenv("LLM_PROVIDER", "openai").lower()  # "openai" or "anthropic"
OPENAI_API_KEY  = os.getenv("OPENAI_API_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# ── Model routing ────────────────────────────────────────────────────────────
_DEFAULT_MODELS = {
    "openai":    {"navigator": "gpt-4o-mini",      "sentinel": "gpt-4o",        "herald": "gpt-4o-mini"},
    "anthropic": {"navigator": "claude-haiku-4-5-20250514", "sentinel": "claude-sonnet-4-20250514", "herald": "claude-haiku-4-5-20250514"},
}
_defaults = _DEFAULT_MODELS.get(LLM_PROVIDER, _DEFAULT_MODELS["openai"])
MODEL_NAVIGATOR = os.getenv("MODEL_NAVIGATOR", _defaults["navigator"])
MODEL_SENTINEL  = os.getenv("MODEL_SENTINEL",  _defaults["sentinel"])
MODEL_HERALD    = os.getenv("MODEL_HERALD",    _defaults["herald"])

# ── Demo mode ────────────────────────────────────────────────────────────────
_demo_env = os.getenv("DEMO_MODE", "true").lower() == "true"
_creds_ok = bool(OPENAI_API_KEY) or bool(ANTHROPIC_API_KEY) or bool(CLIENT_ID and CLIENT_SECRET)
DEMO_MODE = _demo_env or not _creds_ok

# ── Auth ─────────────────────────────────────────────────────────────────────
JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable is required")
JWT_ALGORITHM    = "HS256"
JWT_EXPIRE_HOURS = 72
ADMIN_EMAIL      = os.getenv("ADMIN_EMAIL", "admin@releaseops.dev")
ADMIN_PASSWORD   = os.getenv("ADMIN_PASSWORD", "admin123")

# ── Server ───────────────────────────────────────────────────────────────────
PORT      = int(os.getenv("PORT", "3001"))
WORKERS   = int(os.getenv("WORKERS", "2"))
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
LOG_TO_FILE = os.getenv("LOG_TO_FILE", "true").lower() == "true"
