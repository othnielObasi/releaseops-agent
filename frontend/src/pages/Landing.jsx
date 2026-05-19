/* ReleaseOps v3 — Landing Page (Tailwind) */

import { useState } from "react";
import { Badge, Card, Button, CircularScore } from "../components/ui";
import { REG_FRAMEWORKS } from "../data/regulations";
import Pipeline from "../components/Pipeline";

/* ── Playground demo data ── */
const DEMO_FEATURE = {
  title: "AI-Powered Customer Support Reply Suggester",
  desc: "An LLM-based feature that reads incoming support tickets and suggests draft replies for agents. Agents can edit and send. Trained on historical ticket data.",
};

const DEMO_RESULT = {
  score: 62,
  risks: [
    { id: "R1", name: "PII leakage in suggested replies", severity: "High", cat: "Privacy" },
    { id: "R2", name: "Hallucinated policy references", severity: "High", cat: "Safety" },
    { id: "R3", name: "Biased tone across demographics", severity: "Medium", cat: "Fairness" },
    { id: "R4", name: "Over-reliance — agents skip review", severity: "Medium", cat: "Operational" },
  ],
  artefacts: [
    { name: "Release Spec", status: "generated" },
    { name: "Risk Register", status: "generated" },
    { name: "Test Plan", status: "generated" },
    { name: "Release Notes", status: "generated" },
    { name: "GTM Page", status: "generated" },
    { name: "Pitch Deck", status: "generated" },
  ],
  frameworks: ["EU AI Act", "OWASP Top 10", "NIST AI RMF", "GDPR"],
  tests: 12,
  guardrails: 6,
};

/* ── Playground Demo Component ── */
function PlaygroundDemo({ onLogin }) {
  const [stage, setStage] = useState("idle"); // idle | running | done
  const [phase, setPhase] = useState(-1);

  const runDemo = () => {
    if (stage === "running") return;
    setStage("running");
    setPhase(0);
    setTimeout(() => setPhase(1), 2400);
    setTimeout(() => setPhase(2), 4200);
    setTimeout(() => { setPhase(3); setStage("done"); }, 5800);
  };

  const reset = () => { setStage("idle"); setPhase(-1); };

  const SEV_COLOR = { High: "text-accent-red", Medium: "text-accent-orange" };

  return (
    <section className="mt-14">
      <h2 className="text-xl font-bold text-tx mb-2">Try It — Watch the Agents Run</h2>
      <p className="text-[13px] text-tx-2 leading-relaxed mb-5">
        Click run to watch Navigator → Sentinel → Herald analyse a sample AI feature in real time. This is the actual multi-agent pipeline — not a simulation.
      </p>

      <Card className="!p-0 overflow-hidden">
        {/* Input preview */}
        <div className="p-4 border-b border-lg-bd">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] text-tx-3 font-semibold tracking-wide uppercase">Sample Feature</div>
            {stage === "done" && (
              <button onClick={reset} className="text-[10px] text-tx-3 hover:text-tx transition-colors cursor-pointer bg-transparent border-none">
                Reset
              </button>
            )}
          </div>
          <div className="text-[13px] font-semibold text-tx">{DEMO_FEATURE.title}</div>
          <div className="text-[11px] text-tx-2 mt-1 leading-relaxed">{DEMO_FEATURE.desc}</div>
        </div>

        {/* Pipeline visualization */}
        {stage !== "idle" && (
          <div className="px-4 py-3 border-b border-lg-bd bg-lg-bg2/50">
            <Pipeline phase={phase} showLogs={true} />
          </div>
        )}

        {/* Results preview */}
        {stage === "done" && (
          <div className="p-4 space-y-4 animate-fade-up">
            {/* Score + stats row */}
            <div className="flex items-center gap-5">
              <CircularScore value={DEMO_RESULT.score} size={64} />
              <div className="flex-1 grid grid-cols-3 gap-3">
                <div>
                  <div className="text-lg font-extrabold text-tx">{DEMO_RESULT.risks.length}</div>
                  <div className="text-[10px] text-tx-3">Risks found</div>
                </div>
                <div>
                  <div className="text-lg font-extrabold text-tx">{DEMO_RESULT.tests}</div>
                  <div className="text-[10px] text-tx-3">Test cases</div>
                </div>
                <div>
                  <div className="text-lg font-extrabold text-tx">{DEMO_RESULT.guardrails}</div>
                  <div className="text-[10px] text-tx-3">Guardrails</div>
                </div>
              </div>
            </div>

            {/* Top risks */}
            <div>
              <div className="text-[10px] text-tx-3 font-semibold tracking-wide uppercase mb-2">Top Risks Identified</div>
              <div className="space-y-1.5">
                {DEMO_RESULT.risks.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-[11px] py-1.5 px-3 bg-lg-bg2 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-tx-4 font-mono text-[10px]">{r.id}</span>
                      <span className="text-tx">{r.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-tx-3 text-[10px]">{r.cat}</span>
                      <span className={`font-semibold text-[10px] ${SEV_COLOR[r.severity]}`}>{r.severity}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Artefacts + frameworks */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] text-tx-3 font-semibold tracking-wide uppercase mb-2">Artefacts Generated</div>
                <div className="space-y-1">
                  {DEMO_RESULT.artefacts.map((a) => (
                    <div key={a.name} className="flex items-center gap-2 text-[11px]">
                      <span className="text-accent-green text-[10px]">✓</span>
                      <span className="text-tx">{a.name}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-tx-3 font-semibold tracking-wide uppercase mb-2">Frameworks Mapped</div>
                <div className="space-y-1">
                  {DEMO_RESULT.frameworks.map((f) => (
                    <div key={f} className="flex items-center gap-2 text-[11px]">
                      <span className="text-accent-purple text-[10px]">✓</span>
                      <span className="text-tx">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Blurred tease + CTA */}
            <div className="relative">
              <div className="h-16 bg-lg-bg2 rounded-lg opacity-40 blur-[2px]" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Button variant="cta" size="md" onClick={onLogin}>Sign up for full results</Button>
              </div>
            </div>
          </div>
        )}

        {/* Run button */}
        {stage === "idle" && (
          <div className="p-4">
            <Button variant="cta" size="lg" onClick={runDemo} className="w-full">
              Run Readiness Check
            </Button>
          </div>
        )}
      </Card>
    </section>
  );
}

export default function Landing({ onLogin }) {
  return (
    <div className="max-w-3xl mx-auto">

      {/* ── Hero ── */}
      <section className="relative text-center pt-16 pb-10 md:pt-20 animate-fade-up overflow-hidden">
        {/* Hero glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-hero-glow pointer-events-none" />
        <div className="orb w-32 h-32 bg-accent-purple/10 top-10 right-0 animate-float" />
        <div className="orb w-24 h-24 bg-accent-blue/8 top-20 left-0 animate-float" style={{ animationDelay: "2s" }} />

        <div className="relative">
          <Badge color="pr" size="lg" className="tracking-widest">✦ AI RELEASE GOVERNANCE PLATFORM</Badge>

          <h1 className="text-4xl md:text-5xl font-extrabold text-tx mt-5 leading-[1.08] tracking-tight text-balance">
            Is your AI feature<br />
            <span className="text-gradient">actually ready to ship?</span>
          </h1>

          <p className="text-[15px] text-tx-2 mt-5 leading-relaxed max-w-xl mx-auto text-balance">
            Most AI features fail in production — not because the idea was wrong, but because no one did the hard work of thinking through{" "}
            <em className="text-tx font-medium not-italic">spec, risks, tests,</em> and <em className="text-tx font-medium not-italic">launch copy</em> before shipping. ReleaseOps does it all in under 60 seconds.
          </p>

          {/* Stats */}
          <div className="flex justify-center gap-3 mt-8">
            {[{ v: "3", l: "AI AGENTS" }, { v: "<60s", l: "END TO END" }, { v: "7", l: "FRAMEWORKS" }, { v: "0", l: "MANUAL DOCS" }].map((s, i) => (
              <div key={i} className={`card-glow !p-3 !px-5 text-center animate-fade-up-${i + 1}`}>
                <div className="text-xl font-extrabold text-tx">{s.v}</div>
                <div className="text-[8px] text-tx-4 tracking-[0.15em] mt-0.5 font-semibold">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── The Problem ── */}
      <section className="mt-16 animate-fade-up-2">
        <h2 className="text-xl font-bold text-tx mb-2">Why single-prompt AI fails at release governance</h2>
        <p className="text-[13px] text-tx-2 leading-relaxed mb-5">
          Pasting into ChatGPT, Claude, or Gemini gives you a one-off opinion — a different answer every time, no regulation citations, and no audit trail. That's not governance. These are the gaps a single LLM can never close:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { c: "bg-accent-red", title: "No structured spec", desc: "Feature descriptions live in Slack threads and half-finished Notion docs.", quote: '"What exactly are we shipping again?"' },
            { c: "bg-accent-orange", title: "Blind spots in risk", desc: "Safety, legal, and operational risks are overlooked until production.", quote: '"We didn\'t think about that edge case."' },
            { c: "bg-accent-red", title: "Shallow test coverage", desc: "Happy-path tests pass; adversarial inputs and bias edge cases are never written.", quote: '"Tests passed, but it still broke in prod."' },
            { c: "bg-accent-orange", title: "Launch docs written last", desc: "Release notes and pitch decks are rushed, inconsistent, and disconnected from what engineering built.", quote: '"Can someone write the changelog by EOD?"' },
            { c: "bg-accent-red", title: "LLM chat ≠ governance", desc: "Pasting into ChatGPT, Claude, or Gemini gives a different answer every time, cites no real regulations, and disappears when you close the tab.", quote: '"I asked GPT — it said we\'re fine."' },
          ].map((p, i) => (
            <Card key={i} className="!p-4 group">
              <div className={`w-2 h-2 rounded-full ${p.c} mb-3`} />
              <div className="text-[13px] font-bold text-tx">{p.title}</div>
              <div className="text-[11px] text-tx-2 mt-1 leading-relaxed">{p.desc}</div>
              <div className="mt-3 px-3 py-1.5 bg-accent-red/8 border-l-2 border-accent-red rounded-r text-[10px] text-accent-red2 italic">{p.quote}</div>
            </Card>
          ))}
        </div>
      </section>

      {/* ── The Solution ── */}
      <section className="mt-16 animate-fade-up-3">
        <h2 className="text-xl font-bold text-tx mb-3">The Agentic Pipeline — Three specialised AI agents</h2>
        <p className="text-[13px] text-tx-2 leading-relaxed mb-6">
          ReleaseOps isn't a single LLM prompt. It's a <strong className="text-tx">multi-agent orchestration engine</strong> — three purpose-built AI agents that run in sequence, each handing verified output to the next. Provider-agnostic across OpenAI and Anthropic with automatic failover.
        </p>
        <div className="space-y-2">
          {[
            { num: "1", name: "Navigator", sub: "Specification Agent", c: "accent-green", bc: "border-accent-green", bg: "bg-accent-green", desc: "Parses your feature description and generates a structured release spec — personas, user stories, acceptance criteria, success metrics, risk register, and a readiness checklist. Hands the full spec to Sentinel." },
            { num: "2", name: "Sentinel", sub: "Risk & Testing Agent", c: "accent-purple2", bc: "border-accent-purple2", bg: "bg-accent-purple", desc: "Receives the spec and performs adversarial analysis — safety, security, privacy, bias, and operational risks scored by severity. Generates edge-case test plans, guardrail rules, and maps every finding to real regulation articles. Hands to Herald." },
            { num: "3", name: "Herald", sub: "Launch Docs Agent", c: "accent-orange2", bc: "border-accent-orange2", bg: "bg-accent-orange", desc: "Takes the spec and risk analysis and produces release notes, a GTM landing page with trust & safety copy, and a stakeholder pitch deck — all traceable back to the original findings." },
          ].map((a, i) => (
            <div key={i}>
              <Card className={`!p-4 !border-l-[3px] ${a.bc}`}>
                <div className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full ${a.bg} flex items-center justify-center text-[11px] font-bold text-lg-bg shrink-0`}>{a.num}</span>
                  <span className={`text-sm font-bold text-${a.c}`}>{a.name} — {a.sub}</span>
                </div>
                <div className="text-[11px] text-tx-2 mt-2 leading-relaxed ml-9">{a.desc}</div>
              </Card>
              {i < 2 && <div className="text-center py-1 text-sm text-tx-4">↓</div>}
            </div>
          ))}
        </div>
      </section>

      {/* ── What a single run produces ── */}
      <section className="mt-14 animate-fade-up-4">
        <h2 className="text-xl font-bold text-tx mb-5">What one pipeline run produces</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { c: "border-accent-green", t: "Structured Release Spec", d: "Problem, personas, stories, metrics, roadmap" },
            { c: "border-accent-red", t: "Full Risk Register", d: "Categorised risks with severity, likelihood, mitigations" },
            { c: "border-accent-purple", t: "Test Plan + Guardrails", d: "Edge-case, adversarial, and bias test coverage" },
            { c: "border-accent-blue", t: "Release Notes", d: "Versioned, audience-appropriate changelog" },
            { c: "border-accent-teal", t: "GTM Landing Page", d: "Launch copy with trust & safety section" },
            { c: "border-accent-orange", t: "Pitch Deck Outline", d: "Slide-by-slide with speaker notes" },
          ].map((a, i) => (
            <Card key={i} className={`!p-3 !border-l-2 ${a.c}`}>
              <div className="text-xs font-bold text-tx">{a.t}</div>
              <div className="text-[10px] text-tx-3 mt-1 leading-snug">{a.d}</div>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Live Regulation Engine ── */}
      <section className="mt-14 animate-fade-up-5">
        <h2 className="text-xl font-bold text-tx mb-2">Live Regulation Engine</h2>
        <p className="text-[13px] text-tx-2 leading-relaxed mb-4">
          Every risk is automatically mapped to <strong className="text-tx">seven regulatory frameworks</strong> in real time — EU AI Act, OWASP Top 10 for LLMs, NIST AI RMF, ISO 42001, GDPR, SOC 2, and HIPAA.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {REG_FRAMEWORKS.slice(0, 4).map((f, i) => (
            <Card key={i} className="!p-3 !border-t-2 !border-t-accent-purple">
              <div className="text-xs font-bold text-tx">{f.name}</div>
              <div className="text-[10px] text-tx-3 mt-0.5">{f.reqs} requirements</div>
              <Badge color="gn" size="xs" className="mt-2">{f.status}</Badge>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {REG_FRAMEWORKS.slice(4, 7).map((f, i) => (
            <Card key={i} className="!p-3 !border-t-2 !border-t-accent-teal">
              <div className="text-xs font-bold text-tx">{f.name}</div>
              <div className="text-[10px] text-tx-3 mt-0.5">{f.reqs} requirements</div>
              <Badge color="gn" size="xs" className="mt-2">{f.status}</Badge>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Enforceable Governance ── */}
      <section className="mt-14">
        <h2 className="text-xl font-bold text-tx mb-2">Enforceable Governance</h2>
        <p className="text-[13px] text-tx-2 leading-relaxed mb-4">
          ReleaseOps doesn't just flag risks — it <strong className="text-tx">enforces your release process</strong> with gates, approvals, monitoring, and auditor-ready certificates.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { t: "CI/CD Gates", d: "Block releases below score threshold", c: "border-accent-green" },
            { t: "Role Sign-offs", d: "PM, Legal, QA, Security must approve", c: "border-accent-purple" },
            { t: "Compliance Certs", d: "Auditor-ready PDF with signatures", c: "border-accent-blue" },
            { t: "Drift Monitor", d: "Re-scan deployed features weekly", c: "border-accent-teal" },
            { t: "Risk Trends", d: "Track posture across all features", c: "border-accent-orange" },
            { t: "Session Compare", d: "v1 vs v2 side-by-side diff", c: "border-accent-purple" },
          ].map((f, i) => (
            <Card key={i} className={`!p-3 !border-l-2 ${f.c}`}>
              <div className="text-xs font-bold text-tx">{f.t}</div>
              <div className="text-[10px] text-tx-3 mt-0.5">{f.d}</div>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Why Not Just Use ChatGPT? ── */}
      <section className="mt-14">
        <h2 className="text-xl font-bold text-tx mb-2">"Can't I just use ChatGPT, Claude, or Gemini?"</h2>
        <p className="text-[13px] text-tx-2 leading-relaxed mb-5">
          A single-prompt LLM gives you a <em>conversation</em> about risks. ReleaseOps gives you an <em>agentic system</em> — three specialised AI agents orchestrating in sequence, with provider failover, persistent state, and auditable output. Here's what that means in practice:
        </p>

        {/* Comparison table */}
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="text-left border-b border-lg-bd">
                <th className="py-2 pr-3 text-tx-3 font-semibold w-[40%]"></th>
                <th className="py-2 px-3 text-tx-4 font-semibold text-left">Generic LLMs</th>
                <th className="py-2 pl-3 text-accent-green font-semibold text-left">ReleaseOps</th>
              </tr>
            </thead>
            <tbody className="text-tx-2">
              {[
                ["Consistent output structure", "❌ Different every prompt", "✅ Same pipeline, every time"],
                ["Regulatory framework mapping", "❌ Guesses — no source articles", "✅ 7 frameworks, specific articles"],
                ["Risk severity scoring", "❌ Subjective, no scale", "✅ Quantified (1–5) with heatmap"],
                ["Adversarial test generation", "❌ Happy-path only", "✅ Edge-case, bias & abuse tests"],
                ["Compliance certificates", "❌ A chat transcript", "✅ Auditor-ready PDF artefacts"],
                ["CI/CD gate integration", "❌ Not possible", "✅ Block deploys below threshold"],
                ["Role-based sign-offs", "❌ Not possible", "✅ PM, Legal, QA, Security gates"],
                ["Drift monitoring", "❌ Conversation forgotten", "✅ Weekly re-scans, trend tracking"],
                ["Session history & compare", "❌ Lost when tab closes", "✅ v1 → v2 side-by-side diff"],
                ["Team-wide audit trail", "❌ Single-user chat", "✅ Shared dashboard, full log"],
              ].map(([feature, chatgpt, lg], i) => (
                <tr key={i} className="border-b border-lg-bd/30 hover:bg-lg-sf/50 transition-colors">
                  <td className="py-2 pr-3 font-medium text-tx">{feature}</td>
                  <td className="py-2 px-3 text-left text-accent-red2">{chatgpt}</td>
                  <td className="py-2 pl-3 text-left text-accent-green">{lg}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Card className="!p-4 !border-l-[3px] !border-accent-purple mt-5">
          <div className="text-[12px] text-tx leading-relaxed">
            <strong>Architectural difference:</strong> ReleaseOps is a <em>multi-agent orchestration engine</em> — Navigator builds the spec, Sentinel stress-tests it, Herald writes the launch docs. Each agent's output is verified before handoff. Provider-agnostic across OpenAI and Anthropic with automatic failover. This is purpose-built AI governance infrastructure, not a chatbot wrapper.
          </div>
        </Card>
      </section>

      {/* ── Architecture — Why This Matters ── */}
      <section className="mt-14">
        <h2 className="text-xl font-bold text-tx mb-2">Under the Hood — Platform Architecture</h2>
        <p className="text-[13px] text-tx-2 leading-relaxed mb-5">
          This isn't a thin LLM wrapper. ReleaseOps is a vertically-integrated agentic AI platform built for enterprise AI governance.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { t: "Multi-Agent Orchestration", d: "Three specialised AI agents (Navigator → Sentinel → Herald) execute in sequence. Each validates its output schema before handing off to the next.", c: "border-accent-purple" },
            { t: "Provider-Agnostic LLM Layer", d: "Runs on OpenAI (GPT-4o) and Anthropic (Claude) with automatic failover. No single-vendor lock-in. Configurable per-agent.", c: "border-accent-blue" },
            { t: "Real-Time Regulation Engine", d: "7 regulatory frameworks (EU AI Act, OWASP, NIST, ISO 42001, GDPR, SOC 2, HIPAA) mapped automatically — not hallucinated, cited by article.", c: "border-accent-green" },
            { t: "Persistent Governance State", d: "Every session, score, sign-off, and compliance certificate is stored, versioned, and diffable. Full audit trail across your entire AI portfolio.", c: "border-accent-orange" },
            { t: "CI/CD Integration Layer", d: "API keys, webhook endpoints, and release gates that block deploys below your score threshold. Plugs into GitHub, Linear, Jira, Slack, Confluence, Notion.", c: "border-accent-teal" },
            { t: "Multi-Tenant Isolation", d: "Strict per-user data isolation, JWT auth, role-based access control. Enterprise-ready from day one.", c: "border-accent-red" },
          ].map((a, i) => (
            <Card key={i} className={`!p-4 !border-l-2 ${a.c}`}>
              <div className="text-xs font-bold text-tx">{a.t}</div>
              <div className="text-[10px] text-tx-3 mt-1 leading-snug">{a.d}</div>
            </Card>
          ))}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="mt-14">
        <h2 className="text-xl font-bold text-tx mb-5">How It Works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { step: "1", title: "Describe your feature", desc: "Paste a one-paragraph feature description — that's it. No templates, no forms.", c: "border-accent-green", tc: "text-accent-green" },
            { step: "2", title: "Watch three agents work", desc: "Navigator specs it, Sentinel stress-tests it, Herald writes launch docs — all in under 60 seconds with live progress logs.", c: "border-accent-purple2", tc: "text-accent-purple2" },
            { step: "3", title: "Ship with confidence", desc: "Export compliance certificates, share with stakeholders, and integrate with your CI/CD pipeline.", c: "border-accent-orange2", tc: "text-accent-orange2" },
          ].map((s, i) => (
            <Card key={i} className={`!p-5 !border-t-[3px] ${s.c}`}>
              <div className={`text-3xl font-extrabold ${s.tc} mb-2`}>{s.step}</div>
              <div className="text-[13px] font-bold text-tx">{s.title}</div>
              <div className="text-[11px] text-tx-2 mt-2 leading-relaxed">{s.desc}</div>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Interactive Playground ── */}
      <PlaygroundDemo onLogin={onLogin} />

      {/* ── CTA ── */}
      <section className="relative text-center py-16 overflow-hidden">
        {/* CTA glow */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-[200px] bg-gradient-radial from-accent-purple/10 via-transparent to-transparent pointer-events-none" />

        <div className="relative">
          <div className="text-2xl md:text-3xl font-extrabold text-tx text-balance">Ready to ship with confidence?</div>
          <p className="text-[13px] text-tx-2 mt-3 text-balance">Describe your feature and get a production-ready analysis — spec, risks, tests, regulation mapping, and launch docs — in under 60 seconds.</p>
          <Button variant="cta" size="lg" onClick={onLogin} className="mt-5 animate-glow-pulse">✦ Try It Now</Button>
        </div>
      </section>
    </div>
  );
}
