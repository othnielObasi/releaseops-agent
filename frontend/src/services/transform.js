/* ═══════════════════════════════════════════════════════════════
   Transform backend API responses → frontend display shapes
   ═══════════════════════════════════════════════════════════════ */

/**
 * Normalise the two shapes the backend returns:
 *  - List endpoint: flat { id, feature_title, navigator, sentinel, herald, readiness_score, ... }
 *  - Detail endpoint: nested { session: { id, ... }, navigator, sentinel, herald, error }
 */
function normalise(raw) {
  if (raw.session && typeof raw.session === "object") {
    return { sess: raw.session, nav: raw.navigator || {}, sen: raw.sentinel || {}, her: raw.herald || {}, agentRun: raw.agent_run || raw.session.agent_run || {} };
  }
  return { sess: raw, nav: raw.navigator || {}, sen: raw.sentinel || {}, her: raw.herald || {}, agentRun: raw.agent_run || {} };
}

const FRAMEWORK_DEFINITIONS = [
  { id: "euai", name: "EU AI Act", short: "EU AI", jurisdiction: "EU", categories: ["Safety", "Compliance"] },
  { id: "owasp", name: "OWASP Top 10 LLM", short: "OWASP", jurisdiction: "Global", categories: ["Security", "Privacy", "Safety"] },
  { id: "nist", name: "NIST AI RMF", short: "NIST", jurisdiction: "US", categories: ["UX/Business", "Safety", "Reliability"] },
  { id: "iso42001", name: "ISO 42001", short: "ISO 42001", jurisdiction: "Global", categories: ["Compliance", "Reliability"] },
  { id: "gdpr", name: "GDPR", short: "GDPR", jurisdiction: "EU", categories: ["Privacy"] },
  { id: "soc2", name: "SOC 2", short: "SOC 2", jurisdiction: "US", categories: ["Security", "Reliability", "Privacy"] },
  { id: "hipaa", name: "HIPAA", short: "HIPAA", jurisdiction: "US", categories: ["Privacy", "Compliance"] },
];

function buildFrameworkCoverage(risks, euTier, owasp, nist) {
  return FRAMEWORK_DEFINITIONS.map((framework) => {
    const relatedRisks = risks.filter((risk) => framework.categories.includes(risk.cat));
    const triggered = relatedRisks.length > 0 || (framework.id === "euai" && euTier !== "Minimal") || (framework.id === "owasp" && owasp.length > 0) || (framework.id === "nist" && nist.length > 0);
    return {
      ...framework,
      status: triggered ? "Mapped" : "Monitored",
      riskCount: relatedRisks.length,
      evidenceCount: Math.max(relatedRisks.length, framework.id === "owasp" ? owasp.length : framework.id === "nist" ? nist.length : 0),
    };
  });
}

/**
 * Transform a backend session (list item or detail response)
 * into the shape used by SessionsList, Dashboard, SessionDetail, etc.
 */
export function transformSession(raw) {
  const { sess, nav, sen, her, agentRun } = normalise(raw);

  const risks = (nav.risk_register?.risks || []).map((r) => ({
    id: r.id,
    n: r.title || r.name || "",
    s: r.severity || "Medium",
    cat: r.category || "Other",
    likelihood: r.likelihood || "Medium",
    impact: r.impact || "Medium",
  }));

  const checklist = nav.readiness_checklist?.checklist || [];
  const testCases = sen.test_cases?.test_cases || [];
  const guardrails = sen.guardrails?.guardrails || [];
  const score = sess.readiness_score?.score ?? 0;
  const grade = sess.readiness_score?.grade || "?";

  const high = risks.filter((r) => r.s === "High").length;
  const med = risks.filter((r) => r.s === "Medium").length;
  const low = risks.filter((r) => r.s === "Low").length;

  const landing = her.landing_copy || {};
  const confidence = nav.release_spec?.meta?.confidence || "Medium";

  // Generate tags from analysis
  const tags = [];
  if (checklist.length > 0) tags.push({ l: "Full Spec", c: "gn" });
  if (high >= 3) tags.push({ l: "Critical Risks", c: "rd" });
  else if (high > 0) tags.push({ l: "High Risks", c: "rd" });
  if (confidence === "Low") tags.push({ l: "Low Confidence", c: "or" });
  if (nav.release_spec?.meta?.needs_more_detail) tags.push({ l: "Needs Detail", c: "pk" });
  if (tags.length === 0 && sess.status === "complete") tags.push({ l: "Analysed", c: "bl" });

  // Derive EU AI Act tier from risk severity
  const euTier = high >= 3 ? "High-Risk" : high >= 1 ? "Limited" : "Minimal";

  // Derive OWASP codes from risk categories
  const owaspMap = { Privacy: "LLM06", Safety: "LLM01", Security: "LLM03", "UX/Business": "LLM09" };
  const owasp = [...new Set(risks.map((r) => owaspMap[r.cat]).filter(Boolean))];

  // Derive NIST codes
  const nist = risks.length > 0 ? ["MAP-4", "MEASURE-2", "MANAGE-2"].slice(0, Math.min(3, risks.length)) : [];
  const frameworkCoverage = buildFrameworkCoverage(risks, euTier, owasp, nist);

  return {
    id: sess.id,
    title: sess.feature_title || "Untitled",
    type: "live",
    icon: "⚡",
    date: new Date(sess.created_at).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
    bc: high >= 3 ? "rd" : high >= 1 ? "or" : "gn",
    desc: sess.feature_description || "",
    tags,
    risks,
    st: {
      risks: risks.length,
      check: checklist.length,
      tests: testCases.length,
      guard: guardrails.length,
      score,
    },
    sb: [high, med, low],
    cl: checklist.map((c) => c.item || c),
    co: checklist.map((c) => c.owner_role || "Team"),
    clIds: checklist.map((c) => c.id || ""),
    clCat: checklist.map((c) => c.category || ""),
    clPri: checklist.map((c) => c.priority || "Must"),
    gtm: {
      h: landing.hero_title || "",
      t: landing.hero_subtitle || landing.tagline || "",
      b: (landing.key_benefits || []).length,
      f: (landing.feature_sections || []).length,
      benefits: landing.key_benefits || [],
      sections: landing.feature_sections || [],
      trust: landing.trust_and_safety || {},
      cta: landing.cta || "",
    },
    signoffs: [
      { role: "PM", status: "pending", user: null, at: null },
      { role: "Legal", status: "pending", user: null, at: null },
      { role: "QA", status: "pending", user: null, at: null },
      { role: "Security", status: "pending", user: null, at: null },
    ],
    euTier,
    owasp,
    nist,
    frameworkCoverage,
    frameworkCount: frameworkCoverage.length,
    mappedFrameworkCount: frameworkCoverage.filter((framework) => framework.status === "Mapped").length,
    drift: { active: false },
    // Structured sub-data for detail view
    testCases,
    guardrails,
    releaseNotes: her.release_notes || {},
    pitchOutline: her.pitch_outline || {},
    releaseSpec: nav.release_spec || {},
    agentRun,
    // Keep raw data for detail view
    _raw: raw,
    _status: sess.status,
    _version: sess.version || 1,
    _grade: grade,
  };
}

/**
 * Transform a list of raw backend sessions.
 */
export function transformSessionList(rawList) {
  return (rawList || []).filter((r) => r && r.id).map(transformSession);
}
