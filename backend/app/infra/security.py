"""
Security utilities — prompt injection detection, PII scanning, rate limiting,
input sanitization, and output guard checks.
"""
import re
import time as _time
import logging
from collections import defaultdict

logger = logging.getLogger("launchguard")

# ── Prompt-injection & jailbreak safeguards ──────────────────────────────────
_INJECTION_PATTERNS = [
    r'\bignore\s+(previous|all|above|prior|the\s+above)\s+(instructions?|prompts?|context|rules?)\b',
    r'\bnew\s+task\s*:',
    r'(?<!\w)system\s*:',
    r'\byou\s+are\s+now\b',
    r'\bdisregard\s+(all|previous|prior|the|your)\b',
    r'\bforget\s+(all|previous|prior|your|everything)\b',
    r'\bpretend\s+(you\s+are|to\s+be)\b',
    r'\bact\s+as\s+(a\s+)?(?!user|developer|product)',
    r'\bdan\b',
    r'\bjailbreak\b',
    r'\bdeveloper\s+mode\b',
    r'\bprompt\s+injection\b',
    r'\boverride\s+(the|your|all|previous)\b',
    r'\bbypass\s+(the|your|all|safety|filter|guardrail)\b',
    r'<\s*(?:system|user|assistant|inst)\s*>',
    r'\[\s*(?:SYSTEM|USER|ASSISTANT|INST)\s*\]',
    r'\bdo\s+anything\s+now\b',
    r'\bunrestricted\s+mode\b',
    r'\bno\s+restrictions?\b',
    r'\bwithout\s+(any\s+)?restrictions?\b',
]
_COMPILED_INJECTION = [re.compile(p, re.IGNORECASE) for p in _INJECTION_PATTERNS]

_OUTPUT_GUARD_PATTERNS = [
    re.compile(r'\bignore\s+(previous|all)\s+instructions?\b', re.IGNORECASE),
    re.compile(r'\byou\s+are\s+now\b', re.IGNORECASE),
    re.compile(r'\bjailbreak\b', re.IGNORECASE),
    re.compile(r'\bprompt\s+injection\b', re.IGNORECASE),
    re.compile(r'\boverride\s+(the|your|all|previous)\b', re.IGNORECASE),
]

# ── PII detection patterns ───────────────────────────────────────────────────
PII_PATTERNS = [
    ("email",       re.compile(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z]{2,}')),
    ("ssn",         re.compile(r'\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b')),
    ("phone",       re.compile(r'\+?1?\s?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b')),
    ("credit_card", re.compile(r'\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b')),
    ("passport",    re.compile(r'\b[A-Z]{2}\d{6}[A-Z]?\b')),
    ("id_number",   re.compile(r'\b\d{9}\b')),
]

# Max input length per field
MAX_INPUT_LENGTH = 2000


def sanitize_input(text: str) -> str:
    """Check for prompt-injection patterns; return cleaned text or raise ValueError."""
    if not text:
        return text
    text = text[:MAX_INPUT_LENGTH]
    for pattern in _COMPILED_INJECTION:
        if pattern.search(text):
            logger.warning(f"Injection pattern detected in input")
            raise ValueError("Input contains disallowed patterns")
    return text


def validate_output_safety(text: str) -> bool:
    """Return True if LLM output is safe; False if it contains attack vectors."""
    if not text:
        return True
    for pattern in _OUTPUT_GUARD_PATTERNS:
        if pattern.search(text):
            logger.warning("Output guard triggered — LLM response contains unsafe content")
            return False
    return True


def detect_pii(text: str) -> list[dict]:
    """Scan text for PII patterns; return list of {type, match} dicts."""
    findings = []
    for pii_type, pattern in PII_PATTERNS:
        for match in pattern.finditer(text):
            findings.append({"type": pii_type, "match": match.group()})
    return findings


# ── Rate limiting (sliding window) ───────────────────────────────────────────
class RateLimiter:
    """In-memory sliding-window rate limiter."""

    def __init__(self, max_requests: int, window_seconds: int):
        self._store: dict[str, list[float]] = defaultdict(list)
        self._max = max_requests
        self._window = window_seconds

    def allow(self, key: str) -> bool:
        """Return True if allowed; False if rate limit exceeded."""
        now = _time.time()
        cutoff = now - self._window
        self._store[key] = [t for t in self._store[key] if t > cutoff]
        if len(self._store[key]) >= self._max:
            return False
        self._store[key].append(now)
        return True

    def cleanup(self):
        """Remove stale entries."""
        now = _time.time()
        cutoff = now - self._window
        empty_keys = []
        for key, timestamps in self._store.items():
            self._store[key] = [t for t in timestamps if t > cutoff]
            if not self._store[key]:
                empty_keys.append(key)
        for key in empty_keys:
            del self._store[key]


# Pre-configured limiters
ip_limiter   = RateLimiter(max_requests=10, window_seconds=60)
user_limiter = RateLimiter(max_requests=20, window_seconds=60)

# ── Admin brute-force protection ─────────────────────────────────────────────
_admin_fail_store: dict[str, list[float]] = defaultdict(list)
_ADMIN_MAX_FAILS = 5
_ADMIN_LOCK_SECS = 900  # 15 minutes


def check_admin_brute_force(ip: str) -> bool:
    """Return True if IP is locked out from admin login."""
    now = _time.time()
    cutoff = now - _ADMIN_LOCK_SECS
    _admin_fail_store[ip] = [t for t in _admin_fail_store[ip] if t > cutoff]
    return len(_admin_fail_store[ip]) >= _ADMIN_MAX_FAILS


def record_admin_fail(ip: str):
    _admin_fail_store[ip].append(_time.time())


def clear_admin_fails(ip: str):
    _admin_fail_store[ip] = []
