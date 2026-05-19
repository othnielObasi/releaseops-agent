"""
ReleaseOps v3 — Regulation Engine
Structured, queryable database of AI regulatory requirements.
Maps risks to applicable regulatory obligations across 7+ frameworks.
"""
import json, logging
from datetime import datetime, timezone
from typing import Any

from app.deps import get_db
import psycopg2.extras

logger = logging.getLogger("ReleaseOps")

# ═══════════════════════════════════════════════════════════════════════════════
# Schema — regulation tables
# ═══════════════════════════════════════════════════════════════════════════════

def init_regulation_db():
    """Create regulation engine tables and seed baseline data."""
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("""
        CREATE TABLE IF NOT EXISTS frameworks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        version TEXT NOT NULL,
        jurisdiction TEXT NOT NULL,
        effective_date TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        source_url TEXT,
        last_reviewed TEXT,
        created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS requirements (
        id TEXT PRIMARY KEY,
        framework_id TEXT NOT NULL,
        article_ref TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        risk_level TEXT,
        obligation_type TEXT NOT NULL,
        applies_to TEXT NOT NULL DEFAULT 'provider',
        FOREIGN KEY (framework_id) REFERENCES frameworks(id)
        );
        CREATE INDEX IF NOT EXISTS idx_req_framework ON requirements(framework_id);
        CREATE INDEX IF NOT EXISTS idx_req_risk_level ON requirements(risk_level);

        CREATE TABLE IF NOT EXISTS requirement_controls (
        id TEXT PRIMARY KEY,
        requirement_id TEXT NOT NULL,
        control_description TEXT NOT NULL,
        risk_categories TEXT NOT NULL,
        verification_method TEXT NOT NULL DEFAULT 'review',
        implementation_guidance TEXT,
        FOREIGN KEY (requirement_id) REFERENCES requirements(id)
        );
        CREATE INDEX IF NOT EXISTS idx_ctrl_req ON requirement_controls(requirement_id);

        CREATE TABLE IF NOT EXISTS risk_regulation_mappings (
        id SERIAL PRIMARY KEY,
        session_id TEXT NOT NULL,
        risk_id TEXT NOT NULL,
        requirement_id TEXT NOT NULL,
        gap_status TEXT NOT NULL DEFAULT 'unmet',
        evidence TEXT,
        notes TEXT,
        created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_rrm_session ON risk_regulation_mappings(session_id);

        CREATE TABLE IF NOT EXISTS regulation_updates (
        id SERIAL PRIMARY KEY,
        framework_id TEXT NOT NULL,
        change_type TEXT NOT NULL,
        summary TEXT NOT NULL,
        source_url TEXT,
        detected_at TEXT NOT NULL,
        reviewed_by TEXT,
        applied_at TEXT,
        status TEXT NOT NULL DEFAULT 'pending'
        );
        """)
        # Seed if empty
        cur.execute("SELECT COUNT(*) FROM frameworks")
        count = cur.fetchone()[0]
        if count == 0:
            _seed_frameworks(conn)
            _seed_requirements(conn)
            logger.info(json.dumps({"event": "regulation_db_seeded"}))
        cur.close()


# ═══════════════════════════════════════════════════════════════════════════════
# Seed data — 7 active frameworks with real regulatory requirements
# ═══════════════════════════════════════════════════════════════════════════════

def _seed_frameworks(conn):
    frameworks = [
        ("eu_ai_act", "EU AI Act", "2024/1689", "European Union", "2025-08-02",
         "active", "https://eur-lex.europa.eu/eli/reg/2024/1689"),
        ("owasp_llm", "OWASP Top 10 for LLM Applications", "2025 v2.0", "Global", "2025-01-01",
         "active", "https://owasp.org/www-project-top-10-for-large-language-model-applications/"),
        ("nist_ai_rmf", "NIST AI Risk Management Framework", "v1.0", "United States", "2023-01-26",
         "active", "https://www.nist.gov/artificial-intelligence/ai-risk-management-framework"),
        ("iso_42001", "ISO/IEC 42001:2023", "2023", "International", "2023-12-18",
         "active", "https://www.iso.org/standard/81230.html"),
        ("gdpr", "GDPR (AI-relevant articles)", "2016/679", "European Union", "2018-05-25",
         "active", "https://eur-lex.europa.eu/eli/reg/2016/679"),
        ("soc2", "SOC 2 Type II (AI Controls)", "2022 Trust Criteria", "United States", "2022-01-01",
         "active", "https://www.aicpa.org/soc2"),
        ("hipaa", "HIPAA (AI Addendum)", "2013 Omnibus + AI", "United States", "2013-03-26",
         "active", "https://www.hhs.gov/hipaa"),
    ]
    now = datetime.now(timezone.utc).isoformat()
    cur = conn.cursor()
    for fw in frameworks:
        cur.execute(
            """INSERT INTO frameworks (id, name, version, jurisdiction, effective_date, status, source_url, created_at)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s)""",
            (*fw, now)
        )
    cur.close()


def _seed_requirements(conn):
    """Seed actual regulatory requirements from the v3 Architecture spec."""
    reqs = _get_all_requirements()
    cur = conn.cursor()
    for r in reqs:
        cur.execute(
            """INSERT INTO requirements (id, framework_id, article_ref, title, description, risk_level, obligation_type, applies_to)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s)""",
            (r["id"], r["framework_id"], r["article_ref"], r["title"],
             r["description"], r.get("risk_level"), r["obligation_type"], r.get("applies_to", "provider"))
        )
    controls = _get_all_controls()
    for c in controls:
        cur.execute(
            """INSERT INTO requirement_controls (id, requirement_id, control_description, risk_categories, verification_method, implementation_guidance)
               VALUES (%s,%s,%s,%s,%s,%s)""",
            (c["id"], c["requirement_id"], c["control_description"],
             json.dumps(c["risk_categories"]), c["verification_method"], c.get("implementation_guidance"))
        )
    cur.close()


def _get_all_requirements():
    return [
        # ── EU AI Act ─────────────────────────────────────────────────────────
        {"id": "eu_art5", "framework_id": "eu_ai_act", "article_ref": "Art. 5",
         "title": "Prohibited AI practices",
         "description": "AI systems that deploy subliminal, manipulative, or deceptive techniques, exploit vulnerabilities, social scoring, or real-time remote biometric identification are prohibited.",
         "risk_level": "unacceptable", "obligation_type": "prohibition", "applies_to": "all"},
        {"id": "eu_art6", "framework_id": "eu_ai_act", "article_ref": "Art. 6",
         "title": "Classification rules for high-risk AI",
         "description": "Rules for classifying AI systems as high-risk based on intended purpose and Annex III categories.",
         "risk_level": "high", "obligation_type": "mandatory", "applies_to": "provider"},
        {"id": "eu_art9", "framework_id": "eu_ai_act", "article_ref": "Art. 9",
         "title": "Risk management system",
         "description": "High-risk AI providers must establish, implement, document and maintain a risk management system throughout the AI system lifecycle.",
         "risk_level": "high", "obligation_type": "mandatory", "applies_to": "provider"},
        {"id": "eu_art10", "framework_id": "eu_ai_act", "article_ref": "Art. 10",
         "title": "Data and data governance",
         "description": "Training, validation and testing data sets shall be subject to appropriate data governance and management practices concerning data collection, relevance, representativeness, and bias examination.",
         "risk_level": "high", "obligation_type": "mandatory", "applies_to": "provider"},
        {"id": "eu_art11", "framework_id": "eu_ai_act", "article_ref": "Art. 11",
         "title": "Technical documentation",
         "description": "High-risk AI systems shall be accompanied by technical documentation drawn up before placing on the market or putting into service.",
         "risk_level": "high", "obligation_type": "documentation", "applies_to": "provider"},
        {"id": "eu_art13", "framework_id": "eu_ai_act", "article_ref": "Art. 13",
         "title": "Transparency and provision of information to deployers",
         "description": "High-risk AI systems shall be designed to ensure their operation is sufficiently transparent to enable deployers to interpret outputs.",
         "risk_level": "high", "obligation_type": "transparency", "applies_to": "provider"},
        {"id": "eu_art14", "framework_id": "eu_ai_act", "article_ref": "Art. 14",
         "title": "Human oversight",
         "description": "High-risk AI systems shall be designed to allow effective human oversight during use.",
         "risk_level": "high", "obligation_type": "mandatory", "applies_to": "provider+deployer"},
        {"id": "eu_art15", "framework_id": "eu_ai_act", "article_ref": "Art. 15",
         "title": "Accuracy, robustness and cybersecurity",
         "description": "High-risk AI systems shall be designed to achieve appropriate levels of accuracy, robustness and cybersecurity.",
         "risk_level": "high", "obligation_type": "mandatory", "applies_to": "provider"},
        {"id": "eu_art26", "framework_id": "eu_ai_act", "article_ref": "Art. 26",
         "title": "Obligations of deployers",
         "description": "Deployers shall use high-risk AI in accordance with instructions, implement human oversight measures, monitor operation, and inform providers of serious incidents.",
         "risk_level": "high", "obligation_type": "mandatory", "applies_to": "deployer"},
        {"id": "eu_art50", "framework_id": "eu_ai_act", "article_ref": "Art. 50",
         "title": "Transparency for certain AI systems",
         "description": "Providers of AI systems intended to interact with natural persons shall ensure the system is designed to inform persons they are interacting with AI.",
         "risk_level": "limited", "obligation_type": "transparency", "applies_to": "provider+deployer"},

        # ── OWASP Top 10 for LLM ─────────────────────────────────────────────
        {"id": "owasp_llm01", "framework_id": "owasp_llm", "article_ref": "LLM01",
         "title": "Prompt Injection",
         "description": "Crafted inputs manipulate LLMs, leading to unauthorized access, data breaches, or compromised decision-making.",
         "obligation_type": "mandatory", "applies_to": "provider"},
        {"id": "owasp_llm02", "framework_id": "owasp_llm", "article_ref": "LLM02",
         "title": "Insecure Output Handling",
         "description": "Insufficient validation of LLM outputs can lead to XSS, CSRF, SSRF, privilege escalation, or remote code execution.",
         "obligation_type": "mandatory", "applies_to": "provider"},
        {"id": "owasp_llm03", "framework_id": "owasp_llm", "article_ref": "LLM03",
         "title": "Training Data Poisoning",
         "description": "Manipulation of training data introduces vulnerabilities, biases, or backdoors that compromise model security and output.",
         "obligation_type": "mandatory", "applies_to": "provider"},
        {"id": "owasp_llm04", "framework_id": "owasp_llm", "article_ref": "LLM04",
         "title": "Model Denial of Service",
         "description": "Attackers cause resource-heavy operations on LLMs leading to service degradation or high costs.",
         "obligation_type": "mandatory", "applies_to": "provider"},
        {"id": "owasp_llm05", "framework_id": "owasp_llm", "article_ref": "LLM05",
         "title": "Supply Chain Vulnerabilities",
         "description": "LLM supply chains can be compromised via vulnerable pre-trained models, poisoned data, or insecure plugins.",
         "obligation_type": "mandatory", "applies_to": "provider"},
        {"id": "owasp_llm06", "framework_id": "owasp_llm", "article_ref": "LLM06",
         "title": "Sensitive Information Disclosure",
         "description": "LLMs may inadvertently reveal confidential data in responses, leading to privacy violations and security breaches.",
         "obligation_type": "mandatory", "applies_to": "provider"},
        {"id": "owasp_llm07", "framework_id": "owasp_llm", "article_ref": "LLM07",
         "title": "Insecure Plugin Design",
         "description": "LLM plugins with insufficient access controls or input validation can enable malicious requests and data exfiltration.",
         "obligation_type": "mandatory", "applies_to": "provider"},
        {"id": "owasp_llm08", "framework_id": "owasp_llm", "article_ref": "LLM08",
         "title": "Excessive Agency",
         "description": "Granting LLMs unchecked autonomy to take actions can lead to unintended consequences with reliability and trust.",
         "obligation_type": "mandatory", "applies_to": "provider"},
        {"id": "owasp_llm09", "framework_id": "owasp_llm", "article_ref": "LLM09",
         "title": "Overreliance",
         "description": "Without adequate oversight, users may place undue confidence in LLM outputs, leading to misinformation or security vulnerabilities.",
         "obligation_type": "mandatory", "applies_to": "provider+deployer"},
        {"id": "owasp_llm10", "framework_id": "owasp_llm", "article_ref": "LLM10",
         "title": "Model Theft",
         "description": "Unauthorized access to proprietary LLMs risks intellectual property theft, competitive advantage, and access to sensitive data.",
         "obligation_type": "mandatory", "applies_to": "provider"},

        # ── NIST AI RMF ──────────────────────────────────────────────────────
        {"id": "nist_gv1", "framework_id": "nist_ai_rmf", "article_ref": "GV-1",
         "title": "Policies", "description": "Policies, processes, procedures, and practices across the organization related to AI risk are in place.",
         "obligation_type": "mandatory", "applies_to": "provider"},
        {"id": "nist_gv2", "framework_id": "nist_ai_rmf", "article_ref": "GV-2",
         "title": "Accountability", "description": "Accountability structures are in place for AI system decisions and outcomes.",
         "obligation_type": "mandatory", "applies_to": "provider"},
        {"id": "nist_gv3", "framework_id": "nist_ai_rmf", "article_ref": "GV-3",
         "title": "Workforce", "description": "Workforce diversity, equity, inclusion, and accessibility processes are prioritized in AI lifecycle.",
         "obligation_type": "mandatory", "applies_to": "provider"},
        {"id": "nist_mp1", "framework_id": "nist_ai_rmf", "article_ref": "MAP-1",
         "title": "Context and stakeholders", "description": "Context is established and understood, including intended deployment setting and stakeholders.",
         "obligation_type": "mandatory", "applies_to": "provider"},
        {"id": "nist_mp2", "framework_id": "nist_ai_rmf", "article_ref": "MAP-2",
         "title": "Categorize AI system", "description": "Categorization of the AI system is performed with societal and individual impacts assessed.",
         "obligation_type": "mandatory", "applies_to": "provider"},
        {"id": "nist_ms1", "framework_id": "nist_ai_rmf", "article_ref": "MS-1",
         "title": "Risk identification", "description": "AI risks and benefits are identified and tracked over time.",
         "obligation_type": "mandatory", "applies_to": "provider"},
        {"id": "nist_ms2", "framework_id": "nist_ai_rmf", "article_ref": "MS-2",
         "title": "Risk assessment", "description": "AI risks are assessed qualitatively and/or quantitatively and compared to organizational risk tolerance.",
         "obligation_type": "mandatory", "applies_to": "provider"},
        {"id": "nist_mg1", "framework_id": "nist_ai_rmf", "article_ref": "MG-1",
         "title": "Risk prioritization", "description": "AI risks are prioritized and responses selected based on anticipated impact.",
         "obligation_type": "mandatory", "applies_to": "provider"},
        {"id": "nist_mg2", "framework_id": "nist_ai_rmf", "article_ref": "MG-2",
         "title": "Risk treatment", "description": "Strategies to mitigate AI risks are planned, prepared, and implemented.",
         "obligation_type": "mandatory", "applies_to": "provider"},
        {"id": "nist_mg3", "framework_id": "nist_ai_rmf", "article_ref": "MG-3",
         "title": "Risk monitoring", "description": "Responses to identified and measured AI risks are monitored for effectiveness.",
         "obligation_type": "mandatory", "applies_to": "provider"},

        # ── ISO/IEC 42001 ────────────────────────────────────────────────────
        {"id": "iso_a6_1", "framework_id": "iso_42001", "article_ref": "A.6.1",
         "title": "AI Risk Assessment", "description": "The organization shall define and apply an AI risk assessment process.",
         "obligation_type": "mandatory", "applies_to": "provider"},
        {"id": "iso_a6_2", "framework_id": "iso_42001", "article_ref": "A.6.2",
         "title": "AI Risk Treatment", "description": "The organization shall define and apply an AI risk treatment process.",
         "obligation_type": "mandatory", "applies_to": "provider"},
        {"id": "iso_a8_2", "framework_id": "iso_42001", "article_ref": "A.8.2",
         "title": "AI System Lifecycle", "description": "The organization shall manage AI systems throughout their lifecycle including design, development, deployment, operation and retirement.",
         "obligation_type": "mandatory", "applies_to": "provider"},
        {"id": "iso_a8_5", "framework_id": "iso_42001", "article_ref": "A.8.5",
         "title": "Data for AI Systems", "description": "Data used for AI systems shall be managed to ensure quality, relevance, and governance.",
         "obligation_type": "mandatory", "applies_to": "provider"},
        {"id": "iso_a9_3", "framework_id": "iso_42001", "article_ref": "A.9.3",
         "title": "Performance Evaluation", "description": "The organization shall monitor, measure, analyse and evaluate AI system performance.",
         "obligation_type": "mandatory", "applies_to": "provider"},

        # ── GDPR (AI-relevant) ───────────────────────────────────────────────
        {"id": "gdpr_art5", "framework_id": "gdpr", "article_ref": "Art. 5(1)",
         "title": "Principles of processing",
         "description": "Personal data shall be processed lawfully, fairly and transparently; collected for specified legitimate purposes; adequate, relevant and limited to what is necessary.",
         "obligation_type": "mandatory", "applies_to": "provider+deployer"},
        {"id": "gdpr_art13", "framework_id": "gdpr", "article_ref": "Art. 13/14",
         "title": "Information to data subjects",
         "description": "Data controllers must provide information about the existence of automated decision-making, meaningful info about logic involved.",
         "obligation_type": "transparency", "applies_to": "provider+deployer"},
        {"id": "gdpr_art22", "framework_id": "gdpr", "article_ref": "Art. 22",
         "title": "Automated individual decision-making",
         "description": "Data subjects have the right not to be subject to decisions based solely on automated processing which significantly affect them.",
         "obligation_type": "mandatory", "applies_to": "provider+deployer"},
        {"id": "gdpr_art25", "framework_id": "gdpr", "article_ref": "Art. 25",
         "title": "Data protection by design and default",
         "description": "Data controllers shall implement appropriate technical and organizational measures to ensure only personal data necessary for each purpose is processed.",
         "obligation_type": "mandatory", "applies_to": "provider"},
        {"id": "gdpr_art35", "framework_id": "gdpr", "article_ref": "Art. 35",
         "title": "Data protection impact assessment",
         "description": "Where processing is likely to result in a high risk to the rights and freedoms of natural persons, the controller shall carry out a DPIA.",
         "obligation_type": "mandatory", "applies_to": "provider+deployer"},

        # ── SOC 2 Type II (AI Controls) ──────────────────────────────────────
        {"id": "soc2_cc6_1", "framework_id": "soc2", "article_ref": "CC6.1",
         "title": "Logical Access Controls",
         "description": "Logical access controls for AI model endpoints, APIs, and administrative interfaces.",
         "obligation_type": "mandatory", "applies_to": "provider"},
        {"id": "soc2_cc7_2", "framework_id": "soc2", "article_ref": "CC7.2",
         "title": "Change Management",
         "description": "AI system change management, version control, and model update procedures.",
         "obligation_type": "mandatory", "applies_to": "provider"},
        {"id": "soc2_cc8_1", "framework_id": "soc2", "article_ref": "CC8.1",
         "title": "Output Accuracy Monitoring",
         "description": "AI output accuracy monitoring and alerting procedures to ensure processing integrity.",
         "obligation_type": "mandatory", "applies_to": "provider"},
        {"id": "soc2_pi1_1", "framework_id": "soc2", "article_ref": "PI1.1",
         "title": "Processing Integrity",
         "description": "AI processing integrity through input validation and output verification procedures.",
         "obligation_type": "mandatory", "applies_to": "provider"},
        {"id": "soc2_a1_2", "framework_id": "soc2", "article_ref": "A1.2",
         "title": "Availability SLA",
         "description": "AI system availability SLA and failover procedures.",
         "obligation_type": "mandatory", "applies_to": "provider"},
        {"id": "soc2_c1_1", "framework_id": "soc2", "article_ref": "C1.1",
         "title": "Data Confidentiality",
         "description": "AI data confidentiality through encryption at rest and in transit.",
         "obligation_type": "mandatory", "applies_to": "provider"},

        # ── HIPAA (AI Addendum) ──────────────────────────────────────────────
        {"id": "hipaa_312a", "framework_id": "hipaa", "article_ref": "164.312(a)",
         "title": "Access Control",
         "description": "Role-based access control to PHI used by AI systems; unique user identification.",
         "obligation_type": "mandatory", "applies_to": "provider"},
        {"id": "hipaa_312c", "framework_id": "hipaa", "article_ref": "164.312(c)",
         "title": "Integrity",
         "description": "AI cannot modify PHI without audit trail; integrity controls for AI-processed health data.",
         "obligation_type": "mandatory", "applies_to": "provider"},
        {"id": "hipaa_312e", "framework_id": "hipaa", "article_ref": "164.312(e)",
         "title": "Transmission Security",
         "description": "Encrypted PHI in AI API calls; TLS required for all AI data transmission.",
         "obligation_type": "mandatory", "applies_to": "provider"},
        {"id": "hipaa_308a1", "framework_id": "hipaa", "article_ref": "164.308(a)(1)",
         "title": "Risk Analysis",
         "description": "AI-specific risk assessment for PHI handling; periodic risk analysis updates.",
         "obligation_type": "mandatory", "applies_to": "provider"},
        {"id": "hipaa_502b", "framework_id": "hipaa", "article_ref": "164.502(b)",
         "title": "Minimum Necessary",
         "description": "AI accesses only required PHI fields; minimum necessary standard applied to AI data access.",
         "obligation_type": "mandatory", "applies_to": "provider"},
        {"id": "hipaa_530j", "framework_id": "hipaa", "article_ref": "164.530(j)",
         "title": "Documentation Retention",
         "description": "6-year retention of AI processing records involving PHI.",
         "obligation_type": "documentation", "applies_to": "provider"},
    ]


def _get_all_controls():
    return [
        # EU AI Act controls
        {"id": "ctrl_eu_art5_1", "requirement_id": "eu_art5", "control_description": "Auto-detect prohibited practice patterns (social scoring, real-time biometric, manipulation of vulnerable groups, predictive policing). Hard block and flag for legal review.",
         "risk_categories": ["safety", "privacy"], "verification_method": "audit"},
        {"id": "ctrl_eu_art9_1", "requirement_id": "eu_art9", "control_description": "Document risk management system via readiness score, risk register, and checklist.",
         "risk_categories": ["safety", "security", "privacy", "ux_business"], "verification_method": "documentation"},
        {"id": "ctrl_eu_art10_1", "requirement_id": "eu_art10", "control_description": "Privacy risk checks, data provenance documentation, PII detection in inputs.",
         "risk_categories": ["privacy"], "verification_method": "review"},
        {"id": "ctrl_eu_art11_1", "requirement_id": "eu_art11", "control_description": "Navigator output constitutes structured technical documentation.",
         "risk_categories": ["safety", "security", "privacy", "ux_business"], "verification_method": "documentation"},
        {"id": "ctrl_eu_art13_1", "requirement_id": "eu_art13", "control_description": "Herald generates transparency disclosures in launch copy.",
         "risk_categories": ["ux_business"], "verification_method": "review"},
        {"id": "ctrl_eu_art14_1", "requirement_id": "eu_art14", "control_description": "Human-in-the-loop guardrail required for high-risk features.",
         "risk_categories": ["safety"], "verification_method": "test"},
        {"id": "ctrl_eu_art15_1", "requirement_id": "eu_art15", "control_description": "Sentinel test suite covers accuracy and adversarial robustness.",
         "risk_categories": ["security", "safety"], "verification_method": "test"},
        {"id": "ctrl_eu_art50_1", "requirement_id": "eu_art50", "control_description": "Auto-inject disclosure requirements for AI chatbots and synthetic content.",
         "risk_categories": ["ux_business"], "verification_method": "review"},
        # OWASP controls
        {"id": "ctrl_owasp_01", "requirement_id": "owasp_llm01", "control_description": "PreProcessing input validation guardrail required. Test case auto-generated with adversarial prompt examples.",
         "risk_categories": ["security"], "verification_method": "test",
         "implementation_guidance": "Implement input sanitization in PreProcessing guardrail layer."},
        {"id": "ctrl_owasp_02", "requirement_id": "owasp_llm02", "control_description": "PostProcessing output sanitisation guardrail. Test for HTML/script injection in outputs.",
         "risk_categories": ["security"], "verification_method": "test"},
        {"id": "ctrl_owasp_03", "requirement_id": "owasp_llm03", "control_description": "Risk register flags if custom fine-tuning. Checklist: data provenance documentation.",
         "risk_categories": ["security", "safety"], "verification_method": "documentation"},
        {"id": "ctrl_owasp_04", "requirement_id": "owasp_llm04", "control_description": "AccessControl layer: rate limiting, token budget, timeout guardrails.",
         "risk_categories": ["security"], "verification_method": "test"},
        {"id": "ctrl_owasp_05", "requirement_id": "owasp_llm05", "control_description": "Checklist: dependency audit, model provenance, third-party API review.",
         "risk_categories": ["security"], "verification_method": "documentation"},
        {"id": "ctrl_owasp_06", "requirement_id": "owasp_llm06", "control_description": "PreProcessing PII detection. PostProcessing PII scrubbing. Test with PII-laden inputs.",
         "risk_categories": ["privacy", "security"], "verification_method": "test"},
        {"id": "ctrl_owasp_07", "requirement_id": "owasp_llm07", "control_description": "If feature uses tools/APIs: access control review, input validation per tool.",
         "risk_categories": ["security"], "verification_method": "review"},
        {"id": "ctrl_owasp_08", "requirement_id": "owasp_llm08", "control_description": "Human-in-the-loop guardrail required for action-taking features. UI confirmation step.",
         "risk_categories": ["safety"], "verification_method": "test"},
        {"id": "ctrl_owasp_09", "requirement_id": "owasp_llm09", "control_description": "UI disclaimer guardrail. User guide checklist item. Herald includes limitations in launch copy.",
         "risk_categories": ["ux_business"], "verification_method": "review"},
        {"id": "ctrl_owasp_10", "requirement_id": "owasp_llm10", "control_description": "AccessControl: API key rotation, model endpoint protection, rate limiting.",
         "risk_categories": ["security"], "verification_method": "audit"},
        # NIST controls
        {"id": "ctrl_nist_gv1", "requirement_id": "nist_gv1", "control_description": "Workspaces with team policies and governance configuration.",
         "risk_categories": ["safety", "security", "privacy", "ux_business"], "verification_method": "documentation"},
        {"id": "ctrl_nist_gv2", "requirement_id": "nist_gv2", "control_description": "Role-based sign-offs with immutable audit trail.",
         "risk_categories": ["safety", "security", "privacy", "ux_business"], "verification_method": "audit"},
        {"id": "ctrl_nist_ms1", "requirement_id": "nist_ms1", "control_description": "Risk register with severity scoring and trend tracking.",
         "risk_categories": ["safety", "security", "privacy", "ux_business"], "verification_method": "review"},
        {"id": "ctrl_nist_ms2", "requirement_id": "nist_ms2", "control_description": "Readiness score with weighted dimension assessment.",
         "risk_categories": ["safety", "security", "privacy", "ux_business"], "verification_method": "review"},
        {"id": "ctrl_nist_mg1", "requirement_id": "nist_mg1", "control_description": "Checklist with Must/Should/NiceToHave prioritization.",
         "risk_categories": ["safety", "security", "privacy", "ux_business"], "verification_method": "review"},
        {"id": "ctrl_nist_mg2", "requirement_id": "nist_mg2", "control_description": "Guardrails across 5 layers (Pre, Model, Post, UI, Access).",
         "risk_categories": ["safety", "security"], "verification_method": "test"},
        {"id": "ctrl_nist_mg3", "requirement_id": "nist_mg3", "control_description": "Drift monitoring and scheduled re-analysis.",
         "risk_categories": ["safety", "security", "privacy", "ux_business"], "verification_method": "audit"},
        # GDPR controls
        {"id": "ctrl_gdpr_art5", "requirement_id": "gdpr_art5", "control_description": "Document legal basis for AI data processing. Purpose limitation checklist item.",
         "risk_categories": ["privacy"], "verification_method": "documentation"},
        {"id": "ctrl_gdpr_art22", "requirement_id": "gdpr_art22", "control_description": "Human review mechanism for significant automated decisions.",
         "risk_categories": ["privacy", "safety"], "verification_method": "test"},
        {"id": "ctrl_gdpr_art25", "requirement_id": "gdpr_art25", "control_description": "PII minimisation in model inputs. Data protection by design checklist.",
         "risk_categories": ["privacy"], "verification_method": "review"},
        {"id": "ctrl_gdpr_art35", "requirement_id": "gdpr_art35", "control_description": "DPIA completed and documented for high-risk AI processing.",
         "risk_categories": ["privacy"], "verification_method": "documentation"},
        # SOC 2 controls
        {"id": "ctrl_soc2_cc6", "requirement_id": "soc2_cc6_1", "control_description": "Logical access controls for AI model endpoints via API keys and RBAC.",
         "risk_categories": ["security"], "verification_method": "audit"},
        {"id": "ctrl_soc2_cc7", "requirement_id": "soc2_cc7_2", "control_description": "AI system version control via session versioning and immutable snapshots.",
         "risk_categories": ["security"], "verification_method": "audit"},
        {"id": "ctrl_soc2_cc8", "requirement_id": "soc2_cc8_1", "control_description": "Output accuracy monitoring via readiness scores and drift detection.",
         "risk_categories": ["security", "ux_business"], "verification_method": "audit"},
        # HIPAA controls
        {"id": "ctrl_hipaa_312a", "requirement_id": "hipaa_312a", "control_description": "RBAC for PHI access in AI systems. Unique user identification via JWT.",
         "risk_categories": ["privacy", "security"], "verification_method": "audit"},
        {"id": "ctrl_hipaa_312e", "requirement_id": "hipaa_312e", "control_description": "TLS encryption for all AI API calls involving PHI.",
         "risk_categories": ["security", "privacy"], "verification_method": "test"},
    ]


# ═══════════════════════════════════════════════════════════════════════════════
# Risk-to-Regulation Mapping Engine
# ═══════════════════════════════════════════════════════════════════════════════

# Category mapping from Navigator risk categories to control risk_categories
_CATEGORY_MAP = {
    "Safety":      "safety",
    "Security":    "security",
    "Privacy":     "privacy",
    "UX/Business": "ux_business",
    "Other":       "ux_business",
}

# Keywords that trigger specific framework attention
_FRAMEWORK_KEYWORDS = {
    "eu_ai_act": ["biometric", "social scoring", "manipulation", "critical infrastructure",
                  "education", "employment", "credit", "law enforcement", "migration", "justice",
                  "eu", "european", "gdpr"],
    "owasp_llm": ["prompt injection", "injection", "output handling", "training data",
                  "denial of service", "supply chain", "sensitive information", "plugin",
                  "agency", "overreliance", "model theft", "llm", "language model"],
    "nist_ai_rmf": [],  # Always applicable
    "hipaa": ["health", "medical", "patient", "phi", "hipaa", "healthcare", "clinical"],
    "gdpr": ["personal data", "privacy", "pii", "consent", "data subject", "gdpr",
             "automated decision"],
    "soc2": ["access control", "change management", "availability", "processing integrity",
             "confidentiality"],
}


def map_risks_to_regulations(session_id: str, risks: list, session_text: str = "") -> dict:
    """Map identified risks to applicable regulatory requirements.
    Returns a structured compliance assessment."""
    with get_db() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        # Clear previous mappings for this session
        cur.execute("DELETE FROM risk_regulation_mappings WHERE session_id=%s", (session_id,))

        # Determine applicable frameworks based on risk content
        applicable_fw = _detect_applicable_frameworks(risks, session_text)

        # Fetch all requirements for applicable frameworks
        placeholders = ",".join(["%s"] * len(applicable_fw))
        cur.execute(
        f"SELECT * FROM requirements WHERE framework_id IN ({placeholders})",
        applicable_fw
        )
        requirements = cur.fetchall()

        # Fetch all controls
        req_ids = [r["id"] for r in requirements]
        controls = []
        if req_ids:
            ctrl_ph = ",".join(["%s"] * len(req_ids))
            cur.execute(
                f"SELECT * FROM requirement_controls WHERE requirement_id IN ({ctrl_ph})",
                req_ids
            )
            controls = cur.fetchall()

        # Build control lookup: requirement_id → [controls]
        ctrl_map = {}
        for c in controls:
            ctrl_map.setdefault(c["requirement_id"], []).append(c)

        mappings = []
        now = datetime.now(timezone.utc).isoformat()

        for risk in risks:
            risk_id = risk.get("id", "")
            risk_cat = _CATEGORY_MAP.get(risk.get("category", ""), "ux_business")
            risk_desc = (risk.get("title", "") + " " + risk.get("description", "")).lower()
            risk_severity = risk.get("severity", "Medium")

            matched_reqs = []
            for req in requirements:
                # Check if any control for this requirement covers this risk category
                req_controls = ctrl_map.get(req["id"], [])
                for ctrl in req_controls:
                    ctrl_cats = json.loads(ctrl["risk_categories"]) if isinstance(ctrl["risk_categories"], str) else ctrl["risk_categories"]
                    if risk_cat in ctrl_cats:
                        # Keyword relevance boost
                        relevance = _compute_relevance(risk_desc, req, ctrl)
                        if relevance >= 0.3:
                            matched_reqs.append({
                                "requirement_id": req["id"],
                                "framework_id": req["framework_id"],
                                "article_ref": req["article_ref"],
                                "title": req["title"],
                                "obligation_type": req["obligation_type"],
                                "control": ctrl["control_description"],
                                "relevance": relevance,
                            })
                            break  # One match per requirement is enough

            # Deduplicate and store
            seen = set()
            for match in sorted(matched_reqs, key=lambda x: -x["relevance"]):
                if match["requirement_id"] not in seen:
                    seen.add(match["requirement_id"])
                    cur.execute(
                        """INSERT INTO risk_regulation_mappings
                           (session_id, risk_id, requirement_id, gap_status, notes, created_at)
                           VALUES (%s,%s,%s,%s,%s,%s)""",
                        (session_id, risk_id, match["requirement_id"],
                         "unmet", json.dumps(match), now)
                    )
                    mappings.append({
                        "risk_id": risk_id,
                        "risk_title": risk.get("title", ""),
                        **match,
                    })

        cur.close()

    # Build framework-level summary
    fw_summary = {}
    for m in mappings:
        fw = m["framework_id"]
        if fw not in fw_summary:
            fw_summary[fw] = {"framework_id": fw, "requirements_matched": 0, "risks_covered": set()}
        fw_summary[fw]["requirements_matched"] += 1
        fw_summary[fw]["risks_covered"].add(m["risk_id"])

    for v in fw_summary.values():
        v["risks_covered"] = len(v["risks_covered"])

    return {
        "session_id": session_id,
        "total_mappings": len(mappings),
        "frameworks_assessed": list(fw_summary.values()),
        "mappings": mappings,
        "applicable_frameworks": applicable_fw,
    }


def _detect_applicable_frameworks(risks: list, session_text: str = "") -> list:
    """Determine which frameworks apply based on risk content."""
    # NIST AI RMF always applies
    applicable = {"nist_ai_rmf"}
    combined_text = session_text.lower()
    for risk in risks:
        combined_text += " " + (risk.get("title", "") + " " + risk.get("description", "") + " " + risk.get("category", "")).lower()

    for fw_id, keywords in _FRAMEWORK_KEYWORDS.items():
        if not keywords:  # Empty = always applicable
            applicable.add(fw_id)
            continue
        for kw in keywords:
            if kw in combined_text:
                applicable.add(fw_id)
                break

    # OWASP always applies for LLM features
    applicable.add("owasp_llm")
    # EU AI Act — check all features by default in v3
    applicable.add("eu_ai_act")

    return list(applicable)


def _compute_relevance(risk_desc: str, req: dict, ctrl: dict) -> float:
    """Compute relevance score (0-1) between a risk and a requirement."""
    score = 0.3  # Base relevance if category matches
    req_text = (req["title"] + " " + req["description"]).lower()
    ctrl_text = ctrl["control_description"].lower()

    # Keyword overlap
    risk_words = set(risk_desc.split())
    req_words = set(req_text.split())
    ctrl_words = set(ctrl_text.split())

    overlap_req = len(risk_words & req_words) / max(len(risk_words), 1)
    overlap_ctrl = len(risk_words & ctrl_words) / max(len(risk_words), 1)

    score += min(overlap_req * 0.4, 0.3)
    score += min(overlap_ctrl * 0.3, 0.2)

    return min(score, 1.0)


# ═══════════════════════════════════════════════════════════════════════════════
# EU AI Act Risk Classification
# ═══════════════════════════════════════════════════════════════════════════════

_PROHIBITED_KEYWORDS = [
    "social scoring", "real-time biometric", "predictive policing",
    "manipulation of vulnerable", "subliminal", "emotion recognition workplace",
]

_HIGH_RISK_DOMAINS = [
    "biometric", "critical infrastructure", "education", "employment",
    "credit scoring", "law enforcement", "migration", "justice",
    "medical device", "safety component",
]

def classify_eu_ai_act_risk(feature_description: str, risks: list) -> dict:
    """Auto-classify a feature into EU AI Act risk tiers."""
    text = feature_description.lower()
    for risk in risks:
        text += " " + (risk.get("title", "") + " " + risk.get("description", "")).lower()

    # Check prohibited
    for kw in _PROHIBITED_KEYWORDS:
        if kw in text:
            return {
                "tier": "unacceptable",
                "article": "Art. 5",
                "action": "HARD BLOCK: Cannot proceed. Flag for legal review.",
                "matched_keyword": kw,
            }

    # Check high-risk
    for domain in _HIGH_RISK_DOMAINS:
        if domain in text:
            return {
                "tier": "high",
                "article": "Art. 6 / Annex III",
                "action": "Full conformity assessment required. All sign-offs mandatory.",
                "matched_domain": domain,
            }

    # Check limited risk (AI interacting with humans)
    limited_keywords = ["chatbot", "chat", "conversational", "synthetic content",
                       "deepfake", "emotion detection", "generated content"]
    for kw in limited_keywords:
        if kw in text:
            return {
                "tier": "limited",
                "article": "Art. 50",
                "action": "Transparency checklist auto-injected. Disclose AI use to end users.",
                "matched_keyword": kw,
            }

    return {
        "tier": "minimal",
        "article": "N/A",
        "action": "Standard analysis. Best-practice recommendations.",
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Compliance Templates (GDPR, SOC 2, HIPAA)
# ═══════════════════════════════════════════════════════════════════════════════

COMPLIANCE_TEMPLATES = {
    "gdpr": {
        "name": "GDPR AI Compliance",
        "framework_id": "gdpr",
        "items": [
            {"id": "gdpr_1", "item": "Document legal basis for AI data processing", "priority": "Must", "owner": "Legal/DPO", "article": "Art. 5(1)(a)"},
            {"id": "gdpr_2", "item": "Purpose limitation: AI outputs limited to stated purpose", "priority": "Must", "owner": "Engineering", "article": "Art. 5(1)(b)"},
            {"id": "gdpr_3", "item": "AI disclosure in privacy notice", "priority": "Must", "owner": "Legal/Product", "article": "Art. 13/14"},
            {"id": "gdpr_4", "item": "Human review mechanism for significant AI decisions", "priority": "Must", "owner": "Engineering", "article": "Art. 22"},
            {"id": "gdpr_5", "item": "PII minimisation in model inputs", "priority": "Must", "owner": "Engineering", "article": "Art. 25"},
            {"id": "gdpr_6", "item": "DPIA completed and documented for high-risk AI processing", "priority": "Must", "owner": "DPO", "article": "Art. 35"},
            {"id": "gdpr_7", "item": "Data retention policy for AI training/inference data", "priority": "Should", "owner": "Engineering", "article": "Art. 5(1)(e)"},
            {"id": "gdpr_8", "item": "Right to explanation for AI-driven decisions", "priority": "Should", "owner": "Product", "article": "Art. 22(3)"},
            {"id": "gdpr_9", "item": "Cross-border transfer assessment for AI data flows", "priority": "Should", "owner": "Legal", "article": "Art. 44-49"},
            {"id": "gdpr_10", "item": "Consent mechanism for AI feature data collection", "priority": "Must", "owner": "Product", "article": "Art. 6/7"},
            {"id": "gdpr_11", "item": "Data subject access request handling for AI data", "priority": "Must", "owner": "Engineering", "article": "Art. 15"},
            {"id": "gdpr_12", "item": "AI vendor DPA (Data Processing Agreement) in place", "priority": "Must", "owner": "Legal", "article": "Art. 28"},
        ],
    },
    "soc2": {
        "name": "SOC 2 AI Controls",
        "framework_id": "soc2",
        "items": [
            {"id": "soc2_1", "item": "Logical access controls for AI model endpoints", "priority": "Must", "owner": "Security", "article": "CC6.1"},
            {"id": "soc2_2", "item": "AI system change management and version control", "priority": "Must", "owner": "Engineering", "article": "CC7.2"},
            {"id": "soc2_3", "item": "AI output accuracy monitoring and alerting", "priority": "Must", "owner": "QA", "article": "CC8.1"},
            {"id": "soc2_4", "item": "AI processing integrity: input validation + output verification", "priority": "Must", "owner": "Engineering", "article": "PI1.1"},
            {"id": "soc2_5", "item": "AI system availability SLA and failover", "priority": "Should", "owner": "Infrastructure", "article": "A1.2"},
            {"id": "soc2_6", "item": "AI data confidentiality: encryption at rest and in transit", "priority": "Must", "owner": "Security", "article": "C1.1"},
            {"id": "soc2_7", "item": "AI incident response procedures documented", "priority": "Should", "owner": "Security", "article": "CC7.3"},
            {"id": "soc2_8", "item": "AI model endpoint penetration testing", "priority": "Should", "owner": "Security", "article": "CC4.1"},
        ],
    },
    "hipaa": {
        "name": "HIPAA AI Safeguards",
        "framework_id": "hipaa",
        "items": [
            {"id": "hipaa_1", "item": "Role-based access to PHI used by AI", "priority": "Must", "owner": "Security", "article": "164.312(a)"},
            {"id": "hipaa_2", "item": "AI cannot modify PHI without audit trail", "priority": "Must", "owner": "Engineering", "article": "164.312(c)"},
            {"id": "hipaa_3", "item": "Encrypted PHI in AI API calls", "priority": "Must", "owner": "Engineering", "article": "164.312(e)"},
            {"id": "hipaa_4", "item": "AI-specific risk assessment for PHI handling", "priority": "Must", "owner": "Compliance", "article": "164.308(a)(1)"},
            {"id": "hipaa_5", "item": "AI accesses only required PHI fields (minimum necessary)", "priority": "Must", "owner": "Engineering", "article": "164.502(b)"},
            {"id": "hipaa_6", "item": "6-year retention of AI processing records", "priority": "Must", "owner": "Compliance", "article": "164.530(j)"},
        ],
    },
}


# ═══════════════════════════════════════════════════════════════════════════════
# Query functions (used by API routes)
# ═══════════════════════════════════════════════════════════════════════════════

def get_frameworks(status: str = None) -> list:
    with get_db() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        if status:
            cur.execute("SELECT * FROM frameworks WHERE status=%s", (status,))
        else:
            cur.execute("SELECT * FROM frameworks")
        rows = cur.fetchall()
        cur.close()
    return [dict(r) for r in rows]

def get_framework_detail(framework_id: str) -> dict:
    with get_db() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM frameworks WHERE id=%s", (framework_id,))
        fw = cur.fetchone()
        if not fw:
            cur.close()
        return None
        cur.execute(
        "SELECT * FROM requirements WHERE framework_id=%s", (framework_id,)
        )
        reqs = cur.fetchall()
        cur.close()
    return {
        **dict(fw),
        "requirements": [dict(r) for r in reqs],
        "requirement_count": len(reqs),
    }

def get_framework_requirements(framework_id: str) -> list:
    with get_db() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
        "SELECT * FROM requirements WHERE framework_id=%s", (framework_id,)
        )
        rows = cur.fetchall()
        cur.close()
    return [dict(r) for r in rows]

def get_session_regulation_assessment(session_id: str) -> dict:
    with get_db() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
        "SELECT * FROM risk_regulation_mappings WHERE session_id=%s", (session_id,)
        )
        rows = cur.fetchall()
        mappings = []
        for r in rows:
            cur.execute("SELECT * FROM requirements WHERE id=%s", (r["requirement_id"],))
            req = cur.fetchone()
            fw = None
            if req:
                cur.execute("SELECT name, version FROM frameworks WHERE id=%s", (req["framework_id"],))
                fw = cur.fetchone()
            mappings.append({
                "risk_id": r["risk_id"],
                "requirement_id": r["requirement_id"],
                "gap_status": r["gap_status"],
                "article_ref": req["article_ref"] if req else "",
                "requirement_title": req["title"] if req else "",
                "framework": fw["name"] if fw else "",
                "framework_version": fw["version"] if fw else "",
                "notes": r["notes"],
            })
        cur.close()
    return {
        "session_id": session_id,
        "total_mappings": len(mappings),
        "mappings": mappings,
    }

def get_regulation_updates(status: str = None) -> list:
    with get_db() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        if status:
            cur.execute("SELECT * FROM regulation_updates WHERE status=%s ORDER BY detected_at DESC", (status,))
        else:
            cur.execute("SELECT * FROM regulation_updates ORDER BY detected_at DESC")
        rows = cur.fetchall()
        cur.close()
    return [dict(r) for r in rows]
