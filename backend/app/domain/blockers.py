# app/domain/blockers.py
from __future__ import annotations
from typing import Dict, Any, List, Set

def derive_blockers(nav: dict, sen: dict) -> dict:
    """
    Produce a minimal V2 blockers list from Navigator + Sentinel outputs.

    Blocker rules (V2):
    - Any High risk missing BOTH (test coverage OR guardrail) is a blocker.
    - Any High risk with no mitigation ideas is a blocker.
    - Any Must checklist item is treated as a blocker placeholder (until completion tracking is added).

    Returns:
        {"blockers": [...], "summary": {...}}
    """
    risks      = nav.get("risk_register", {}).get("risks", []) if isinstance(nav, dict) else []
    checklist  = nav.get("readiness_checklist", {}).get("checklist", []) if isinstance(nav, dict) else []
    test_cases = sen.get("test_cases", {}).get("test_cases", []) if isinstance(sen, dict) else []
    guardrails = sen.get("guardrails", {}).get("guardrails", []) if isinstance(sen, dict) else []

    high_risks = [r for r in risks if r.get("severity") == "High"]

    tested_risk_ids: Set[str]  = {rid for tc in test_cases  for rid in tc.get("linked_risks", [])}
    guarded_risk_ids: Set[str] = {rid for g  in guardrails  for rid in g.get("risk_ids", [])}

    blockers: List[Dict[str, Any]] = []

    for r in high_risks:
        rid = r.get("id", "")
        has_test = rid in tested_risk_ids
        has_guard = rid in guarded_risk_ids
        mitigations = r.get("mitigation_ideas") or []

        if (not has_test and not has_guard) or (len(mitigations) == 0):
            blockers.append({
                "id": f"BLK-{rid}" if rid else "BLK-RISK",
                "type": "RISK",
                "risk_id": rid,
                "title": r.get("title", "High risk requires attention"),
                "severity": "High",
                "category": r.get("category", "Unknown"),
                "reason": (
                    "High risk missing test+guardrail coverage"
                    if (not has_test and not has_guard)
                    else "High risk missing mitigation ideas"
                ),
                "owner_role": _default_owner_from_category(r.get("category", "")),
                "status": "Open",
            })

    # Checklist "Must" items are treated as blockers until you add completion tracking.
    for c in checklist:
        if c.get("priority") == "Must":
            blockers.append({
                "id": f"BLK-{c.get('id','CHK')}",
                "type": "CHECKLIST",
                "risk_id": None,
                "title": c.get("item", "Must checklist item"),
                "severity": "Medium",
                "category": c.get("category", "Readiness"),
                "reason": "Must checklist item requires confirmation/closure",
                "owner_role": c.get("owner_role", "Product"),
                "status": "Open",
            })

    return {
        "blockers": blockers,
        "summary": {
            "total": len(blockers),
            "high_risk_blockers": sum(1 for b in blockers if b["type"] == "RISK"),
            "must_checklist_blockers": sum(1 for b in blockers if b["type"] == "CHECKLIST"),
        }
    }

def _default_owner_from_category(category: str) -> str:
    c = (category or "").lower()
    if "security" in c:
        return "Security"
    if "privacy" in c:
        return "Legal/Compliance"
    if "safety" in c:
        return "Engineering"
    return "Product"
