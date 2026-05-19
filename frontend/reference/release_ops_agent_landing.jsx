import React, { useMemo, useState } from "react";

const PAGES = ["Landing", "Product", "Guide", "Dashboard", "New Check", "Session Detail", "Settings"];
const SESSION_TABS = ["Overview", "Spec & Risks", "Tests & Guardrails", "Docs & Launch", "Regulation", "Governance"];
const SETTINGS_TABS = ["Profile", "Team", "API Keys", "Integrations", "Gates"];
const FRAMEWORKS = ["EU AI Act", "OWASP Top 10 LLM", "NIST AI RMF", "ISO 42001", "GDPR", "SOC 2", "HIPAA"];

export const UI_TEST_CASES = [
  { page: "Landing", expected: "default page renders first" },
  { page: "Product", expected: "product explanation renders" },
  { page: "Guide", expected: "quick-start guide renders" },
  { page: "Dashboard", expected: "authenticated dashboard renders" },
  { page: "New Check", expected: "new review intake form renders" },
  { page: "Session Detail", expected: "session workspace tabs render" },
  { page: "Settings", expected: "settings tabs render" },
];

export const INTERACTION_TEST_CASES = [
  { action: "click public Run review", expected: "Dashboard page opens" },
  { action: "click dashboard New Release Review", expected: "New Check page opens" },
  { action: "click recent session", expected: "Session Detail page opens" },
  { action: "click each session tab", expected: "corresponding tab content renders" },
  { action: "click each settings tab", expected: "corresponding settings panel renders" },
  { action: "click logo in public header", expected: "Landing page opens" },
  { action: "click app header Settings", expected: "Settings page opens" },
  { action: "default initial render", expected: "Landing page is selected" },
];

const SESSIONS = [
  {
    title: "Patient follow-up reminder assistant",
    score: 86,
    risks: 5,
    date: "29 Apr 2026",
    status: "Complete",
    description: "AI assistant that sends follow-up reminders to patients, summarizes appointment context, and escalates non-response to care coordinators.",
  },
  {
    title: "AI interviewer for PM Accelerator",
    score: 82,
    risks: 7,
    date: "29 Apr 2026",
    status: "Needs review",
    description: "AI interviewer that screens applicants, summarizes answers, and recommends candidates for review.",
  },
  {
    title: "Customer support reply assistant",
    score: 91,
    risks: 4,
    date: "28 Apr 2026",
    status: "Complete",
    description: "Assistant that drafts customer replies from ticket history and product documentation.",
  },
];

const ACTIVE_SESSION = {
  ...SESSIONS[0],
  industry: "Healthcare",
  releaseType: "Production",
  decision: "Approve with safeguards",
  euRisk: "Limited risk",
  scoreBreakdown: [
    ["Risk coverage", 100],
    ["Spec completeness", 100],
    ["Test coverage", 75],
    ["Guardrails", 85],
    ["Checklist", 70],
  ],
  risksDetailed: [
    ["Data Privacy Breach", "High", "Patient information could be exposed through reminders, summaries, or logs."],
    ["Missed Escalation", "Medium", "Non-response may not be escalated quickly enough for vulnerable patients."],
    ["Over-reliance", "Medium", "Staff may rely on assistant summaries without verifying clinical context."],
  ],
  checklist: [
    "Define interface requirements for the assistant.",
    "Conduct user acceptance testing with providers.",
    "Establish data privacy policy and security protocols.",
  ],
  tests: [
    ["Consent boundary test", "Verify reminders are blocked when patient consent is missing.", "Privacy"],
    ["Escalation fallback test", "Trigger escalation after repeated non-response.", "Reliability"],
    ["Prompt injection test", "Ensure reminder content cannot override system instructions.", "Security"],
  ],
  guardrails: [
    "Do not send medical advice in reminder text.",
    "Escalate urgent symptoms instead of generating a reply.",
    "Mask protected health information in logs.",
  ],
  releaseNotes: "Adds controlled patient follow-up reminders with consent-aware messaging, escalation routing, and audit logging.",
  gtmPage: "A safer reminder workflow for care teams that need follow-up automation without losing oversight.",
  pitchDeck: ["Problem", "Workflow", "Risk controls", "Validation results", "Launch decision"],
};

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function Icon({ name, className = "" }) {
  const base = {
    className: cn("h-5 w-5", className),
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
  };

  const icons = {
    logo: (
      <svg {...base} viewBox="0 0 32 32">
        <path d="M16 3 27 8v8c0 7.2-4.7 11-11 13C9.7 27 5 23.2 5 16V8l11-5Z" fill="currentColor" stroke="none" />
        <path d="m11 16 3 3 7-8" stroke="white" strokeWidth="2.2" />
      </svg>
    ),
    arrow: (
      <svg {...base}>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </svg>
    ),
    check: (
      <svg {...base}>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 3 3 5-6" />
      </svg>
    ),
  };

  return icons[name] || icons.check;
}

function Logo({ dark = false }) {
  return (
    <div className="flex items-center gap-3">
      <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl shadow-sm", dark ? "bg-white text-slate-950" : "bg-slate-950 text-white")}>
        <Icon name="logo" />
      </span>
      <span className={cn("text-sm font-bold tracking-tight md:text-base", dark ? "text-white" : "text-slate-950")}>ReleaseOps Agent</span>
    </div>
  );
}

function Button({ children, variant = "primary", onClick, type = "button", className = "" }) {
  const styles = {
    primary: "bg-slate-950 text-white hover:bg-slate-800",
    secondary: "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
    violet: "bg-violet-600 text-white hover:bg-violet-700",
  };

  return (
    <button type={type} onClick={onClick} className={cn("inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold shadow-sm transition", styles[variant] || styles.primary, className)}>
      {children}
    </button>
  );
}

function Pill({ children, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-white text-slate-700",
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    green: "border-emerald-100 bg-emerald-50 text-emerald-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
    red: "border-red-100 bg-red-50 text-red-700",
    dark: "border-slate-700 bg-slate-800 text-slate-200",
  };
  return <span className={cn("inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold", tones[tone] || tones.slate)}>{children}</span>;
}

function SectionTitle({ eyebrow, title, subtitle, dark = false }) {
  return (
    <div className="max-w-3xl">
      <p className={cn("mb-3 text-xs font-bold uppercase tracking-[0.22em]", dark ? "text-blue-300" : "text-blue-600")}>{eyebrow}</p>
      <h2 className={cn("text-3xl font-semibold tracking-[-0.035em] md:text-5xl", dark ? "text-white" : "text-slate-950")}>{title}</h2>
      {subtitle ? <p className={cn("mt-5 text-base leading-8", dark ? "text-slate-300" : "text-slate-600")}>{subtitle}</p> : null}
    </div>
  );
}

function PublicHeader({ onNavigate }) {
  return (
    <header className="border-b border-slate-100 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-8">
        <button type="button" onClick={() => onNavigate("Landing")} className="text-left">
          <Logo />
        </button>
        <nav className="hidden items-center gap-8 md:flex">
          {[["Product", "Product"], ["Guide", "Guide"], ["App", "Dashboard"]].map(([label, page]) => (
            <button key={label} type="button" onClick={() => onNavigate(page)} className="text-sm font-medium text-slate-600 hover:text-slate-950">
              {label}
            </button>
          ))}
        </nav>
        <Button onClick={() => onNavigate("Dashboard")}>Run review</Button>
      </div>
    </header>
  );
}

function AppHeader({ onNavigate }) {
  return (
    <header className="border-b border-slate-800 bg-slate-950 px-6 py-4">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6">
        <button type="button" onClick={() => onNavigate("Dashboard")} className="text-left">
          <Logo dark />
        </button>
        <nav className="hidden items-center gap-2 lg:flex">
          {[["Dashboard", "Dashboard"], ["Sessions", "Session Detail"], ["Settings", "Settings"], ["Guide", "Guide"]].map(([label, page]) => (
            <button key={label} type="button" onClick={() => onNavigate(page)} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-400 hover:bg-slate-800 hover:text-white">
              {label}
            </button>
          ))}
          <button type="button" onClick={() => onNavigate("New Check")} className="ml-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white">
            + New Release Review
          </button>
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          <span className="rounded-xl bg-slate-800 px-3 py-2 text-sm text-white">Othniel</span>
          <span className="rounded-xl border border-red-900/70 px-3 py-2 text-sm text-red-300">Sign out</span>
        </div>
      </div>
    </header>
  );
}

function DarkCard({ title, children, className = "" }) {
  return (
    <section className={cn("rounded-2xl border border-slate-800 bg-slate-900/70 p-6", className)}>
      {title ? <h3 className="mb-5 text-sm font-bold uppercase tracking-[0.16em] text-slate-400">{title}</h3> : null}
      {children}
    </section>
  );
}

function LandingPage({ onNavigate }) {
  const metrics = [["3", "specialist review stages"], ["<60s", "from feature to decision"], ["7", "governance frameworks"], ["0", "manual release docs"]];
  const pipeline = [
    ["01", "Release Analysis", "Turns the feature idea into a structured release spec, risk register, and readiness checklist."],
    ["02", "Validation Planning", "Generates test strategy, linked test cases, and practical guardrails before rollout."],
    ["03", "Decision Packaging", "Produces release notes, stakeholder summary, GTM assets, and an approval-ready decision pack."],
  ];
  const outputs = ["Readiness score", "Risk register", "Test plan", "Guardrails", "Regulation mapping", "Governance evidence"];

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <PublicHeader onNavigate={onNavigate} />
      <section className="relative overflow-hidden px-6 py-20 md:py-28 lg:px-8">
        <div className="absolute inset-x-0 top-0 -z-10 h-[48rem] bg-[radial-gradient(circle_at_top_right,#dbeafe,transparent_34%),radial-gradient(circle_at_bottom_left,#ede9fe,transparent_30%),linear-gradient(180deg,#f8fafc,white)]" />
        <div className="mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <div className="mb-6 inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-600 shadow-sm">AI release readiness system</div>
            <h1 className="max-w-5xl text-5xl font-semibold tracking-[-0.06em] md:text-7xl">Is your AI feature actually ready to ship?</h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600">ReleaseOps Agent reviews an AI feature before launch and returns the evidence your team needs: release spec, risks, tests, guardrails, regulation mapping, and a go-live decision.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button onClick={() => onNavigate("Dashboard")}>Open app demo <Icon name="arrow" className="h-4 w-4" /></Button>
              <Button variant="secondary" onClick={() => onNavigate("Product")}>Explore product</Button>
            </div>
            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {metrics.map(([value, label]) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur">
                  <p className="text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          </div>
          <aside className="relative" aria-label="ReleaseOps sample assessment">
            <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-blue-100/70 blur-3xl" />
            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-200/80 sm:p-6">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Release decision</p>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight">AI customer support refund assistant</h3>
                </div>
                <Pill tone="green">Complete</Pill>
              </div>
              <div className="mt-8 grid gap-5 md:grid-cols-[0.8fr_1.2fr]">
                <div className="rounded-[1.5rem] bg-slate-950 p-5 text-white">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Readiness</p>
                  <div className="mt-5 flex items-end gap-1"><span className="text-6xl font-semibold tracking-tight">86</span><span className="pb-2 text-sm font-semibold text-slate-400">/100</span></div>
                  <p className="mt-3 text-sm text-blue-200">Ship with controls</p>
                </div>
                <div className="rounded-[1.5rem] border border-slate-200 p-5">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Required controls</p>
                  <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
                    <li>✓ Human approval for refunds above threshold</li>
                    <li>✓ PII access logging enabled</li>
                    <li>✓ Customer replies pass moderation</li>
                  </ul>
                </div>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {pipeline.map(([number, title, body]) => (
                  <div key={title} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-xs font-bold text-blue-600">{number}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">{title}</p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>
      <section className="px-6 py-20 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-12 border-y border-slate-100 py-16 md:grid-cols-[0.85fr_1.15fr]">
          <SectionTitle eyebrow="Why it matters" title="A prompt can draft suggestions. A release needs evidence." />
          <div className="space-y-6 text-lg leading-9 text-slate-600">
            <p>AI features often move from idea to launch through scattered docs, manual checks, ad-hoc risk reviews, and late compliance evidence.</p>
            <p className="border-l-4 border-blue-600 pl-6 font-medium text-slate-950">ReleaseOps Agent turns that fragmented review into one repeatable decision path: analyse the release, validate the risks, package the evidence, and make the go-live call.</p>
          </div>
        </div>
      </section>
      <section className="bg-slate-950 px-6 py-20 text-white lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-[0.85fr_1.15fr]">
          <SectionTitle dark eyebrow="What you get" title="A complete release package, not another loose answer." />
          <div className="grid gap-3 sm:grid-cols-2">
            {outputs.map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-400/10 text-blue-300"><Icon name="check" className="h-4 w-4" /></span>
                  <p className="font-semibold text-white">{item}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function ProductPage({ onNavigate }) {
  const failureModes = [
    ["No structured spec", "A chat prompt rarely captures users, data, tools, business actions, owners, and release conditions in one consistent format."],
    ["Blind spots in risk", "Safety, privacy, security, reliability, and business risk are usually reviewed in separate conversations or not reviewed at all."],
    ["Shallow test coverage", "Teams often ship with happy-path tests while edge cases, adversarial prompts, and approval failures remain unchecked."],
    ["Evidence written late", "Approvals, release notes, controls, and audit records are often assembled after decisions have already been made."],
  ];
  return (
    <main className="min-h-screen bg-white text-slate-950">
      <PublicHeader onNavigate={onNavigate} />
      <section className="px-6 py-20 md:py-28 lg:px-8">
        <div className="mx-auto max-w-6xl"><SectionTitle eyebrow="Product" title="The release layer between an AI idea and production." subtitle="ReleaseOps Agent turns a proposed AI workflow into a structured release decision: what can ship, what needs controls, and what should not ship yet." /></div>
      </section>
      <section className="px-6 py-20 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-[0.85fr_1.15fr]">
          <SectionTitle eyebrow="Why this exists" title="Single-prompt reviews miss the work that happens before launch." subtitle="The problem is not that teams lack AI. The problem is that release readiness is fragmented, informal, and hard to prove." />
          <dl className="divide-y divide-slate-200 border-y border-slate-200">
            {failureModes.map(([label, text]) => (
              <div key={label} className="grid gap-3 py-6 md:grid-cols-[190px_1fr]"><dt className="text-sm font-semibold">{label}</dt><dd className="text-sm leading-7 text-slate-600">{text}</dd></div>
            ))}
          </dl>
        </div>
      </section>
      <section className="bg-slate-950 px-6 py-20 text-white lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-[0.85fr_1.15fr]">
          <SectionTitle dark eyebrow="Why not generic AI?" title="Generic AI suggests. ReleaseOps Agent structures the release decision." />
          <dl className="divide-y divide-white/10 border-y border-white/10">
            {[["Generic AI", "Drafts useful text, but the result is usually a one-off answer with no release structure, evidence trail, or approval state."], ["ReleaseOps Agent", "Runs a repeatable release review and records the score, risks, tests, controls, approvals, and launch outcome."]].map(([label, text]) => (
              <div key={label} className="grid gap-3 py-6 md:grid-cols-[180px_1fr]"><dt className="text-sm font-semibold text-white">{label}</dt><dd className="text-sm leading-7 text-slate-300">{text}</dd></div>
            ))}
          </dl>
        </div>
      </section>
    </main>
  );
}

function GuidePage({ onNavigate }) {
  const quickStart = [["1", "Click + New Check", "Start from anywhere in the app."], ["2", "Describe your feature", "Add a title, description, and industry preset."], ["3", "Watch the pipeline", "Follow the live Release Analysis → Validation Planning → Decision Packaging logs."], ["4", "Explore results", "Review Overview, Spec & Risks, Tests, Docs, Regulation, and Governance."]];
  const agents = [["Release Analysis", ["Release spec", "Risk register", "Readiness checklist"]], ["Validation Planning", ["Test strategy", "Test cases", "Guardrails"]], ["Decision Packaging", ["Release notes", "GTM page", "Pitch deck"]]];
  return (
    <main className="min-h-screen bg-white text-slate-950">
      <PublicHeader onNavigate={onNavigate} />
      <section className="px-6 py-20 md:py-28 lg:px-8"><div className="mx-auto max-w-6xl"><SectionTitle eyebrow="Guide" title="How to run a release check." subtitle="Use this guide to understand the check flow, the three-agent pipeline, the regulation engine, and the governance tools available after a run." /></div></section>
      <section className="px-6 py-20 lg:px-8"><div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-[0.85fr_1.15fr]"><SectionTitle eyebrow="Quick start" title="Run a check in four steps." /><ol className="divide-y divide-slate-200 border-y border-slate-200">{quickStart.map(([number, title, body]) => <li key={title} className="grid gap-4 py-6 md:grid-cols-[56px_220px_1fr]"><span className="text-sm font-bold text-blue-600">{number}</span><h3 className="text-lg font-semibold">{title}</h3><p className="text-sm leading-7 text-slate-600">{body}</p></li>)}</ol></div></section>
      <section className="bg-slate-50 px-6 py-20 lg:px-8"><div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-[0.85fr_1.15fr]"><SectionTitle eyebrow="Three Agents" title="Each agent owns a different part of the check." /><div className="grid gap-4 md:grid-cols-3">{agents.map(([name, items]) => <div key={name} className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm"><h3 className="text-lg font-semibold">{name}</h3><ul className="mt-5 space-y-3">{items.map((item) => <li key={item} className="text-sm text-slate-600">→ {item}</li>)}</ul></div>)}</div></div></section>
    </main>
  );
}

function AppDashboard({ onOpenNewCheck, onOpenSession }) {
  const avgScore = useMemo(() => Math.round(SESSIONS.reduce((sum, session) => sum + session.score, 0) / SESSIONS.length), []);
  const totalRisks = useMemo(() => SESSIONS.reduce((sum, session) => sum + session.risks, 0), []);
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><h1 className="text-4xl font-semibold tracking-tight text-white">Dashboard</h1><p className="mt-2 text-slate-400">Release readiness overview, recent sessions, and governance status.</p></div><Button variant="violet" onClick={onOpenNewCheck}>+ New Release Review</Button></div>
      <div className="grid gap-4 md:grid-cols-4">{[[SESSIONS.length, "Sessions"], [avgScore, "Avg score"], [totalRisks, "Total risks"], [FRAMEWORKS.length, "Frameworks"]].map(([value, label]) => <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center"><p className="text-3xl font-bold text-blue-400">{value}</p><p className="mt-1 text-sm text-slate-400">{label}</p></div>)}</div>
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]"><DarkCard title="Recent sessions">{SESSIONS.map((session) => <button key={session.title} type="button" onClick={onOpenSession} className="flex w-full items-center justify-between border-b border-slate-800 py-4 text-left last:border-b-0"><div><p className="font-semibold text-white">{session.title}</p><p className="text-sm text-slate-500">{session.date} · {session.risks} risks</p></div><span className="rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-bold text-emerald-400">{session.score}</span></button>)}</DarkCard><DarkCard title="Governance status"><div className="space-y-4"><StatusBlock color="blue" title="Production Release Gate" body="3 sessions analysed" /><StatusBlock color="green" title="Drift Monitor" body="0 regressions detected" /><StatusBlock color="amber" title="Pending sign-offs" body="PM, Legal, QA, Security" /></div></DarkCard></div>
    </div>
  );
}

function StatusBlock({ color, title, body }) {
  const colors = { blue: "border-blue-500", green: "border-emerald-500", amber: "border-amber-500" };
  return <div className={cn("rounded-xl border-l-4 bg-slate-800/70 p-4", colors[color])}><p className="font-semibold text-white">{title}</p><p className="mt-1 text-sm text-slate-400">{body}</p></div>;
}

function NewCheckPage({ onClose }) {
  return <div className="mx-auto max-w-3xl"><button type="button" onClick={onClose} className="mb-6 text-sm font-semibold text-slate-400 hover:text-white">← Back to dashboard</button><DarkCard title="New Release Review"><form className="space-y-6" onSubmit={(event) => event.preventDefault()}><div><label className="text-sm font-semibold text-white">Industry preset</label><select className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-200"><option>Healthcare</option><option>Finance</option><option>Customer Support</option><option>HR</option></select></div><div><label className="text-sm font-semibold text-white">Title</label><input className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-200" defaultValue="Patient follow-up reminder assistant" /></div><div><label className="text-sm font-semibold text-white">Feature description</label><textarea className="mt-2 min-h-40 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-200" defaultValue="AI assistant that sends follow-up reminders to patients, summarizes appointment context, and escalates non-response to care coordinators." /></div><div><label className="text-sm font-semibold text-white">Release type</label><div className="mt-3 flex flex-wrap gap-3">{["Prototype", "Beta", "Production"].map((type) => <span key={type} className={cn("rounded-xl border px-4 py-3 text-sm font-semibold", type === "Production" ? "border-violet-500 bg-violet-500/10 text-violet-200" : "border-slate-700 text-slate-400")}>{type}</span>)}</div></div><Button variant="violet" type="submit">Run Release Review</Button></form></DarkCard></div>;
}

function SessionDetailPage({ onBack }) {
  const [activeTab, setActiveTab] = useState("Overview");
  return <div className="space-y-6"><button type="button" onClick={onBack} className="text-sm font-semibold text-slate-400 hover:text-white">← Back to dashboard</button><div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between"><div><h1 className="text-4xl font-semibold tracking-tight text-white">{ACTIVE_SESSION.title}</h1><p className="mt-2 max-w-3xl text-slate-400">{ACTIVE_SESSION.description}</p><div className="mt-4 flex flex-wrap gap-2"><Pill tone="dark">{ACTIVE_SESSION.status}</Pill><Pill tone="dark">{ACTIVE_SESSION.date}</Pill><Pill tone="dark">{ACTIVE_SESSION.risks} risks</Pill><Pill tone="green">{ACTIVE_SESSION.score}/100</Pill></div></div><div className="flex flex-wrap gap-2">{["Re-analyze", "Package", "Certificate", "Share"].map((action) => <span key={action} className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200">{action}</span>)}</div></div><div className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900 p-2">{SESSION_TABS.map((tab) => <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={cn("shrink-0 rounded-xl px-4 py-2 text-sm font-semibold", activeTab === tab ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white")}>{tab}</button>)}</div>{activeTab === "Overview" ? <OverviewTab /> : null}{activeTab === "Spec & Risks" ? <SpecRisksTab /> : null}{activeTab === "Tests & Guardrails" ? <TestsGuardrailsTab /> : null}{activeTab === "Docs & Launch" ? <DocsLaunchTab /> : null}{activeTab === "Regulation" ? <RegulationTab /> : null}{activeTab === "Governance" ? <GovernanceTab /> : null}</div>;
}

function OverviewTab() {
  return <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]"><DarkCard title="Readiness score"><div className="flex flex-col gap-6 md:flex-row md:items-center"><div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full border-4 border-emerald-500 text-4xl font-bold text-emerald-400">{ACTIVE_SESSION.score}</div><div className="flex-1 space-y-3">{ACTIVE_SESSION.scoreBreakdown.map(([label, value]) => <ProgressRow key={label} label={label} value={value} />)}</div></div></DarkCard><DarkCard title="Must-do before launch"><ul className="space-y-3 text-sm text-slate-300">{ACTIVE_SESSION.checklist.map((item) => <li key={item}>□ {item}</li>)}</ul></DarkCard><DarkCard title="Risk severity"><RiskList /></DarkCard><DarkCard title="Version history"><div className="space-y-3 text-sm text-slate-300"><p>v3 · Current analysis complete</p><p>v2 · Risk register updated</p><p>v1 · Initial release review created</p></div></DarkCard></div>;
}

function ProgressRow({ label, value }) {
  return <div className="grid grid-cols-[150px_1fr_48px] items-center gap-3 text-sm"><span className="text-slate-400">{label}</span><span className="h-2 rounded-full bg-slate-800"><span className="block h-2 rounded-full bg-emerald-500" style={{ width: `${value}%` }} /></span><span className="text-right text-slate-300">{value}%</span></div>;
}

function RiskList() {
  return <div className="space-y-4">{ACTIVE_SESSION.risksDetailed.map(([name, severity, detail]) => <div key={name} className="rounded-xl bg-slate-800 p-4"><div className="flex items-center justify-between gap-4"><p className="font-semibold text-white">{name}</p><Pill tone={severity === "High" ? "red" : "amber"}>{severity}</Pill></div><p className="mt-2 text-sm text-slate-400">{detail}</p></div>)}</div>;
}

function SpecRisksTab() {
  return <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]"><DarkCard title="Compliance frameworks"><div className="flex flex-wrap gap-2">{FRAMEWORKS.map((framework) => <Pill key={framework} tone="dark">{framework}</Pill>)}</div></DarkCard><DarkCard title="Risk heatmap"><div className="grid grid-cols-2 gap-3 md:grid-cols-3">{["Safety", "Security", "Privacy", "Reliability", "Compliance", "Business"].map((item, index) => <div key={item} className={cn("rounded-xl p-4 text-sm font-semibold", index < 2 ? "bg-red-500/20 text-red-200" : index < 4 ? "bg-amber-500/20 text-amber-200" : "bg-emerald-500/20 text-emerald-200")}>{item}</div>)}</div></DarkCard><DarkCard title="Release spec"><dl className="space-y-4 text-sm">{[["Industry", ACTIVE_SESSION.industry], ["Release type", ACTIVE_SESSION.releaseType], ["Decision", ACTIVE_SESSION.decision], ["EU risk tier", ACTIVE_SESSION.euRisk]].map(([label, value]) => <div key={label} className="flex justify-between gap-4"><dt className="text-slate-400">{label}</dt><dd className="font-semibold text-white">{value}</dd></div>)}</dl></DarkCard><DarkCard title="Risk register"><RiskList /></DarkCard></div>;
}

function TestsGuardrailsTab() {
  return <div className="space-y-6"><DarkCard title="Traceability chain"><div className="flex flex-wrap items-center gap-3 text-sm text-slate-300"><Pill tone="dark">Risk</Pill><span>→</span><Pill tone="dark">Test case</Pill><span>→</span><Pill tone="dark">Guardrail</Pill><span>→</span><Pill tone="dark">Implementation hook</Pill></div></DarkCard><div className="grid gap-6 lg:grid-cols-2"><DarkCard title="Test cases"><div className="space-y-4">{ACTIVE_SESSION.tests.map(([name, detail, type]) => <div key={name} className="rounded-xl bg-slate-800 p-4"><div className="flex items-center justify-between gap-4"><p className="font-semibold text-white">{name}</p><Pill tone="blue">{type}</Pill></div><p className="mt-2 text-sm text-slate-400">{detail}</p></div>)}</div></DarkCard><DarkCard title="Guardrails"><ul className="space-y-3 text-sm text-slate-300">{ACTIVE_SESSION.guardrails.map((item) => <li key={item}>✓ {item}</li>)}</ul></DarkCard></div></div>;
}

function DocsLaunchTab() {
  return <div className="grid gap-6 lg:grid-cols-3"><DarkCard title="Release notes"><p className="text-sm leading-7 text-slate-300">{ACTIVE_SESSION.releaseNotes}</p></DarkCard><DarkCard title="GTM page"><p className="text-sm leading-7 text-slate-300">{ACTIVE_SESSION.gtmPage}</p></DarkCard><DarkCard title="Pitch deck outline"><ul className="space-y-3 text-sm text-slate-300">{ACTIVE_SESSION.pitchDeck.map((item) => <li key={item}>→ {item}</li>)}</ul></DarkCard></div>;
}

function RegulationTab() {
  return <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]"><DarkCard title="EU AI Act classification"><div className="rounded-2xl border border-amber-700/50 bg-amber-500/5 p-5"><p className="text-2xl font-bold text-amber-300">{ACTIVE_SESSION.euRisk}</p><p className="mt-2 text-sm text-slate-400">Transparency obligations apply. Users must be informed they are interacting with AI.</p></div></DarkCard><DarkCard title="Framework crosswalk"><div className="space-y-3 text-sm">{FRAMEWORKS.map((framework, index) => <div key={framework} className="flex items-center justify-between rounded-xl bg-slate-800 p-3"><span className="font-semibold text-white">{framework}</span><span className={index < 3 ? "text-red-300" : "text-emerald-300"}>{index < 3 ? "Triggered" : "Mapped"}</span></div>)}</div></DarkCard></div>;
}

function GovernanceTab() {
  return <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]"><DarkCard title="Sign-offs"><div className="grid gap-3 sm:grid-cols-2">{["Product Manager", "QA Lead", "Legal / Compliance", "Security"].map((role) => <div key={role} className="rounded-xl bg-slate-800 p-4"><div className="flex items-center justify-between"><p className="font-semibold text-white">{role}</p><span className="text-xs text-amber-300">Pending</span></div><button type="button" className="mt-4 w-full rounded-lg bg-violet-600 px-3 py-2 text-sm font-bold text-white">Sign off</button></div>)}</div></DarkCard><DarkCard title="Certificates and audit"><div className="space-y-4 text-sm text-slate-300"><p>Generate auditor-ready PDF with review evidence.</p><button type="button" className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-bold text-white">Download certificate</button><div className="rounded-xl bg-slate-800 p-4"><p className="font-semibold text-white">Audit trail</p><p className="mt-1 text-slate-400">Created → Analysed → Reviewed → Certificate requested</p></div></div></DarkCard><DarkCard title="Quality gates"><div className="space-y-3 text-sm text-slate-300"><p>Release score threshold: 80</p><p>High risk blocker: enabled</p><p>Required sign-offs: PM, QA, Legal, Security</p></div></DarkCard><DarkCard title="Integrations"><div className="flex flex-wrap gap-2">{["Slack", "Jira", "GitHub PR", "Linear", "Webhook"].map((item) => <Pill key={item} tone="dark">{item}</Pill>)}</div></DarkCard></div>;
}

function SettingsPage() {
  const [tab, setTab] = useState("Profile");
  return <div className="space-y-6"><div><h1 className="text-4xl font-semibold text-white">Settings</h1><p className="mt-2 text-slate-400">Profile, team, API keys, integrations, and quality gates.</p></div><div className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900 p-2">{SETTINGS_TABS.map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={cn("shrink-0 rounded-xl px-4 py-2 text-sm font-semibold", tab === item ? "bg-violet-600 text-white" : "text-slate-400")}>{item}</button>)}</div><DarkCard title={tab}>{tab === "Profile" ? <ProfileSettings /> : null}{tab === "Team" ? <TeamSettings /> : null}{tab === "API Keys" ? <ApiKeySettings /> : null}{tab === "Integrations" ? <IntegrationSettings /> : null}{tab === "Gates" ? <GateSettings /> : null}</DarkCard></div>;
}

function ProfileSettings() {
  return <div className="grid gap-4 md:grid-cols-2"><input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-200" defaultValue="Othniel Simon" /><input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-200" defaultValue="peprodev@gmail.com" /></div>;
}

function TeamSettings() {
  return <div className="space-y-3 text-sm text-slate-300"><p>Workspace: ReleaseOps Demo</p><p>Members: Product, QA, Legal, Security</p><p>Invite flow: enabled</p></div>;
}

function ApiKeySettings() {
  return <div className="space-y-3 text-sm text-slate-300"><p>releaseops_live_••••••••••••••</p><Button variant="violet">Create API key</Button></div>;
}

function IntegrationSettings() {
  return <div className="grid gap-4 md:grid-cols-2">{["Slack", "Jira", "GitHub", "Linear"].map((item) => <div key={item} className="rounded-xl bg-slate-800 p-4"><p className="font-semibold text-white">{item}</p><p className="mt-1 text-sm text-slate-400">Configure connection</p></div>)}</div>;
}

function GateSettings() {
  return <div className="space-y-3 text-sm text-slate-300"><p>Minimum readiness score: 80</p><p>Block high risk releases: enabled</p><p>Require all sign-offs: enabled</p></div>;
}

function AppLayout({ children, onNavigate }) {
  return <main className="min-h-screen bg-slate-950 text-white"><AppHeader onNavigate={onNavigate} /><div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">{children}</div></main>;
}

export default function ReleaseOpsAgentUI() {
  const [page, setPage] = useState("Landing");
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="sticky top-0 z-[60] border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3"><div className="text-sm font-bold text-slate-950">UI Canvas</div><div className="flex flex-wrap gap-2">{PAGES.map((item) => <button key={item} type="button" onClick={() => setPage(item)} className={cn("rounded-full px-4 py-2 text-sm font-semibold", page === item ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600")}>{item}</button>)}</div></div></div>
      {page === "Landing" ? <LandingPage onNavigate={setPage} /> : null}
      {page === "Product" ? <ProductPage onNavigate={setPage} /> : null}
      {page === "Guide" ? <GuidePage onNavigate={setPage} /> : null}
      {page === "Dashboard" ? <AppLayout onNavigate={setPage}><AppDashboard onOpenNewCheck={() => setPage("New Check")} onOpenSession={() => setPage("Session Detail")} /></AppLayout> : null}
      {page === "New Check" ? <AppLayout onNavigate={setPage}><NewCheckPage onClose={() => setPage("Dashboard")} /></AppLayout> : null}
      {page === "Session Detail" ? <AppLayout onNavigate={setPage}><SessionDetailPage onBack={() => setPage("Dashboard")} /></AppLayout> : null}
      {page === "Settings" ? <AppLayout onNavigate={setPage}><SettingsPage /></AppLayout> : null}
    </div>
  );
}
