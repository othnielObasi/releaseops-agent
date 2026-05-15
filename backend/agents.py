# agents.py

from typing import Dict, Any


def call_navigator_agent(feature_title: str, feature_description: str) -> Dict[str, Any]:
    """
    Stub implementation of the Navigator agent.
    Returns a realistic Release Spec, Risk Register, and Readiness Checklist.
    Replace this later with a real call to your Navigator agent in Complete.dev.
    """

    # RELEASE SPEC
    release_spec = {
        "problem": (
            "Teams can ship AI-powered features quickly, but lack a structured way to "
            "assess whether those features are actually ready for release. This leads "
            "to inconsistent quality, overlooked risks, and reactive firefighting."
        ),
        "target_users": [
            "Product managers",
            "Engineering leads",
            "QA / test engineers",
            "AI / ML engineers"
        ],
        "personas": [
            {
                "name": "Sara",
                "role": "Senior Product Manager",
                "needs": [
                    "A reliable way to decide if a feature can safely launch",
                    "Traceability for decisions when leadership asks 'what changed?'"
                ],
                "pain_points": [
                    "Scrambling across docs, Jira tickets, and Slack to understand readiness",
                    "No consistent standard for AI feature risks or tests"
                ],
            },
            {
                "name": "David",
                "role": "Engineering Lead",
                "needs": [
                    "Clear technical acceptance criteria before shipping",
                    "Alignment between product, QA, and AI safety constraints"
                ],
                "pain_points": [
                    "Undefined scope creep late in the release cycle",
                    "Last-minute escalations around AI behaviour in production"
                ],
            },
        ],
        "core_use_cases": [
            "Run a readiness check on a new AI feature before launch",
            "Generate a structured risk & test plan for a feature proposal",
            "Summarise release status for leadership in a single snapshot",
        ],
        "user_stories": [
            "As a Product Manager, I want to generate a readiness checklist from my feature description so that I can see what's missing before release.",
            "As an Engineering Lead, I want a test plan mapped to concrete risks so that I know we're covering the most severe issues.",
            "As a QA engineer, I want to see risks, tests, and guardrails in one place so that I can prioritise my efforts."
        ],
        "non_functional_requirements": [
            "The readiness pipeline should complete within 15–30 seconds for a typical feature description.",
            "The system should be able to handle multiple concurrent sessions.",
            "Outputs must be deterministic enough to support discussion, but flexible to different feature types.",
        ],
        "success_metrics": [
            "Reduce time spent on manual release coordination by 30–50%.",
            "Increase percentage of AI releases that have explicit test plans and risk registers from <10% to >80%.",
            "Reduce post-release incidents caused by missing checks or undocumented risks."
        ],
    }

    # RISK REGISTER
    risk_register = {
        "risks": [
            {
                "id": "R1",
                "title": "Inadequate coverage of high-severity risks",
                "description": (
                    "Teams may run the assistant, see a nice-looking checklist, but still "
                    "miss critical AI risks such as prompt injection, PII leakage, or biased outputs."
                ),
                "category": "Safety",
                "likelihood": "Medium",
                "impact": "High",
                "severity": "High",
                "mitigation_ideas": [
                    "Include templates for common AI risk patterns in the risk model.",
                    "Highlight untested High severity risks in the snapshot.",
                    "Recommend manual review for any High severity risk without at least one test and one guardrail."
                ],
            },
            {
                "id": "R2",
                "title": "Over-reliance on the tool's output",
                "description": (
                    "Stakeholders may treat LaunchGuard's recommendations as final, without "
                    "applying human judgment, especially under time pressure."
                ),
                "category": "UX/Business",
                "likelihood": "High",
                "impact": "Medium",
                "severity": "High",
                "mitigation_ideas": [
                    "Clearly position LaunchGuard as a copilot, not an approval authority.",
                    "Require human sign-off in the checklist (e.g., Product / Eng / QA review items).",
                    "Include warnings wherever High severity risks are present."
                ],
            },
            {
                "id": "R3",
                "title": "Incomplete context from feature description",
                "description": (
                    "If the initial feature description is too vague, generated risks and "
                    "tests may be misaligned with the actual system."
                ),
                "category": "UX/Business",
                "likelihood": "High",
                "impact": "Medium",
                "severity": "Medium",
                "mitigation_ideas": [
                    "Prompt users for additional context if the description looks too short.",
                    "Encourage attaching relevant files (PRDs, diagrams) in future versions.",
                    "Flag \"low confidence\" scenarios in the snapshot."
                ],
            },
            {
                "id": "R4",
                "title": "Exposure of sensitive implementation details in artefacts",
                "description": (
                    "If connected to source control or tickets in future, the system might "
                    "summarise or expose sensitive internal details in release notes."
                ),
                "category": "Privacy",
                "likelihood": "Low",
                "impact": "High",
                "severity": "Medium",
                "mitigation_ideas": [
                    "Separate internal technical notes from external-facing release notes.",
                    "Add configurable filters for sensitive terms.",
                    "Allow teams to mark certain content as internal only."
                ],
            },
        ]
    }

    # READINESS CHECKLIST
    readiness_checklist = {
        "checklist": [
            {
                "id": "C1",
                "category": "Requirements",
                "item": "Feature problem statement and target users defined and agreed.",
                "owner_role": "Product",
                "priority": "Must",
            },
            {
                "id": "C2",
                "category": "Testing",
                "item": "High-severity risks (severity=High) each have at least one associated test case.",
                "owner_role": "QA",
                "priority": "Must",
            },
            {
                "id": "C3",
                "category": "Risk_Mitigation",
                "item": "Mitigations identified for all High severity risks.",
                "owner_role": "Engineering",
                "priority": "Must",
            },
            {
                "id": "C4",
                "category": "Docs",
                "item": "User-facing release notes drafted and reviewed.",
                "owner_role": "Product",
                "priority": "Should",
            },
            {
                "id": "C5",
                "category": "UX",
                "item": "Edge-case behaviours for AI responses tested on realistic scenarios.",
                "owner_role": "QA",
                "priority": "Should",
            },
        ]
    }

    return {
        "release_spec": release_spec,
        "risk_register": risk_register,
        "readiness_checklist": readiness_checklist,
    }


def call_sentinel_agent(navigator_output: Dict[str, Any]) -> Dict[str, Any]:
    """
    Stub implementation of the Sentinel agent.
    Takes Navigator output and returns a Testing Strategy, Test Cases, and Guardrails.
    """

    risks = navigator_output.get("risk_register", {}).get("risks", [])
    high_risk_ids = [r["id"] for r in risks if r.get("severity") == "High"]

    testing_strategy = {
        "levels": [
            {
                "level": "Unit",
                "description": "Validate core business logic and non-AI components deterministically.",
                "primary_owners": ["Engineering"],
                "notes": ["Focus on inputs/outputs that do not involve LLM responses."],
            },
            {
                "level": "Integration",
                "description": "Ensure the AI assistant integrates correctly with APIs, auth, and logging.",
                "primary_owners": ["Engineering", "QA"],
                "notes": ["Check error handling paths and timeouts."],
            },
            {
                "level": "E2E",
                "description": "Simulate full user flows to validate UX and acceptance criteria.",
                "primary_owners": ["QA"],
                "notes": ["Include flows where the assistant fails gracefully."],
            },
            {
                "level": "AI_Eval",
                "description": "Stress-test risky behaviours, including prompt injection and harmful outputs.",
                "primary_owners": ["QA", "AI/ML"],
                "notes": ["Prioritise High severity risks from the risk register."],
            },
        ]
    }

    test_cases = {
        "test_cases": [
            {
                "id": "T1",
                "name": "High-severity risks have coverage",
                "linked_risks": high_risk_ids,
                "linked_checklist_items": ["C2", "C3"],
                "category": "Safety",
                "abstract_input": "Run a readiness check for a complex AI feature with known risky behaviours.",
                "expected_behavior": (
                    "For each High severity risk, there is at least one associated test case "
                    "and at least one guardrail suggestion."
                ),
                "automation": "Automatable",
            },
            {
                "id": "T2",
                "name": "Over-reliance disclaimer is present",
                "linked_risks": ["R2"],
                "linked_checklist_items": ["C1"],
                "category": "UX",
                "abstract_input": "Generate a readiness snapshot for any feature.",
                "expected_behavior": (
                    "Snapshot clearly positions LaunchGuard as a copilot and calls for human review."
                ),
                "automation": "Hybrid",
            },
            {
                "id": "T3",
                "name": "AI behaviour under ambiguous feature description",
                "linked_risks": ["R3"],
                "linked_checklist_items": ["C5"],
                "category": "Functional",
                "abstract_input": "Provide an extremely short or vague feature description.",
                "expected_behavior": (
                    "System either prompts for more detail or warns that outputs are low confidence."
                ),
                "automation": "Manual",
            },
        ]
    }

    guardrails = {
        "guardrails": [
            {
                "id": "G1",
                "name": "High severity risk highlight",
                "description": "Highlight any High severity risks in the snapshot with a visual badge and warnings.",
                "risk_ids": high_risk_ids,
                "where_applied": "UI",
                "implementation_idea": (
                    "Add a red badge and short warning text wherever High severity risks appear in the readiness board."
                ),
            },
            {
                "id": "G2",
                "name": "Human sign-off required",
                "description": "Require at least one human approver before treating the checklist as 'approved'.",
                "risk_ids": ["R2"],
                "where_applied": "UI",
                "implementation_idea": (
                    "Include explicit checklist items requiring Product, Engineering, and QA review before release."
                ),
            },
            {
                "id": "G3",
                "name": "Ambiguity alert",
                "description": "Warn when the feature description is too short or generic.",
                "risk_ids": ["R3"],
                "where_applied": "PreProcessing",
                "implementation_idea": (
                    "If character count or concept density is below a threshold, ask user for more context."
                ),
            },
        ]
    }

    return {
        "testing_strategy": testing_strategy,
        "test_cases": test_cases,
        "guardrails": guardrails,
    }


def call_herald_agent(
    navigator_output: Dict[str, Any],
    sentinel_output: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Stub implementation of the Herald agent.
    Produces release notes, landing page copy, and a pitch deck outline.
    """

    feature_name = "LaunchGuard – Release Readiness Copilot"

    release_notes = {
        "title": f"Introducing {feature_name}",
        "version": "v0.1.0",
        "summary": (
            f"{feature_name} helps AI product teams turn chaotic release cycles into a "
            "structured readiness workflow by generating specs, risks, tests, and launch communications."
        ),
        "whats_new": [
            "Multi-agent readiness pipeline with Navigator, Sentinel, and Herald.",
            "Automatic generation of risk-aligned test plans and guardrail suggestions.",
            "Single Readiness Snapshot to share with product, engineering, and leadership."
        ],
        "why_it_matters": [
            "AI features can now ship fast without skipping critical governance checks.",
            "Teams gain a repeatable standard for AI release quality.",
        ],
        "known_limitations": [
            "Current version relies entirely on user-provided feature descriptions.",
            "Integration with CI/CD and ticketing tools is part of future roadmap."
        ],
    }

    landing_copy = {
        "hero_title": "Is your AI feature truly ready to ship?",
        "hero_subtitle": "LaunchGuard turns your idea into a structured readiness snapshot – specs, risks, tests, and launch story in one flow.",
        "tagline": "Ship AI features with confidence, not crossed fingers.",
        "key_benefits": [
            "Unify specs, risks, tests, and docs in a single readiness board.",
            "Highlight high-severity risks and the gaps you haven't covered yet.",
            "Give leadership a clear, traceable view of release decisions.",
        ],
        "feature_sections": [
            {
                "title": "Multi-Agent Readiness Pipeline",
                "body": "Navigator, Sentinel, and Herald collaborate to transform your feature description into a release spec, risk register, test plan, and GTM package.",
            },
            {
                "title": "Risk-Aligned Testing",
                "body": "Sentinel links test cases directly to High severity risks so that QA effort follows real risk, not guesswork.",
            },
            {
                "title": "Built for Real AI Teams",
                "body": "Designed for product, engineering, and QA working together under real deadlines – not for toy demos.",
            },
        ],
        "trust_and_safety": {
            "headline": "Built for responsible AI releases",
            "bullets": [
                "Makes AI risks explicit instead of implicit.",
                "Encourages human oversight and sign-off for high-impact decisions.",
                "Creates artefacts you can reuse in audits and incident reviews.",
            ],
        },
        "cta": "Run a readiness check",
    }

    pitch_outline = {
        "slides": [
            {
                "id": 1,
                "title": "Problem – AI is shipping faster than governance",
                "objective": "Show why teams need a structured way to assess release readiness.",
                "key_points": [
                    "AI features can be built in hours using platforms like Complete.dev.",
                    "Specs, risks, tests, and docs live in different tools and people's heads.",
                    "One bad AI release can cause real reputational and regulatory damage."
                ],
                "notes_for_speaker": [
                    "Anchor this in a realistic example: a customer-facing AI assistant gone wrong."
                ],
            },
            {
                "id": 2,
                "title": "Solution – LaunchGuard Release Readiness Copilot",
                "objective": "Introduce LaunchGuard as the central readiness brain.",
                "key_points": [
                    "Multi-agent pipeline converting feature ideas into structured readiness artefacts.",
                    "Single Readiness Snapshot to review before every AI release.",
                ],
                "notes_for_speaker": [
                    "Emphasise that it's opinionated but flexible for different teams."
                ],
            },
            {
                "id": 3,
                "title": "How It Works",
                "objective": "Explain the Navigator → Sentinel → Herald flow.",
                "key_points": [
                    "Navigator: spec, risks, checklist.",
                    "Sentinel: tests and guardrails aligned to risks.",
                    "Herald: release notes, landing copy, pitch outline."
                ],
                "notes_for_speaker": [
                    "Use a simple diagram or arrows here."
                ],
            },
            {
                "id": 4,
                "title": "Demo – From Idea to Readiness Snapshot",
                "objective": "Give a quick, concrete walkthrough.",
                "key_points": [
                    "Paste feature description.",
                    "Generate pipeline outputs.",
                    "Review the snapshot and highlight one High severity risk and its coverage."
                ],
                "notes_for_speaker": [
                    "This is where you show the actual UI recording."
                ],
            },
            {
                "id": 5,
                "title": "Why It Matters",
                "objective": "Tie LaunchGuard to business value.",
                "key_points": [
                    "Fewer last-minute release fire drills.",
                    "More consistent AI quality standards.",
                    "Better evidence for audits and leadership reviews."
                ],
                "notes_for_speaker": [
                    "Relate to governance and responsible AI trends without over-promising."
                ],
            },
            {
                "id": 6,
                "title": "Roadmap & Vision",
                "objective": "Show there is room to grow beyond the hackathon.",
                "key_points": [
                    "CI/CD and ticketing integrations.",
                    "Org-specific policy templates.",
                    "Portfolio-level release risk dashboards."
                ],
                "notes_for_speaker": [
                    "Keep it grounded; this is direction, not vapourware."
                ],
            },
        ]
    }

    return {
        "release_notes": release_notes,
        "landing_copy": landing_copy,
        "pitch_outline": pitch_outline,
    }