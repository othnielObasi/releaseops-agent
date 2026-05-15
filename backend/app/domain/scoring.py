# app/domain/scoring.py
from __future__ import annotations
from typing import Dict, Any, List, Set

def compute_readiness_score(nav: dict, sen: dict) -> dict:
    """
    Compute a 0-100 readiness score from Navigator + Sentinel outputs.

    Returns:
        {"score": int, "grade": str, "breakdown": {...}, "summary": {...}}
    """
    risks      = nav.get("risk_register", {}).get("risks", []) if isinstance(nav, dict) else []
    checklist  = nav.get("readiness_checklist", {}).get("checklist", []) if isinstance(nav, dict) else []
    test_cases = sen.get("test_cases", {}).get("test_cases", []) if isinstance(sen, dict) else []
    guardrails = sen.get("guardrails", {}).get("guardrails", []) if isinstance(sen, dict) else []
    spec       = nav.get("release_spec", {}) if isinstance(nav, dict) else {}
    all_risk_ids: Set[str] = {r["id"] for r in risks if isinstance(r, dict) and "id" in r}

    high_risks = [r for r in risks if r.get("severity") == "High"]
    med_risks  = [r for r in risks if r.get("severity") == "Medium"]
    must_items = [c for c in checklist if c.get("priority") == "Must"]

    tested_risk_ids: Set[str]  = {rid for tc in test_cases  for rid in tc.get("linked_risks", [])}
    guarded_risk_ids: Set[str] = {rid for g  in guardrails  for rid in g.get("risk_ids", [])}
    high_risk_ids: Set[str]    = {r["id"] for r in high_risks if isinstance(r, dict) and "id" in r}

    covered_highs = high_risk_ids & (tested_risk_ids | guarded_risk_ids)
    risk_cov  = (len(covered_highs) / len(high_risk_ids) * 100) if high_risk_ids else 100

    # Spec completeness
    spec_fields = [
        "problem", "target_users", "personas", "core_use_cases",
        "user_stories", "success_metrics", "non_functional_requirements"
    ]
    spec_filled = sum(1 for f in spec_fields if spec.get(f))
    spec_score  = (spec_filled / len(spec_fields)) * 100

    # Coverage heuristics aligned with actual risk coverage.
    tested_risks = all_risk_ids & tested_risk_ids
    guarded_risks = all_risk_ids & guarded_risk_ids
    test_cov = (len(tested_risks) / len(all_risk_ids) * 100) if all_risk_ids else 100
    test_volume = min(100, (len(test_cases) / max(len(all_risk_ids), 1)) * 100)
    test_score = round(test_cov * 0.7 + test_volume * 0.3)

    expected_layers = {"PreProcessing", "ModelCall", "PostProcessing", "UI", "AccessControl"}
    present_layers = {g.get("where_applied") for g in guardrails if g.get("where_applied")}
    layer_cov = (len(expected_layers & present_layers) / len(expected_layers) * 100) if expected_layers else 100
    guarded_cov = (len(guarded_risks) / len(all_risk_ids) * 100) if all_risk_ids else 100
    guard_score = round(guarded_cov * 0.6 + layer_cov * 0.4)

    total_checklist = len(checklist)
    check_score = 100 if total_checklist == 0 else round(max(0, (1 - (len(must_items) / total_checklist)) * 100))

    unmitigated_penalty = max(0, (len(high_risks) - len(covered_highs)) * 8)

    raw = (
        risk_cov   * 0.30 +
        spec_score * 0.20 +
        test_score * 0.20 +
        guard_score* 0.15 +
        check_score* 0.15
    ) - unmitigated_penalty

    score = max(0, min(100, round(raw)))
    grade = "A" if score >= 85 else "B" if score >= 70 else "C" if score >= 55 else "D" if score >= 40 else "F"

    return {
        "score": score,
        "grade": grade,
        "decision": "GO" if score >= 75 else "GO_WITH_MITIGATIONS" if score >= 60 else "NO_GO",
        "breakdown": {
            "risk_coverage":       round(risk_cov),
            "spec_completeness":   round(spec_score),
            "test_coverage":       round(test_score),
            "guardrail_coverage":  round(guard_score),
            "checklist_readiness": round(check_score),
        },
        "summary": {
            "high_risks":       len(high_risks),
            "med_risks":        len(med_risks),
            "covered_highs":    len(covered_highs),
            "test_cases":       len(test_cases),
            "guardrails":       len(guardrails),
            "must_checklist":   len(must_items),
        }
    }
