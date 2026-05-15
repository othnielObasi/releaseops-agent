# app/domain/regulation_mapping.py
from __future__ import annotations
from typing import Dict, Any, List

FRAMEWORKS = [
    "OWASP LLM Top 10",
    "NIST AI RMF",
    "GDPR",
    "EU AI Act (high-level)",
]

def map_compliance(nav: dict, sen: dict) -> dict:
    """
    Lightweight compliance mapping (V2-in-monolith).

    Heuristics: look at risk categories and keywords to suggest applicable frameworks
    and recommended controls. This is NOT legal advice — it is a governance aid.
    """
    risks = nav.get("risk_register", {}).get("risks", []) if isinstance(nav, dict) else []
    text_blob = _as_text_blob(risks)

    applicable = []
    controls = []

    # OWASP LLM
    if any(k in text_blob for k in ["prompt injection", "jailbreak", "data exfil", "tool misuse", "system prompt"]):
        applicable.append("OWASP LLM Top 10")
        controls += [
            "Input / prompt injection filtering and tool-call allowlists",
            "Output validation (schema + policy checks)",
            "Least-privilege tool permissions",
        ]

    # GDPR / Privacy
    if any(k in text_blob for k in ["pii", "personal data", "gdpr", "privacy", "data retention"]):
        applicable.append("GDPR")
        controls += [
            "PII minimization and redaction",
            "Retention limits + deletion policy",
            "Access controls and audit logs for sensitive data",
        ]

    # NIST AI RMF (general governance)
    applicable.append("NIST AI RMF")
    controls += [
        "Define risk tolerance and acceptance criteria (GO/NO-GO thresholds)",
        "Track tests/guardrails as evidence linked to risks",
        "Human-in-the-loop review for high-severity risks",
    ]

    # EU AI Act (very high-level signal)
    if any(k in text_blob for k in ["biometric", "medical", "credit", "employment", "law enforcement", "critical infrastructure"]):
        applicable.append("EU AI Act (high-level)")
        controls += [
            "Perform risk classification and document intended use",
            "Maintain technical documentation and incident logging",
            "Ensure human oversight and robustness testing",
        ]

    # Deduplicate while preserving order
    applicable = _dedupe_keep_order(applicable)
    controls = _dedupe_keep_order(controls)

    return {
        "applicable_frameworks": applicable,
        "controls_recommended": controls,
        "disclaimer": "This compliance mapping is heuristic and not legal advice. Use it to guide review and documentation."
    }

def _as_text_blob(risks: List[dict]) -> str:
    parts = []
    for r in risks:
        if not isinstance(r, dict):
            continue
        parts.append(str(r.get("title","")))
        parts.append(str(r.get("description","")))
        parts.append(str(r.get("category","")))
    return " ".join(parts).lower()

def _dedupe_keep_order(items: List[str]) -> List[str]:
    seen = set()
    out = []
    for x in items:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out
