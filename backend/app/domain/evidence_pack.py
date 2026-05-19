# app/domain/evidence_pack.py
from __future__ import annotations
from typing import Dict, Any
import io, json, csv, zipfile
from datetime import datetime, timezone

from .scoring import compute_readiness_score
from .blockers import derive_blockers
from .regulation_mapping import map_compliance

def build_evidence_pack(session_payload: dict) -> io.BytesIO:
    """
    Build a production-minded evidence pack ZIP (V2).

    Includes:
    - session_summary.json
    - readiness_report.md
    - risk_register.csv
    - test_plan.md
    - guardrails.md
    - gtm_assets.md
    - compliance.json
    - blockers.json
    - final.json (raw)
    """
    s = (session_payload or {}).get("session", {})
    nav = (session_payload or {}).get("navigator", {}) or {}
    sen = (session_payload or {}).get("sentinel", {}) or {}
    her = (session_payload or {}).get("herald", {}) or {}

    score = s.get("readiness_score") if isinstance(s.get("readiness_score"), dict) else compute_readiness_score(nav, sen)
    blockers = derive_blockers(nav, sen)
    compliance = map_compliance(nav, sen)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("session_summary.json", json.dumps({
            "session": s,
            "readiness_score": score,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }, indent=2))

        zf.writestr("final.json", json.dumps(session_payload, indent=2))
        zf.writestr("blockers.json", json.dumps(blockers, indent=2))
        zf.writestr("compliance.json", json.dumps(compliance, indent=2))

        # readiness_report.md
        report = _render_readiness_md(s, score, blockers, compliance)
        zf.writestr("readiness_report.md", report)

        # risk_register.csv
        zf.writestr("risk_register.csv", _render_risk_csv(nav))

        # test_plan.md
        zf.writestr("test_plan.md", _render_tests_md(sen))

        # guardrails.md
        zf.writestr("guardrails.md", _render_guardrails_md(sen))

        # gtm_assets.md
        zf.writestr("gtm_assets.md", _render_gtm_md(her))

    buf.seek(0)
    return buf

def _render_readiness_md(s: dict, score: dict, blockers: dict, compliance: dict) -> str:
    title = s.get("feature_title","")
    sid = s.get("id","")
    decision = score.get("decision","")
    lines = []
    lines.append(f"# ReleaseOps Evidence Pack")
    lines.append("")
    lines.append(f"## Feature")
    lines.append(f"- Title: **{title}**")
    lines.append(f"- Session: `{sid}`")
    lines.append(f"- Decision: **{decision}**")
    lines.append(f"- Score: **{score.get('score')} / 100** (Grade {score.get('grade')})")
    lines.append("")
    lines.append("## Top blockers")
    for b in blockers.get("blockers", [])[:10]:
        lines.append(f"- [{b.get('status','Open')}] {b.get('id')}: {b.get('title')} (Owner: {b.get('owner_role')}) — {b.get('reason')}")
    if not blockers.get("blockers"):
        lines.append("- None detected")
    lines.append("")
    lines.append("## Compliance mapping (heuristic)")
    lines.append("- Applicable frameworks: " + ", ".join(compliance.get("applicable_frameworks", [])) )
    lines.append("- Recommended controls:")
    for c in compliance.get("controls_recommended", [])[:12]:
        lines.append(f"  - {c}")
    lines.append("")
    lines.append("> " + compliance.get("disclaimer",""))
    lines.append("")
    return "\n".join(lines)

def _render_risk_csv(nav: dict) -> str:
    import io
    risks = nav.get("risk_register", {}).get("risks", []) if isinstance(nav, dict) else []
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(["id","title","category","severity","likelihood","impact","description"])
    for r in risks:
        writer.writerow([r.get("id"), r.get("title"), r.get("category"), r.get("severity"), r.get("likelihood"), r.get("impact"), r.get("description")])
    return out.getvalue()

def _render_tests_md(sen: dict) -> str:
    levels = sen.get("testing_strategy", {}).get("levels", []) if isinstance(sen, dict) else []
    cases  = sen.get("test_cases", {}).get("test_cases", []) if isinstance(sen, dict) else []
    lines = ["# Test Plan", ""]
    lines.append("## Strategy")
    for lvl in levels:
        lines.append(f"- **{lvl.get('level')}**: {lvl.get('description')}")
    lines.append("")
    lines.append("## Test cases")
    for tc in cases[:50]:
        lines.append(f"- {tc.get('id')}: {tc.get('name')} (Automation: {tc.get('automation')})")
        if tc.get("linked_risks"):
            lines.append(f"  - Linked risks: {', '.join(tc.get('linked_risks'))}")
        lines.append(f"  - Expected: {tc.get('expected_behavior')}")
    return "\n".join(lines)

def _render_guardrails_md(sen: dict) -> str:
    guards = sen.get("guardrails", {}).get("guardrails", []) if isinstance(sen, dict) else []
    lines = ["# Guardrails", ""]
    for g in guards[:50]:
        lines.append(f"## {g.get('id')}: {g.get('name')}")
        lines.append(g.get("description",""))
        lines.append(f"- Where applied: {g.get('where_applied','')}")
        lines.append(f"- Risks: {', '.join(g.get('risk_ids',[]))}")
        lines.append(f"- Implementation idea: {g.get('implementation_idea','')}")
        lines.append("")
    return "\n".join(lines)

def _render_gtm_md(her: dict) -> str:
    rn = her.get("release_notes", {}) if isinstance(her, dict) else {}
    lc = her.get("landing_copy", {}) if isinstance(her, dict) else {}
    lines = ["# GTM Assets", ""]
    if rn:
        lines.append("## Release Notes")
        lines.append(f"**{rn.get('title','')}** (v{rn.get('version','')})")
        lines.append(rn.get("summary",""))
        for w in rn.get("whats_new", [])[:10]:
            lines.append(f"- {w}")
        lines.append("")
    if lc:
        lines.append("## Landing Copy")
        lines.append(f"# {lc.get('hero_title','')}")
        lines.append(lc.get("hero_subtitle",""))
        lines.append("")
        lines.append("### Key benefits")
        for b in lc.get("key_benefits", [])[:10]:
            lines.append(f"- {b}")
        lines.append("")
        lines.append("CTA: " + lc.get("cta",""))
    return "\n".join(lines)
