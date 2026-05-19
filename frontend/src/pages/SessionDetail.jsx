/* ReleaseOps v3 — Session Detail Page (Tailwind) — wired to real API */

import { useState, useEffect } from "react";
import { Badge, Card, Button, CircularScore, ProgressBar, Label } from "../components/ui";
import Pipeline from "../components/Pipeline";
import Heatmap from "../components/Heatmap";
import { sessions as sessionsAPI, analysis as analysisAPI, governance, exports as exportsAPI, gates as gatesAPI, versions as versionsAPI } from "../services/api";
import { transformSession } from "../services/transform";

const EMPTY_INTEGRATIONS = {
  slack_webhook: "",
  jira_url: "",
  jira_token: "",
  jira_project: "",
  github_token: "",
  github_repo: "",
  github_pr: "",
  linear_token: "",
  linear_team_id: "",
};

export default function SessionDetail({ sessionId, fallback, onBack, onOpenSession, onRefreshSessions }) {
  const [s, setS] = useState(fallback || null);
  const [loading, setLoading] = useState(!fallback);
  const [tab, setTab] = useState("overview");
  const [actionMsg, setActionMsg] = useState("");
  const [signoffs, setSignoffs] = useState([]);
  const [gateResult, setGateResult] = useState(null);
  const [gatesList, setGatesList] = useState([]);
  const [integrations, setIntegrations] = useState(EMPTY_INTEGRATIONS);
  const [versionHistory, setVersionHistory] = useState([]);
  const [showReanalyzeModal, setShowReanalyzeModal] = useState(false);
  const [reanalyzeTitle, setReanalyzeTitle] = useState("");
  const [reanalyzeDesc, setReanalyzeDesc] = useState("");
  const [reanalyzing, setReanalyzing] = useState(false);

  const fetchDetail = () => {
    if (!sessionId) return;
    setLoading(true);
    sessionsAPI.get(sessionId).then((raw) => {
      setS(transformSession(raw));
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDetail();
    if (sessionId) {
      governance.signoffs(sessionId).then((r) => setSignoffs(r.sign_offs || [])).catch(() => {});
      gatesAPI.list().then((r) => setGatesList(r.gates || [])).catch(() => {});
      sessionsAPI.integrations(sessionId).then((r) => setIntegrations({ ...EMPTY_INTEGRATIONS, ...(r.integrations || {}) })).catch(() => setIntegrations(EMPTY_INTEGRATIONS));
      versionsAPI.list(sessionId).then((r) => setVersionHistory(r.versions || [])).catch(() => {});
    }
  }, [sessionId]);

  if (loading && !s) {
    return (
      <div className="max-w-[960px] mx-auto pt-10 text-center">
        <div className="text-tx-3 text-sm animate-pulse">Loading session...</div>
      </div>
    );
  }

  if (!s) {
    return (
      <div className="max-w-[960px] mx-auto pt-10 text-center">
        <div className="text-tx-3 text-sm">Session not found.</div>
        <Button variant="ghost" size="sm" onClick={onBack} className="mt-3">← Back to Sessions</Button>
      </div>
    );
  }

  const st = s.st;

  return (
    <div className="max-w-[960px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-2 pt-4 mb-1 animate-fade-up">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="xs" onClick={onBack}>← Back</Button>
          <span className="text-xl">{s.icon}</span>
          <div>
            <div className="text-lg font-bold text-tx flex items-center gap-1.5">
              {s.title}
              <Badge color={s.type === "demo" ? "or" : "bl"} size="xs">{s.type}</Badge>
              <Badge color={s.euTier === "High-Risk" ? "rd" : s.euTier === "Limited" ? "or" : "gn"} size="xs">EU: {s.euTier}</Badge>
            </div>
            <div className="text-xs text-tx-3 font-mono">{s.date}</div>
          </div>
        </div>
        <div className="flex gap-1 flex-wrap">
          <Button variant="danger" size="xs" disabled={reanalyzing} onClick={() => { setReanalyzeTitle(s.title); setReanalyzeDesc(s.desc); setShowReanalyzeModal(true); }}>{reanalyzing ? "⏳ Re-analyzing..." : "🔄 Re-analyze"}</Button>
          <Button variant="success" size="xs" onClick={async () => { setActionMsg("Generating..."); try { await exportsAPI.evidencePack(sessionId); setActionMsg("Evidence pack downloaded."); } catch (e) { setActionMsg(e.message || "Evidence pack failed."); } }}>⬇ Package</Button>
          <Button variant="primary" size="xs" onClick={async () => { setActionMsg("Generating certificate..."); try { const cert = await exportsAPI.certificate(sessionId); if (cert.html) { const blob = new Blob([cert.html], { type: "text/html" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `releaseops-certificate-${sessionId.slice(0,8)}.html`; a.click(); URL.revokeObjectURL(url); } setActionMsg(`Certificate ${cert.certificate_id?.slice(0, 8)} issued — score: ${cert.readiness_score ?? "N/A"}, grade: ${cert.grade ?? "N/A"}.`); } catch (e) { setActionMsg(e.message || "Certificate failed."); } }}>📜 Certificate</Button>
          <Button variant="ghost" size="xs" onClick={async () => { try { const res = await exportsAPI.share(sessionId); await navigator.clipboard?.writeText(res.share_url || window.location.href); setActionMsg("Share link copied!"); } catch { setActionMsg("Share link failed."); } }}>🔗 Share</Button>
          <Badge color="gn">✓ COMPLETE</Badge>
        </div>
      </div>

      {actionMsg && (
        <div className="bg-lg-sf2 border border-lg-bd rounded-md px-3 py-1.5 my-1 text-sm text-tx-2 flex justify-between animate-fade-up">
          <span>{actionMsg}</span>
          <button onClick={() => setActionMsg("")} className="text-tx-4 cursor-pointer bg-transparent border-none font-sans">×</button>
        </div>
      )}

      {/* Re-analyze Modal */}
      {showReanalyzeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowReanalyzeModal(false)}>
          <div className="bg-lg-sf border border-lg-bd rounded-xl p-5 w-full max-w-md shadow-2xl animate-fade-up" onClick={(e) => e.stopPropagation()}>
            <div className="text-lg font-bold text-tx mb-3">🔄 Re-analyze Feature</div>
            <div className="text-sm text-tx-3 mb-3">Edit the title or description before re-running the full analysis pipeline. A new version will be created.</div>
            <label className="text-xs font-semibold text-tx-2 block mb-1">Feature Title</label>
            <input value={reanalyzeTitle} onChange={(e) => setReanalyzeTitle(e.target.value)} className="input-glass text-sm w-full mb-3" />
            <label className="text-xs font-semibold text-tx-2 block mb-1">Description</label>
            <textarea value={reanalyzeDesc} onChange={(e) => setReanalyzeDesc(e.target.value)} rows={4} className="input-glass text-sm w-full mb-4 resize-y" />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowReanalyzeModal(false)}>Cancel</Button>
              <Button variant="primary" size="sm" disabled={reanalyzing} onClick={async () => {
                setShowReanalyzeModal(false);
                setReanalyzing(true);
                setActionMsg("Re-analysing — running full Navigator → Sentinel → Herald pipeline...");
                try {
                  const res = await analysisAPI.run(sessionId, { feature_title: reanalyzeTitle, feature_description: reanalyzeDesc });
                  const newId = res.session_id;
                  const newVersion = res.version;
                  setActionMsg(`v${newVersion} created — waiting for pipeline to complete...`);
                  // Poll for completion
                  const poll = setInterval(async () => {
                    try {
                      const status = await sessionsAPI.get(newId);
                      const st = status.session?.status || status.status;
                      if (st === "complete" || st === "error") {
                        clearInterval(poll);
                        setReanalyzing(false);
                        if (st === "complete") {
                          setActionMsg(`v${newVersion} analysis complete! Navigating...`);
                          if (onRefreshSessions) onRefreshSessions();
                          setTimeout(() => { if (onOpenSession) onOpenSession(newId); }, 500);
                        } else {
                          setActionMsg(`v${newVersion} analysis failed.`);
                        }
                        versionsAPI.list(sessionId).then((r) => setVersionHistory(r.versions || [])).catch(() => {});
                      }
                    } catch { /* keep polling */ }
                  }, 3000);
                  // Safety timeout: stop polling after 2 minutes
                  setTimeout(() => { clearInterval(poll); setReanalyzing(false); }, 120000);
                } catch (e) { setReanalyzing(false); setActionMsg(e.message || "Re-analysis failed."); }
              }}>🚀 Run Analysis</Button>
            </div>
          </div>
        </div>
      )}

      <Pipeline phase={3} />

      {/* AI Warning */}
      <div className="bg-accent-orange/8 border border-accent-orange/20 rounded-md px-3 py-1.5 my-2 text-sm text-accent-orange2 animate-fade-up-1">
        ⚠ AI-generated — requires human review before production use.
      </div>

      {/* Tabs */}
      <div className="flex gap-0 mb-4 border-b border-lg-bd overflow-x-auto">
        {[{ k: "overview", l: "Overview" }, { k: "spec", l: "Spec & Risks" }, { k: "tests", l: "Tests & Guardrails" }, { k: "docs", l: "Docs & Launch" }, { k: "regulation", l: "Regulation" }, { k: "governance", l: "Governance" }].map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)} className={`bg-transparent border-none text-sm px-3.5 py-2.5 cursor-pointer font-sans whitespace-nowrap transition-colors border-b-2 ${tab === t.k ? "text-tx font-semibold border-accent-purple2" : "text-tx-3 font-normal border-transparent hover:text-tx-2"}`}>
            {t.l}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab s={s} st={st} versionHistory={versionHistory} currentSessionId={sessionId} onOpenSession={onOpenSession} />}
      {tab === "spec" && <SpecTab s={s} />}
      {tab === "tests" && <TestsTab s={s} st={st} />}
      {tab === "docs" && <DocsTab s={s} />}
      {tab === "regulation" && <RegulationTab s={s} />}
      {tab === "governance" && <GovernanceTab s={s} st={st} sessionId={sessionId} signoffs={signoffs} setSignoffs={setSignoffs} gatesList={gatesList} gateResult={gateResult} setGateResult={setGateResult} integrations={integrations} setIntegrations={setIntegrations} />}
    </div>
  );
}

/* ── Overview ── */
function OverviewTab({ s, st, versionHistory, currentSessionId, onOpenSession }) {
  const sortedVersions = [...(versionHistory || [])].sort((a, b) => a.version - b.version);
  return (
    <div className="space-y-3">
      {/* Version History Timeline */}
      {sortedVersions.length > 1 && (
        <Card className="animate-fade-up">
          <div className="flex items-center gap-1.5 mb-2.5">
            <span>📊</span>
            <span className="text-base font-bold text-tx">Version History</span>
            <span className="text-xs text-tx-3 ml-auto">{sortedVersions.length} versions</span>
          </div>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[14px] top-3 bottom-3 w-[2px] bg-lg-bd2" />
            <div className="space-y-0">
              {sortedVersions.map((v) => {
                const isCurrent = v.session_id === currentSessionId;
                const scoreColor = v.score >= 80 ? "text-accent-green" : v.score >= 50 ? "text-accent-orange" : "text-accent-red";
                const gradeColor = v.grade === "A" || v.grade === "B" ? "gn" : v.grade === "C" ? "or" : "rd";
                return (
                  <div key={v.session_id} className={`flex items-center gap-3 py-2 pl-1 relative ${isCurrent ? "bg-accent-purple/5 rounded-lg -mx-1 px-2" : ""}`}>
                    <div className={`w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center shrink-0 z-10 ${isCurrent ? "bg-accent-purple2 border-accent-purple2" : "bg-lg-sf border-lg-bd2"}`}>
                      <span className={`text-[10px] font-bold ${isCurrent ? "text-white" : "text-tx-3"}`}>{v.version}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-tx">v{v.version}</span>
                        {isCurrent && <Badge color="pr" size="xs">(current)</Badge>}
                        <Badge color={gradeColor} size="xs">{v.score}/100 — {v.grade}</Badge>
                      </div>
                      <div className="text-xs text-tx-4 mt-0.5">{new Date(v.created_at).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                    </div>
                    {!isCurrent && onOpenSession && (
                      <button onClick={() => onOpenSession(v.session_id)} className="text-xs text-accent-purple2 hover:underline shrink-0 bg-transparent border-none cursor-pointer font-sans">View →</button>
                    )}
                    {/* Score bar */}
                    <div className="w-[60px] shrink-0">
                      <div className="h-1.5 bg-lg-sf3 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${v.score >= 80 ? "bg-accent-green" : v.score >= 50 ? "bg-accent-orange" : "bg-accent-red"}`} style={{ width: `${v.score}%` }} />
                      </div>
                      <div className={`text-[10px] font-bold text-right mt-0.5 ${scoreColor}`}>{v.score}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* Readiness Score */}
      <Card className="animate-fade-up">
        <div className="flex justify-between">
          <div className="flex items-center gap-1.5"><span>🏆</span><span className="text-base font-bold text-tx">Readiness Score</span></div>
          <span className="text-xs text-tx-3">Risk coverage, spec, tests, guardrails, checklist</span>
        </div>
        <div className="flex items-center gap-7 mt-3.5">
          <div className="text-center shrink-0">
            <CircularScore score={st.score} size={90} />
            <div className="text-xs text-tx-4 mt-0.5">/ 100</div>
          </div>
          <div className="flex-1 flex flex-col gap-1.5">
            {[
              { l: "Risk Coverage", p: 100, c: "bg-accent-green" },
              { l: "Spec Completeness", p: 100, c: "bg-accent-green" },
              { l: "Test Coverage", p: Math.round((st.tests / Math.max(st.risks, 1)) * 25), c: "bg-accent-red" },
              { l: "Guardrails", p: Math.round((st.guard / Math.max(st.risks, 1)) * 25), c: "bg-accent-red" },
              { l: "Checklist", p: Math.round((st.check / 10) * 20), c: "bg-accent-red" },
            ].map((b, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-sm text-tx-2 w-[110px] shrink-0">{b.l}</span>
                <ProgressBar percent={b.p} color={b.c} />
                <span className="text-xs font-semibold w-[30px] text-right" style={{ color: b.p >= 80 ? "#22c55e" : b.p >= 50 ? "#f59e0b" : "#ef4444" }}>{b.p}%</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 animate-fade-up-1">
        {[{ i: "⚠️", v: st.risks, l: "Risks", c: "text-accent-orange" }, { i: "✅", v: st.check, l: "Checklist", c: "text-accent-green" }, { i: "✏️", v: st.tests, l: "Tests", c: "text-accent-teal" }, { i: "🛡", v: st.guard, l: "Guardrails", c: "text-accent-purple2" }].map((x, i) => (
          <Card key={i} className="text-center !p-3">
            <div className="text-sm">{x.i}</div>
            <div className={`text-2xl font-extrabold ${x.c}`}>{x.v}</div>
            <div className="text-sm text-tx-3">{x.l}</div>
          </Card>
        ))}
      </div>

      {/* Risk Severity */}
      <Card className="animate-fade-up-2">
        <Label>Risk Severity</Label>
        <div className="flex gap-1.5 mb-2">
          <Badge color="rd" size="xs">{s.sb[0]} High</Badge>
          <Badge color="or" size="xs">{s.sb[1]} Medium</Badge>
          <Badge color="gn" size="xs">{s.sb[2]} Low</Badge>
        </div>
        {s.risks.map((r, i) => (
          <div key={i} className="flex justify-between items-center py-2 border-t border-lg-bd">
            <span className="text-sm text-tx"><span className="text-tx-3 mr-2 font-mono text-xs">{r.id}</span>{r.n}</span>
            <div className="flex gap-1">
              <Badge color={r.s === "High" ? "rd" : "or"} size="xs">{r.s}</Badge>
              <Badge color="bl" size="xs">{r.cat}</Badge>
            </div>
          </div>
        ))}
      </Card>

      {/* Checklist */}
      <Card className="animate-fade-up-3">
        <Label>Must-Do Before Launch</Label>
        {s.cl.map((c, i) => (
          <div key={i} className={`flex items-center gap-2 py-1.5 ${i ? "border-t border-lg-bd" : ""}`}>
            <div className="w-3.5 h-3.5 rounded-sm border-[1.5px] border-lg-bd2 shrink-0" />
            <span className="flex-1 text-sm text-tx-2 leading-snug">{c}</span>
            <Badge color="rd" size="xs">Must</Badge>
            <span className="text-xs text-tx-4 font-mono">{s.co[i]}</span>
          </div>
        ))}
      </Card>

      {/* GTM Preview */}
      <Card className="animate-fade-up-4">
        <Label>📣 GTM Preview</Label>
        <div className="bg-lg-sf2 rounded-lg p-3">
          <div className="text-base font-bold text-accent-red2">{s.gtm.h}</div>
          <div className="text-sm text-tx-4 mt-0.5 italic">{s.gtm.t}</div>
          <div className="flex gap-1 mt-2">
            <Badge color="bl" size="xs">✦ {s.gtm.b} Benefits</Badge>
            <Badge color="tl" size="xs">◎ {s.gtm.f} Features</Badge>
            <Badge color="or" size="xs">🔒 Trust</Badge>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ── Spec & Risks ── */
function SpecTab({ s }) {
  return (
    <div className="space-y-3.5">
      {/* Compliance bar */}
      <div className="flex items-center gap-2 px-3.5 py-2.5 bg-lg-sf2 border border-lg-bd rounded-lg animate-fade-up">
        <span className="text-sm text-tx-2 font-semibold">📋 Compliance:</span>
        {["GDPR", "SOC2", "HIPAA"].map((c) => (
          <button key={c} className="bg-lg-sf3 border border-lg-bd rounded-md px-2.5 py-1 text-sm font-semibold text-tx cursor-pointer font-sans hover:border-lg-bd2 transition-colors">{c}</button>
        ))}
        <span className="text-xs text-tx-3">Add compliance checklist items</span>
      </div>

      {/* Risk Heatmap */}
      <Card className="animate-fade-up-1">
        <Label>📊 Risk Heatmap — {s.risks.length} total: {s.sb[0]} High · {s.sb[1]} Medium · {s.sb[2]} Low</Label>
        <Heatmap risks={s.risks} />
      </Card>

      {/* Release Spec */}
      <Card className="animate-fade-up-2">
        <Label>📋 Release Spec</Label>
        <div className="text-sm text-tx-2 leading-relaxed"><strong className="text-tx">Problem:</strong> {s.desc}</div>
      </Card>

      {/* Risk Register */}
      <Card className="animate-fade-up-3">
        <div className="flex justify-between mb-2.5">
          <Label>⚠️ Risk Register</Label>
          <Button variant="ghost" size="xs">📋 Copy Markdown</Button>
        </div>
        <div className="grid grid-cols-[35px_1fr_80px_70px_65px_65px_55px] px-0 py-1.5 border-b border-lg-bd">
          {["ID", "TITLE", "CATEGORY", "LIKELIHOOD", "IMPACT", "SEVERITY", "TEST"].map((h) => (
            <div key={h} className="text-xs font-bold text-tx-3 tracking-wider uppercase">{h}</div>
          ))}
        </div>
        {s.risks.map((r, i) => (
          <div key={i} className="grid grid-cols-[35px_1fr_80px_70px_65px_65px_55px] py-2 border-b border-lg-bd items-center">
            <div className="text-sm text-tx-3 font-mono">{r.id}</div>
            <div className="text-sm font-semibold text-tx">{r.n}</div>
            <div><Badge color={r.cat === "Privacy" ? "pk" : r.cat === "Safety" ? "rd" : "bl"} size="xs">{r.cat}</Badge></div>
            <div className="text-sm text-tx-2">{r.likelihood || "Medium"}</div>
            <div className="text-sm text-tx-2">{r.impact || "High"}</div>
            <div><Badge color={r.s === "High" ? "rd" : "or"} size="xs">{r.s}</Badge></div>
            <div><Badge color="tl" size="xs">T{i + 1}</Badge></div>
          </div>
        ))}
      </Card>

      {/* Checklist */}
      <Card className="animate-fade-up-4">
        <Label>✅ Readiness Checklist</Label>
        {s.cl.map((c, i) => (
          <div key={i} className="flex items-center gap-2 py-1.5 border-b border-lg-bd">
            <div className="w-3.5 h-3.5 rounded-sm border-[1.5px] border-lg-bd2 shrink-0" />
            <span className="flex-1 text-sm text-tx-2">{c}</span>
            <Badge color="rd" size="xs">Must</Badge>
            <span className="text-xs text-tx-4 font-mono">{s.co[i]}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

/* ── Tests & Guardrails ── */
function TestsTab({ s, st }) {
  const tc = s.testCases || [];
  const gr = s.guardrails || [];
  const risks = s.risks || [];

  // Build traceability links: risk → tests → guardrails
  const traceRows = risks.map((r) => {
    const linkedTests = tc.filter((t) => (t.linked_risks || []).includes(r.id));
    const linkedGuardrails = gr.filter((g) => (g.risk_ids || []).includes(r.id));
    return { risk: r, tests: linkedTests, guardrails: linkedGuardrails };
  });

  // Group tests by category for testing strategy
  const strategyMap = {};
  tc.forEach((t) => {
    const cat = t.category || "General";
    if (!strategyMap[cat]) strategyMap[cat] = { tests: [], automated: 0, manual: 0 };
    strategyMap[cat].tests.push(t);
    if (t.automation === "Automated") strategyMap[cat].automated++;
    else strategyMap[cat].manual++;
  });
  const strategyEntries = Object.entries(strategyMap);

  const STRATEGY_ICONS = { Functional: "🧪", Security: "🔒", Performance: "⚡", Privacy: "🛡", Safety: "⚠️", Integration: "🔗", "Edge Case": "🔀", UX: "🎨" };
  const STRATEGY_COLORS = { Functional: "bl", Security: "rd", Performance: "or", Privacy: "pk", Safety: "rd", Integration: "tl", "Edge Case": "pr", UX: "gn" };

  return (
    <div className="space-y-3.5">
      {/* Traceability Chain */}
      {traceRows.length > 0 && (
        <Card className="animate-fade-up">
          <div className="flex justify-between items-center mb-2">
            <Label>✅ Traceability Chain</Label>
            <span className="text-xs text-tx-3">Each risk is linked to its test cases and guardrails — click rows to expand details.</span>
          </div>
          <div className="grid grid-cols-[1fr_1fr_1fr] gap-0 text-xs font-bold text-tx-3 uppercase tracking-wider px-2 py-1.5 border-b border-lg-bd">
            <div>⚠️ Risk Identified</div>
            <div>✏️ Test Cases</div>
            <div>🛡 Guardrails</div>
          </div>
          {traceRows.map((row, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr] gap-0 border-b border-lg-bd items-start">
              <div className="px-2 py-2.5">
                <div className="flex items-center gap-1">
                  <Badge color={row.risk.s === "High" ? "rd" : "or"} size="xs">{row.risk.s}</Badge>
                  <span className="text-sm font-semibold text-tx">{row.risk.id}</span>
                </div>
                <div className="text-xs text-tx-2 mt-0.5 leading-snug">{row.risk.n}</div>
              </div>
              <div className="px-2 py-2.5 border-x border-lg-bd">
                {row.tests.length > 0 ? row.tests.map((t) => (
                  <div key={t.id} className="flex items-center gap-1 mb-1">
                    <Badge color="tl" size="xs">{t.id}</Badge>
                    <span className="text-xs text-tx-2 truncate">{t.name}</span>
                  </div>
                )) : <span className="text-xs text-tx-4 italic">No linked tests</span>}
              </div>
              <div className="px-2 py-2.5">
                {row.guardrails.length > 0 ? row.guardrails.map((g) => (
                  <div key={g.id} className="flex items-center gap-1 mb-1">
                    <Badge color="gn" size="xs">{g.id}</Badge>
                    <span className="text-xs text-tx-2 truncate">{g.name}</span>
                  </div>
                )) : <span className="text-xs text-tx-4 italic">No linked guardrails</span>}
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Testing Strategy */}
      {strategyEntries.length > 0 && (
        <Card className="animate-fade-up-1">
          <Label>🔬 Testing Strategy</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
            {strategyEntries.map(([cat, data]) => (
              <div key={cat} className="p-2.5 bg-lg-sf2 rounded-lg border border-lg-bd">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-sm">{STRATEGY_ICONS[cat] || "📋"}</span>
                  <span className="text-sm font-bold text-tx">{cat}</span>
                </div>
                <div className="text-xs text-tx-3 leading-snug mb-2">
                  {data.tests.length} test{data.tests.length !== 1 ? "s" : ""} covering {cat.toLowerCase()} scenarios.
                </div>
                <div className="flex gap-1">
                  {data.automated > 0 && <Badge color={STRATEGY_COLORS[cat] || "bl"} size="xs">Automated: {data.automated}</Badge>}
                  {data.manual > 0 && <Badge color="or" size="xs">Manual: {data.manual}</Badge>}
                </div>
                <div className="text-[10px] text-tx-4 mt-1.5 font-semibold uppercase tracking-wider">
                  Review: <span className={data.automated >= data.manual ? "text-accent-green" : "text-accent-orange"}>{data.automated >= data.manual ? "✓ Ready" : "⏳ Pending"}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Test Cases Table */}
      <Card className="animate-fade-up-2">
        <Label>✏️ Test Cases ({tc.length})</Label>
        {tc.length > 0 ? (
          <>
            <div className="grid grid-cols-[35px_1fr_80px_75px_80px_70px] px-1 py-1.5 border-b border-lg-bd">
              {["ID", "NAME", "CATEGORY", "TEST TYPE", "AUTOMATION", "LINKED RISKS"].map((h) => (
                <div key={h} className="text-[10px] font-bold text-tx-3 tracking-wider uppercase">{h}</div>
              ))}
            </div>
            {tc.map((t, i) => (
              <div key={t.id || i} className="grid grid-cols-[35px_1fr_80px_75px_80px_70px] py-2 px-1 border-b border-lg-bd items-center hover:bg-lg-sf2/50 transition-colors">
                <div className="text-sm text-tx-3 font-mono">{t.id}</div>
                <div>
                  <div className="text-sm font-semibold text-tx">{t.name}</div>
                  <div className="text-[11px] text-tx-4 mt-0.5 leading-snug line-clamp-1">{t.expected_behavior}</div>
                </div>
                <div><Badge color="pr" size="xs">{t.category}</Badge></div>
                <div className="text-xs text-tx-2">{t.test_type || t.category}</div>
                <div><Badge color={t.automation === "Automated" ? "gn" : "or"} size="xs">{t.automation}</Badge></div>
                <div className="flex flex-wrap gap-0.5">{(t.linked_risks || []).map((r) => <Badge key={r} color="or" size="xs">{r}</Badge>)}</div>
              </div>
            ))}
            <div className="text-xs text-tx-4 mt-2 italic">Risk-to-test ratio: {tc.length} tests for {risks.length} identified risks.</div>
          </>
        ) : (
          <div className="text-sm text-tx-3 py-2">No test cases generated.</div>
        )}
      </Card>

      {/* Guardrails & Risk Hooks */}
      <Card className="animate-fade-up-3">
        <Label>🛡 Guardrails & Risk Hooks ({gr.length})</Label>
        <div className="space-y-2.5 mt-1">
          {gr.map((g, i) => (
            <div key={g.id || i} className="bg-lg-sf2 rounded-lg border border-lg-bd overflow-hidden">
              <div className="flex justify-between items-start p-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-tx">• {g.name}</span>
                    <Badge color={g.where_applied === "Runtime" ? "rd" : g.where_applied === "Pre-Deploy" ? "or" : "gn"} size="xs">{g.where_applied}</Badge>
                  </div>
                  <div className="text-xs text-tx-3 mt-1 leading-snug">{g.description}</div>
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {(g.risk_ids || []).map((r) => {
                      const linkedRisk = risks.find((ri) => ri.id === r);
                      return <Badge key={r} color={linkedRisk?.s === "High" ? "rd" : "or"} size="xs">→ {r}{linkedRisk ? `: ${linkedRisk.n}` : ""}</Badge>;
                    })}
                  </div>
                </div>
              </div>
              {g.implementation_idea && (
                <div className="px-3 pb-3">
                  <div className="text-[10px] text-tx-4 font-semibold uppercase tracking-wider mb-1">Implementation</div>
                  <div className="bg-lg-sf3 rounded-md px-3 py-2 font-mono text-xs text-tx-2 leading-relaxed border border-lg-bd">{g.implementation_idea}</div>
                </div>
              )}
            </div>
          ))}
          {gr.length === 0 && <div className="text-sm text-tx-3 py-2">No guardrails generated.</div>}
        </div>
      </Card>
    </div>
  );
}

/* ── Docs & Launch ── */
function DocsTab({ s }) {
  const rn = s.releaseNotes || {};
  const po = s.pitchOutline || {};
  const slides = po.slides || [];
  return (
    <div className="space-y-3.5">
      <Card className="animate-fade-up">
        <Label>📝 Release Notes</Label>
        <div className="p-3 bg-lg-sf2 rounded-lg text-sm text-tx-2 leading-relaxed">
          <strong className="text-accent-purple2">{rn.version || "v1.0"} — {rn.title || s.title}</strong><br /><br />
          {rn.summary && <><strong className="text-tx">Summary:</strong> {rn.summary}<br /><br /></>}
          {(rn.whats_new || []).length > 0 && (
            <><strong className="text-tx">What's New:</strong>
            <ul className="list-disc ml-4 mt-1">{rn.whats_new.map((w, i) => <li key={i}>{w}</li>)}</ul><br /></>
          )}
          {(rn.why_it_matters || []).length > 0 && (
            <><strong className="text-tx">Why It Matters:</strong>
            <ul className="list-disc ml-4 mt-1">{rn.why_it_matters.map((w, i) => <li key={i}>{w}</li>)}</ul><br /></>
          )}
          {(rn.known_limitations || []).length > 0 && (
            <><strong className="text-tx">Known Limitations:</strong>
            <ul className="list-disc ml-4 mt-1">{rn.known_limitations.map((w, i) => <li key={i}>{w}</li>)}</ul></>
          )}
        </div>
      </Card>
      <Card className="animate-fade-up-1">
        <Label>🌐 GTM Landing Page</Label>
        <div className="p-4 bg-lg-sf2 rounded-lg">
          <div className="text-base font-extrabold text-tx text-center">{s.gtm.h}</div>
          <div className="text-sm text-tx-4 mt-1 italic text-center">{s.gtm.t}</div>
          {s.gtm.benefits.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-bold text-tx-2 mb-1">Key Benefits</div>
              {s.gtm.benefits.map((b, i) => <div key={i} className="text-sm text-tx-3 py-0.5">✦ {b}</div>)}
            </div>
          )}
          {s.gtm.trust?.bullets?.length > 0 && (
            <div className="mt-2 p-2 bg-lg-sf3 rounded-md">
              <div className="text-xs font-bold text-tx-2 mb-0.5">{s.gtm.trust.headline || "Trust & Safety"}</div>
              {s.gtm.trust.bullets.map((b, i) => <div key={i} className="text-xs text-tx-4">🔒 {b}</div>)}
            </div>
          )}
        </div>
      </Card>
      <Card className="animate-fade-up-2">
        <Label>📊 Pitch Deck ({slides.length} slides)</Label>
        {slides.length > 0 ? (
          <div className="space-y-1.5">
            {slides.map((sl) => (
              <div key={sl.id} className="p-2 bg-lg-sf2 rounded-lg">
                <div className="text-sm font-bold text-tx">Slide {sl.id}: {sl.title}</div>
                <div className="text-xs text-tx-3 mt-0.5">{sl.objective}</div>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {(sl.key_points || []).slice(0, 2).map((p, i) => <Badge key={i} color="bl" size="xs">{typeof p === "string" ? p.slice(0, 60) : p}...</Badge>)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-tx-2">7-slide outline: Problem → Solution → Architecture → Risk Mitigation → GTM → Roadmap → Ask</div>
        )}
      </Card>
    </div>
  );
}

/* ── Regulation ── */
const OWASP_LOOKUP = {
  LLM01: "LLM01 — Prompt Injection", LLM02: "LLM02 — Insecure Output",
  LLM03: "LLM03 — Training Data Poisoning", LLM04: "LLM04 — Model DoS",
  LLM05: "LLM05 — Supply Chain", LLM06: "LLM06 — Sensitive Info Disclosure",
  LLM07: "LLM07 — Insecure Plugin", LLM08: "LLM08 — Excessive Agency",
  LLM09: "LLM09 — Overreliance", LLM10: "LLM10 — Model Theft",
};

const NIST_LOOKUP = {
  "GOVERN": "Policies & accountability", "MAP": "Context & stakeholder impact",
  "MEASURE": "Risk assessment", "MANAGE": "Risk treatment & monitoring",
};

function RegulationTab({ s }) {
  return (
    <div className="space-y-3.5">
      {/* EU AI Act */}
      <Card className="animate-fade-up">
        <Label>🏛 EU AI Act Classification</Label>
        <div className="flex items-center gap-3">
          <div className={`px-5 py-3 rounded-lg text-center border ${s.euTier === "High-Risk" ? "bg-accent-red/8 border-accent-red/20" : s.euTier === "Limited" ? "bg-accent-orange/8 border-accent-orange/20" : "bg-accent-green/8 border-accent-green/20"}`}>
            <div className={`text-lg font-extrabold ${s.euTier === "High-Risk" ? "text-accent-red" : s.euTier === "Limited" ? "text-accent-orange" : "text-accent-green"}`}>{s.euTier}</div>
            <div className="text-sm text-tx-3 mt-0.5">EU AI Act Risk Tier</div>
          </div>
          <div className="flex-1 text-sm text-tx-2 leading-relaxed">
            {s.euTier === "High-Risk"
              ? "Full conformity assessment required. Risk management system (Art. 9), data governance (Art. 10), transparency (Art. 13), human oversight (Art. 14), and accuracy/robustness (Art. 15) all apply."
              : s.euTier === "Limited"
                ? "Transparency obligations apply (Art. 50). Users must be informed they are interacting with AI."
                : "Standard analysis with best-practice recommendations."}
          </div>
        </div>
      </Card>

      {/* OWASP */}
      <Card className="animate-fade-up-1">
        <Label>🔐 OWASP Top 10 LLM — Triggered Vulnerabilities</Label>
        <div className="space-y-1">
          {s.owasp.map((id, i) => (
            <div key={i} className="p-2 bg-lg-sf2 rounded-lg flex justify-between items-center">
              <div className="text-sm font-semibold text-tx">{OWASP_LOOKUP[id] || id}</div>
              <Badge color="rd" size="xs">Triggered</Badge>
            </div>
          ))}
          {s.owasp.length === 0 && <div className="text-sm text-tx-3 py-2">No OWASP vulnerabilities triggered.</div>}
        </div>
      </Card>

      {/* NIST */}
      <Card className="animate-fade-up-2">
        <Label>📋 NIST AI RMF Mapping</Label>
        <div className="space-y-1">
          {s.nist.map((id, i) => {
            const prefix = id.split("-")[0];
            return (
              <div key={i} className="p-2 bg-lg-sf2 rounded-lg">
                <div className="text-sm font-semibold text-tx">{id}: {NIST_LOOKUP[prefix] || "AI Risk Management"}</div>
                <Badge color="gn" size="xs" className="mt-1">Mapped</Badge>
              </div>
            );
          })}
          {s.nist.length === 0 && <div className="text-sm text-tx-3 py-2">No NIST mappings.</div>}
        </div>
      </Card>

      {/* Risk-Framework Crosswalk */}
      <Card className="animate-fade-up-3">
        <Label>📊 Risk-to-Framework Crosswalk</Label>
        <div className="space-y-1">
          {s.risks.map((r, i) => (
            <div key={i} className="p-2 bg-lg-sf2 rounded-lg flex justify-between items-center">
              <div>
                <div className="text-sm font-semibold text-tx">{r.id}: {r.n}</div>
                <div className="text-xs text-tx-4">{r.cat} · {r.s}</div>
              </div>
              <div className="flex gap-1">
                {r.cat === "Privacy" && <Badge color="pk" size="xs">GDPR</Badge>}
                {r.cat === "Security" && <Badge color="rd" size="xs">OWASP</Badge>}
                {r.cat === "Safety" && <Badge color="or" size="xs">EU AI Act</Badge>}
                {r.cat === "UX/Business" && <Badge color="bl" size="xs">NIST</Badge>}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ── Governance ── */
function GovernanceTab({ s, st, sessionId, signoffs, setSignoffs, gatesList, gateResult, setGateResult, integrations, setIntegrations }) {
  const [signingRole, setSigningRole] = useState(null);
  const [savingIntegrations, setSavingIntegrations] = useState(false);
  const [integrationMsg, setIntegrationMsg] = useState("");

  const ROLES = ["pm", "qa", "legal", "security"];
  const ROLE_LABELS = { pm: "Product Manager", qa: "QA Lead", legal: "Legal / Compliance", security: "Security" };

  async function handleSignoff(role) {
    setSigningRole(role);
    try {
      await governance.signoff(sessionId, { role, status: "approved" });
      const fresh = await governance.signoffs(sessionId);
      setSignoffs(fresh?.sign_offs || (Array.isArray(fresh) ? fresh : []));
    } catch { /* silent */ } finally { setSigningRole(null); }
  }

  async function handleEvaluate(gateId) {
    try {
      const res = await gatesAPI.evaluate(gateId, sessionId);
      setGateResult(res);
    } catch { /* silent */ }
  }

  function updateIntegration(field, value) {
    setIntegrations((current) => ({ ...current, [field]: value }));
  }

  async function saveIntegrations() {
    const payload = { ...(integrations || {}) };
    payload.github_pr = payload.github_pr === "" ? null : Number(payload.github_pr);
    if (Number.isNaN(payload.github_pr)) {
      payload.github_pr = null;
    }
    setSavingIntegrations(true);
    setIntegrationMsg("");
    try {
      const res = await sessionsAPI.saveIntegrations(sessionId, payload);
      setIntegrations({ ...EMPTY_INTEGRATIONS, ...(res.integrations || {}) });
      setIntegrationMsg("Integration settings saved.");
    } catch (err) {
      setIntegrationMsg(err.message || "Failed to save integration settings.");
    } finally {
      setSavingIntegrations(false);
    }
  }

  const approvedRoles = (signoffs || []).filter((so) => so.status === "approved").map((so) => so.role);

  return (
    <div className="space-y-3.5">
      {/* Sign-offs */}
      <Card className="animate-fade-up">
        <Label>✍️ Role-Based Sign-offs</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ROLES.map((role) => {
            const so = (signoffs || []).find((x) => x.role === role);
            const approved = so?.status === "approved";
            return (
              <div key={role} className={`p-2.5 bg-lg-sf2 rounded-lg border ${approved ? "border-accent-green/20" : "border-accent-orange/20"}`}>
                <div className="flex justify-between items-center">
                  <div className="text-sm font-bold text-tx">{ROLE_LABELS[role] || role}</div>
                  <Badge color={approved ? "gn" : "or"} size="xs">
                    {approved ? "✓ Approved" : "⏳ Pending"}
                  </Badge>
                </div>
                {(so?.signed_by || so?.user_email) && <div className="text-xs text-tx-3 mt-1">{so.signed_by || so.user_email} · {so.signed_at ? new Date(so.signed_at).toLocaleDateString() : ""}</div>}
                {!approved && (
                  <Button variant="primary" size="xs" className="mt-2 w-full" onClick={() => handleSignoff(role)} disabled={signingRole === role}>
                    {signingRole === role ? "Signing…" : "Sign Off"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Gate Evaluation */}
      <Card className="animate-fade-up-1">
        <Label>🚦 Gate Evaluation</Label>
        {gatesList.length === 0 && !gateResult ? (
          <div className="text-sm text-tx-3 py-2">No gates configured. Create one in Settings → Gates.</div>
        ) : (
          <>
            {gatesList.map((g) => (
              <div key={g.id} className="flex justify-between items-center p-2 bg-lg-sf2 rounded-lg mb-1.5">
                <div>
                  <div className="text-sm font-bold text-tx">{g.name || "Gate"}</div>
                  <div className="text-xs text-tx-3">Min score: {g.min_score} · Required sign-offs: {g.required_signoffs}</div>
                </div>
                <Button variant="primary" size="xs" onClick={() => handleEvaluate(g.id)}>Evaluate</Button>
              </div>
            ))}
            {gateResult && (
              <div className={`mt-2 p-3 rounded-lg ${gateResult.passed ? "bg-accent-green/8 border border-accent-green/25" : "bg-accent-red/8 border border-accent-red/25"}`}>
                <div className={`text-base font-extrabold ${gateResult.passed ? "text-accent-green" : "text-accent-red"}`}>{gateResult.passed ? "PASS" : "FAIL"}</div>
                <div className="text-xs text-tx mt-1">Score: {st.score} · Approved sign-offs: {approvedRoles.length}</div>
                {gateResult.missing_signoffs?.length > 0 && <div className="text-sm text-tx-3 mt-1">Missing sign-offs: {gateResult.missing_signoffs.join(", ")}</div>}
                {gateResult.missing_frameworks?.length > 0 && <div className="text-sm text-tx-3 mt-1">Missing frameworks: {gateResult.missing_frameworks.join(", ")}</div>}
              </div>
            )}
          </>
        )}
      </Card>

      {/* Compliance Certificate */}
      <Card className="animate-fade-up-2">
        <Label>🔌 Integrations</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <input value={integrations.slack_webhook || ""} onChange={(e) => updateIntegration("slack_webhook", e.target.value)} placeholder="Slack webhook URL" className="input-glass text-sm" />
          <input value={integrations.jira_url || ""} onChange={(e) => updateIntegration("jira_url", e.target.value)} placeholder="Jira base URL" className="input-glass text-sm" />
          <input value={integrations.jira_project || ""} onChange={(e) => updateIntegration("jira_project", e.target.value)} placeholder="Jira project key" className="input-glass text-sm" />
          <input value={integrations.jira_token || ""} onChange={(e) => updateIntegration("jira_token", e.target.value)} placeholder="Jira API token" className="input-glass text-sm" />
          <input value={integrations.github_repo || ""} onChange={(e) => updateIntegration("github_repo", e.target.value)} placeholder="GitHub repo (owner/repo)" className="input-glass text-sm" />
          <input value={integrations.github_pr || ""} onChange={(e) => updateIntegration("github_pr", e.target.value)} placeholder="GitHub PR number" className="input-glass text-sm" />
          <input value={integrations.github_token || ""} onChange={(e) => updateIntegration("github_token", e.target.value)} placeholder="GitHub token" className="input-glass text-sm" />
          <input value={integrations.linear_team_id || ""} onChange={(e) => updateIntegration("linear_team_id", e.target.value)} placeholder="Linear team ID" className="input-glass text-sm" />
          <input value={integrations.linear_token || ""} onChange={(e) => updateIntegration("linear_token", e.target.value)} placeholder="Linear token" className="input-glass text-sm sm:col-span-2" />
        </div>
        <div className="flex items-center justify-between mt-2.5 gap-2">
          <div className="text-xs text-tx-3">Saved settings are reused when this session is reloaded or re-opened.</div>
          <Button variant="primary" size="sm" onClick={saveIntegrations} disabled={savingIntegrations}>{savingIntegrations ? "Saving..." : "Save Integrations"}</Button>
        </div>
        {integrationMsg && <div className="text-sm text-tx-3 mt-2">{integrationMsg}</div>}
      </Card>

      <Card className="animate-fade-up-3">
        <Label>📜 Compliance Certificate</Label>
        <div className="p-3.5 bg-lg-sf2 rounded-lg text-center">
          <div className="text-base font-bold text-tx">Generate Auditor-Ready Certificate</div>
          <div className="text-sm text-tx-3 mt-1">Includes: analysis summary, risk assessment, regulation mappings, sign-offs, timestamps.</div>
          <div className="flex justify-center gap-1.5 mt-2.5">
            <Button variant="primary" size="sm" onClick={async () => { try { const cert = await exportsAPI.certificate(sessionId); if (cert.html) { const blob = new Blob([cert.html], { type: "text/html" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `releaseops-certificate-${sessionId.slice(0,8)}.html`; a.click(); URL.revokeObjectURL(url); } setActionMsg(`Certificate ${cert.certificate_id?.slice(0,8)} issued — ${cert.readiness_score ?? 0}/100, Grade ${cert.grade ?? "?"}, ${cert.decision ?? "N/A"}.`); } catch (e) { setActionMsg(e.message || "Certificate generation failed."); } }}>📜 Download Certificate (HTML)</Button>
            <Button variant="ghost" size="sm" onClick={async () => { try { const cert = await exportsAPI.certificate(sessionId); const { html, ...jsonCert } = cert; const blob = new Blob([JSON.stringify(jsonCert, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `releaseops-certificate-${sessionId.slice(0,8)}.json`; a.click(); URL.revokeObjectURL(url); setActionMsg("JSON certificate downloaded."); } catch (e) { setActionMsg(e.message || "Certificate generation failed."); } }}>📋 JSON</Button>
          </div>
        </div>
      </Card>

      {/* Audit Trail */}
      <Card className="animate-fade-up-4">
        <Label>🔒 Audit Trail</Label>
        {[
          { a: "Session created", t: s.date, u: "system" },
          { a: "Pipeline completed", t: s.date, u: "analysis-svc" },
          ...(signoffs || []).filter((so) => so.status === "approved").map((so) => ({ a: `${so.role} sign-off: approved`, t: so.signed_at ? new Date(so.signed_at).toLocaleDateString() : s.date, u: so.signed_by || so.user_email || "user" })),
        ].map((e, i) => (
          <div key={i} className="flex justify-between py-1.5 border-b border-lg-bd text-sm">
            <span className="text-tx-2">{e.a}</span>
            <span className="text-tx-4 font-mono">{e.u} · {e.t}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}
