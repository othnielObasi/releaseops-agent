# app/domain/diff.py
from __future__ import annotations
from typing import Dict, Any, List, Set, Tuple

def session_diff(prev: dict, curr: dict) -> dict:
    """
    Compute a lightweight diff between two session payloads (final.json shape).
    Returns changes that are meaningful for V2:
    - score change (if present)
    - risks added/removed and severity changes
    - testcases count change
    - guardrails count change
    """
    prev_s = (prev or {}).get("session", {})
    curr_s = (curr or {}).get("session", {})

    prev_nav = (prev or {}).get("navigator", {}) or {}
    curr_nav = (curr or {}).get("navigator", {}) or {}
    prev_sen = (prev or {}).get("sentinel", {}) or {}
    curr_sen = (curr or {}).get("sentinel", {}) or {}

    prev_risks = {r.get("id"): r for r in prev_nav.get("risk_register", {}).get("risks", []) if r.get("id")}
    curr_risks = {r.get("id"): r for r in curr_nav.get("risk_register", {}).get("risks", []) if r.get("id")}

    prev_ids = set(prev_risks.keys())
    curr_ids = set(curr_risks.keys())

    added = sorted(list(curr_ids - prev_ids))
    removed = sorted(list(prev_ids - curr_ids))

    severity_changed = []
    for rid in sorted(list(prev_ids & curr_ids)):
        a = prev_risks[rid].get("severity")
        b = curr_risks[rid].get("severity")
        if a != b:
            severity_changed.append({"risk_id": rid, "from": a, "to": b, "title": curr_risks[rid].get("title")})

    prev_tests = prev_sen.get("test_cases", {}).get("test_cases", [])
    curr_tests = curr_sen.get("test_cases", {}).get("test_cases", [])
    prev_guard = prev_sen.get("guardrails", {}).get("guardrails", [])
    curr_guard = curr_sen.get("guardrails", {}).get("guardrails", [])

    return {
        "previous_session_id": prev_s.get("id"),
        "current_session_id": curr_s.get("id"),
        "score_change": {
            "from": (prev_s.get("readiness_score") or {}).get("score") if isinstance(prev_s.get("readiness_score"), dict) else None,
            "to":   (curr_s.get("readiness_score") or {}).get("score") if isinstance(curr_s.get("readiness_score"), dict) else None,
        },
        "risks": {
            "added": added,
            "removed": removed,
            "severity_changed": severity_changed,
            "counts": {"from": len(prev_ids), "to": len(curr_ids)}
        },
        "tests": {"from": len(prev_tests), "to": len(curr_tests)},
        "guardrails": {"from": len(prev_guard), "to": len(curr_guard)},
    }
