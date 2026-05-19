/* ═══════════════════════════════════════════════════════════════
   ReleaseOps v3 — Regulation Frameworks & Gate Configuration
   ═══════════════════════════════════════════════════════════════ */

export const REG_FRAMEWORKS = [
  {
    id: "euai", name: "EU AI Act", version: "2024/1689", jurisdiction: "EU", reqs: 87, status: "Active",
    articles: [
      "Art. 5 — Prohibited practices", "Art. 6 — High-risk classification",
      "Art. 9 — Risk management system", "Art. 10 — Data governance",
      "Art. 13 — Transparency", "Art. 14 — Human oversight",
      "Art. 15 — Accuracy & robustness", "Art. 50 — Transparency (limited risk)",
    ],
  },
  {
    id: "owasp", name: "OWASP Top 10 LLM", version: "2025 v2.0", jurisdiction: "Global", reqs: 47, status: "Active",
    articles: [
      "LLM01 — Prompt Injection", "LLM02 — Insecure Output",
      "LLM03 — Training Data Poisoning", "LLM04 — Model DoS",
      "LLM05 — Supply Chain", "LLM06 — Sensitive Info Disclosure",
      "LLM07 — Insecure Plugin", "LLM08 — Excessive Agency",
      "LLM09 — Overreliance", "LLM10 — Model Theft",
    ],
  },
  {
    id: "nist", name: "NIST AI RMF", version: "v1.0", jurisdiction: "US", reqs: 72, status: "Active",
    articles: [
      "GOVERN — Policies & accountability", "MAP — Context & stakeholder impact",
      "MEASURE — Risk assessment", "MANAGE — Risk treatment & monitoring",
    ],
  },
  {
    id: "iso", name: "ISO/IEC 42001", version: "2023", jurisdiction: "International", reqs: 39, status: "Active",
    articles: ["Annex A — AI management controls"],
  },
  {
    id: "gdpr", name: "GDPR (AI articles)", version: "2016/679", jurisdiction: "EU", reqs: 12, status: "Active",
    articles: [
      "Art. 22 — Automated decision-making",
      "Art. 25 — Data protection by design",
      "Art. 35 — DPIA",
    ],
  },
  {
    id: "soc2", name: "SOC 2 Type II", version: "2022", jurisdiction: "US", reqs: 23, status: "Active",
    articles: ["CC6 — Logical access", "CC7 — Change management", "PI1 — Processing integrity"],
  },
  {
    id: "hipaa", name: "HIPAA", version: "2013 + AI", jurisdiction: "US", reqs: 18, status: "Active",
    articles: ["164.312 — Technical safeguards", "164.502 — Minimum necessary"],
  },
];

export const GATE_CONFIG = {
  name: "Production Gate",
  type: "CI/CD",
  minScore: 65,
  requiredSignoffs: ["PM", "Legal", "QA"],
  requiredFrameworks: ["EU AI Act", "OWASP"],
  active: true,
};
