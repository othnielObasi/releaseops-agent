import React, { useCallback, useEffect, useMemo, useState } from "react";
import { SignIn, SignUp, UserButton, useAuth, useUser } from "@clerk/clerk-react";
import { sessions as sessionsAPI, teams as teamsAPI, setAuthTokenProvider } from "./services/api";
import { transformSessionList } from "./services/transform";
import LegacyDashboard from "./pages/Dashboard";
import LegacySessionsList from "./pages/SessionsList";
import LegacySessionDetail from "./pages/SessionDetail";
import LegacyCompareView from "./pages/CompareView";
import LegacyAdmin from "./pages/Admin";
import LegacySettings from "./pages/Settings";
import LegacyNewCheck from "./pages/NewCheck";
import LegacyGuidePanel from "./pages/GuidePanel";

const PAGES = ["Landing", "Product", "Guide", "Dashboard", "New Release Review", "Review Detail", "Settings"];
export const UI_TEST_CASES = [
  { page: "Landing", expected: "default page renders first" },
  { page: "Product", expected: "product explanation renders" },
  { page: "Guide", expected: "quick-start guide renders" },
  { page: "Dashboard", expected: "authenticated dashboard renders" },
  { page: "New Release Review", expected: "new review intake form renders" },
  { page: "Review Detail", expected: "session workspace tabs render" },
  { page: "Settings", expected: "settings tabs render" },
];

export const INTERACTION_TEST_CASES = [
  { action: "click public Run review", expected: "Dashboard page opens" },
  { action: "click dashboard New Release Review", expected: "New Release Review page opens" },
  { action: "click recent session", expected: "Review Detail page opens" },
  { action: "click each session tab", expected: "corresponding tab content renders" },
  { action: "click each settings tab", expected: "corresponding settings panel renders" },
  { action: "click logo in public header", expected: "Landing page opens" },
  { action: "click app header Settings", expected: "Settings page opens" },
  { action: "default initial render", expected: "Landing page is selected" },
];

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
    violet: "border border-slate-950 bg-slate-950 text-white hover:bg-slate-800",
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
          {[["Solution", "Product"], ["Guide", "Guide"]].map(([label, page]) => (
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
          {[["Dashboard", "Dashboard"], ["Reviews", "Review Detail"], ["Settings", "Settings"], ["Guide", "Guide"]].map(([label, page]) => (
            <button key={label} type="button" onClick={() => onNavigate(page)} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-400 hover:bg-slate-800 hover:text-white">
              {label}
            </button>
          ))}
          <button type="button" onClick={() => onNavigate("New Release Review")} className="ml-2 rounded-md border border-white bg-white px-3.5 py-2 text-sm font-bold text-slate-950 transition-colors hover:bg-slate-100">
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
  const metrics = [["4", "decision outcomes"], ["7", "governance frameworks"], ["4", "approval roles"], ["1", "audit record"]];
  const pipeline = [
    ["01", "Release Analysis", "Converts a proposed AI workflow into a structured release spec, owners, data access, risky actions, and readiness checklist."],
    ["02", "Validation Planning", "Links risks to tests, controls, guardrails, approval roles, and applicable frameworks."],
    ["03", "Decision Packaging", "Stores the go-live decision, evidence pack, approval history, audit log, and integration outputs."],
  ];
  const outcomes = ["Ship", "Ship with controls", "Needs review", "Do not ship yet"];
  const proof = [
    ["Organizations and roles", "Invite team members, assign PM, QA, Legal, Security, Admin, and member roles."],
    ["Approval workflow", "Required sign-offs, rejection reasons, risk acceptance rationale, and visible approval history."],
    ["Evidence record", "Readiness score, risk register, generated tests, controls, certificates, and audit trail."],
    ["Production deployment", "Clerk auth, tenant-aware access, FastAPI backend, Postgres persistence, and Vultr-hosted runtime."],
  ];
  const traceability = [
    ["Refund misuse", "Threshold abuse test", "Human approval above limit", "Blocks launch if missing"],
    ["PII exposure", "Access logging test", "Mask logs and track lookup purpose", "Requires Security approval"],
    ["Unsafe customer reply", "Moderation test", "Review before sending", "Requires QA approval"],
  ];

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <PublicHeader onNavigate={onNavigate} />
      <section className="relative overflow-hidden px-6 py-16 md:py-24 lg:px-8">
        <div className="absolute inset-x-0 top-0 -z-10 h-[46rem] bg-[radial-gradient(circle_at_top_right,#dbeafe,transparent_34%),radial-gradient(circle_at_bottom_left,#ecfdf5,transparent_30%),linear-gradient(180deg,#f8fafc,white)]" />
        <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="mb-6 inline-flex rounded-md border border-slate-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-600 shadow-sm">Enterprise AI go-live decision system</div>
            <h1 className="max-w-5xl text-5xl font-semibold tracking-[-0.05em] md:text-7xl">Turn AI release reviews into auditable launch decisions.</h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600">
              ReleaseOps Agent reviews proposed AI workflows, detects risky actions and data access, generates linked tests and controls, routes role-based approvals, and stores the go-live decision record.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button onClick={() => onNavigate("Dashboard")}>Open workspace <Icon name="arrow" className="h-4 w-4" /></Button>
              <Button variant="secondary" onClick={() => onNavigate("Product")}>Explore product</Button>
            </div>
            <div className="mt-10 grid grid-cols-2 gap-0 overflow-hidden rounded-md border border-slate-200 bg-white/80 shadow-sm sm:grid-cols-4">
              {metrics.map(([value, label]) => (
                <div key={label} className="border-b border-r border-slate-200 p-4 last:border-r-0 sm:border-b-0">
                  <p className="text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          </div>
          <aside className="relative" aria-label="ReleaseOps sample assessment">
            <div className="rounded-md border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/70 sm:p-6">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Release decision</p>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight">AI customer support refund assistant</h3>
                </div>
                <Pill tone="amber">Ship with controls</Pill>
              </div>
              <div className="mt-8 grid gap-5 md:grid-cols-[0.75fr_1.25fr]">
                <div className="rounded-md bg-slate-950 p-5 text-white">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Decision score</p>
                  <div className="mt-5 flex items-end gap-1"><span className="text-6xl font-semibold tracking-tight">86</span><span className="pb-2 text-sm font-semibold text-slate-400">/100</span></div>
                  <p className="mt-3 text-sm text-emerald-200">Evidence stored</p>
                </div>
                <div className="rounded-md border border-slate-200 p-5">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Approvals required</p>
                  <div className="mt-5 grid grid-cols-2 gap-2 text-sm">
                    {["PM", "QA", "Legal", "Security"].map((role) => (
                      <span key={role} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 font-semibold text-amber-800">{role}</span>
                    ))}
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-600">Refunds above threshold and customer-facing replies are blocked until controls and sign-offs are complete.</p>
                </div>
              </div>
              <div className="mt-6 overflow-hidden rounded-md border border-slate-200">
                <div className="grid grid-cols-[1.1fr_1.1fr_1.1fr_1fr] bg-slate-50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <span>Risk</span><span>Test</span><span>Control</span><span>Gate</span>
                </div>
                {traceability.map(([risk, test, control, gate]) => (
                  <div key={risk} className="grid grid-cols-[1.1fr_1.1fr_1.1fr_1fr] border-t border-slate-200 px-3 py-3 text-xs leading-5 text-slate-700">
                    <span className="font-semibold text-slate-950">{risk}</span><span>{test}</span><span>{control}</span><span>{gate}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>
      <section className="px-6 py-20 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-12 border-y border-slate-100 py-16 md:grid-cols-[0.85fr_1.15fr]">
          <SectionTitle eyebrow="Why it matters" title="A chat answer is not a release control." />
          <div className="space-y-6 text-lg leading-9 text-slate-600">
            <p>Enterprise AI launches need more than generated suggestions. Teams need one operational record showing what was checked, which controls are required, who approved, and why a release can or cannot move forward.</p>
            <p className="border-l-4 border-slate-950 pl-6 font-medium text-slate-950">ReleaseOps turns scattered release review into a repeatable decision workflow with tenant-aware access, role-based approvals, evidence packs, audit history, and release gates.</p>
          </div>
        </div>
      </section>
      <section className="bg-slate-950 px-6 py-20 text-white lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 md:grid-cols-[0.85fr_1.15fr]">
            <SectionTitle dark eyebrow="System capability" title="Built for the work around a real production approval." />
            <div className="divide-y divide-white/10 border-y border-white/10">
              {proof.map(([title, body]) => (
                <div key={title} className="grid gap-3 py-6 md:grid-cols-[210px_1fr]">
                  <h3 className="text-sm font-semibold text-white">{title}</h3>
                  <p className="text-sm leading-7 text-slate-300">{body}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-16 grid gap-12 md:grid-cols-[0.85fr_1.15fr]">
            <SectionTitle dark eyebrow="Decision workflow" title="Every run ends in a business-readable launch outcome." />
            <div>
              <div className="grid grid-cols-2 gap-2">
                {outcomes.map((item) => (
                  <div key={item} className="rounded-md border border-white/10 bg-white/5 p-4 text-sm font-semibold text-white">{item}</div>
                ))}
              </div>
              <div className="mt-6 space-y-3">
                {pipeline.map(([number, title, body]) => (
                  <div key={title} className="grid gap-3 border-t border-white/10 py-4 md:grid-cols-[48px_180px_1fr]">
                    <p className="text-xs font-bold text-blue-300">{number}</p>
                    <p className="text-sm font-semibold text-white">{title}</p>
                    <p className="text-sm leading-6 text-slate-300">{body}</p>
                  </div>
                ))}
              </div>
            </div>
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
  const useCases = [
    ["Customer-facing AI agents", "Refund assistants, support reply agents, onboarding copilots, and customer service automations that touch private data or take business actions.", "Controls: approval thresholds, PII logging, moderation, escalation."],
    ["Internal workflow agents", "Operations, sales, HR, finance, or support agents that call tools, update records, summarize sensitive information, or trigger downstream processes.", "Controls: tool permissions, audit trail, role approvals, rollback plan."],
    ["AI product releases", "New AI features moving from prototype to beta or production, where product, QA, security, and legal need one shared decision record.", "Controls: release gates, test coverage, framework mapping, evidence pack."],
    ["Regulated AI workflows", "Fintech, health, legal, HR, and enterprise SaaS workflows that need traceability from risk to control before launch.", "Controls: GDPR, SOC 2, ISO 42001, NIST AI RMF, EU AI Act mapping."],
  ];
  const operatingModel = [
    ["Product", "Submits the proposed AI workflow, business goal, users, and launch context."],
    ["ReleaseOps Agent", "Builds the release spec, risk register, tests, guardrails, compliance mapping, and decision recommendation."],
    ["QA / Security / Legal", "Review assigned controls, approve, reject with reason, or accept risk with rationale."],
    ["Leadership / Ops", "Uses the evidence pack, audit history, and final decision to allow, delay, or block launch."],
  ];
  const adoptionSteps = [
    ["Start with one AI workflow", "Run the release review on a customer-facing or internal agent before it reaches production."],
    ["Assign governance roles", "Invite organization members and map PM, QA, Legal, Security, Admin, and member permissions."],
    ["Turn controls into gates", "Use required sign-offs, score thresholds, unresolved blockers, and evidence checks as launch conditions."],
    ["Keep the record alive", "Compare versions, re-run reviews, export certificates, and keep decisions inspectable after launch."],
  ];

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <PublicHeader onNavigate={onNavigate} />
      <section className="px-6 py-20 md:py-28 lg:px-8">
        <div className="mx-auto max-w-6xl"><SectionTitle eyebrow="Solution" title="A release governance layer for teams shipping AI into production." subtitle="Use ReleaseOps when an AI workflow touches customer data, triggers business actions, needs cross-functional approval, or must leave an auditable launch record." /></div>
      </section>
      <section className="px-6 py-20 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-[0.85fr_1.15fr]">
          <SectionTitle eyebrow="Problem" title="Single-prompt reviews miss the work that happens before launch." subtitle="The problem is not that teams lack AI. The problem is that release readiness is fragmented, informal, and hard to prove." />
          <dl className="divide-y divide-slate-200 border-y border-slate-200">
            {failureModes.map(([label, text]) => (
              <div key={label} className="grid gap-3 py-6 md:grid-cols-[190px_1fr]"><dt className="text-sm font-semibold">{label}</dt><dd className="text-sm leading-7 text-slate-600">{text}</dd></div>
            ))}
          </dl>
        </div>
      </section>
      <section className="bg-slate-50 px-6 py-20 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-[0.85fr_1.15fr]">
          <SectionTitle eyebrow="Use cases" title="Where ReleaseOps becomes operational." subtitle="The best fit is not generic brainstorming. It is the final review layer before an AI workflow is allowed to affect users, records, money, policy, or regulated data." />
          <div className="divide-y divide-slate-200 border-y border-slate-200 bg-white">
            {useCases.map(([title, body, controls]) => (
              <div key={title} className="grid gap-3 p-5 md:grid-cols-[220px_1fr]">
                <h3 className="text-sm font-bold text-slate-950">{title}</h3>
                <div>
                  <p className="text-sm leading-7 text-slate-600">{body}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-500">{controls}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="px-6 py-20 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-[0.85fr_1.15fr]">
          <SectionTitle eyebrow="Operating model" title="Designed for cross-functional approval, not solo prompting." />
          <ol className="divide-y divide-slate-200 border-y border-slate-200">
            {operatingModel.map(([owner, body]) => (
              <li key={owner} className="grid gap-3 py-6 md:grid-cols-[180px_1fr]">
                <h3 className="text-sm font-bold text-slate-950">{owner}</h3>
                <p className="text-sm leading-7 text-slate-600">{body}</p>
              </li>
            ))}
          </ol>
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
      <section className="px-6 py-20 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-[0.85fr_1.15fr]">
          <SectionTitle eyebrow="Adoption path" title="How an enterprise team starts using it." />
          <ol className="divide-y divide-slate-200 border-y border-slate-200">
            {adoptionSteps.map(([title, body], index) => (
              <li key={title} className="grid gap-4 py-6 md:grid-cols-[56px_220px_1fr]">
                <span className="text-sm font-bold text-blue-600">{String(index + 1).padStart(2, "0")}</span>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="text-sm leading-7 text-slate-600">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </main>
  );
}

function SystemFlowAnimation() {
  const stages = [
    ["Input", "AI workflow context"],
    ["Analyze", "Risks and controls"],
    ["Validate", "Tests and guardrails"],
    ["Approve", "Role-based sign-offs"],
    ["Record", "Auditable decision"],
  ];

  return (
    <div className="releaseops-flow" aria-label="Animated ReleaseOps system flow">
      <div className="releaseops-flow__rail" />
      {stages.map(([label, detail], index) => (
        <div key={label} className="releaseops-flow__stage" style={{ "--flow-index": index }}>
          <div className="releaseops-flow__node">{index + 1}</div>
          <div>
            <h3>{label}</h3>
            <p>{detail}</p>
          </div>
        </div>
      ))}
      <div className="releaseops-flow__packet releaseops-flow__packet--one">release brief</div>
      <div className="releaseops-flow__packet releaseops-flow__packet--two">evidence</div>
      <div className="releaseops-flow__decision">
        <span>Decision</span>
        <strong>Ship with controls</strong>
      </div>
    </div>
  );
}

function GuidePage({ onNavigate }) {
  const quickStart = [["1", "Click + New Release Review", "Start from the global app header."], ["2", "Describe your feature", "Add a title, description, and industry preset."], ["3", "Watch the pipeline", "Follow the live Release Analysis, Validation Planning, and Decision Packaging logs."], ["4", "Work the decision", "Resolve blockers, collect sign-offs, export evidence, or accept risk with rationale."]];
  const agents = [["Release Analysis", ["Release spec", "Risk register", "Readiness checklist"]], ["Validation Planning", ["Test strategy", "Test cases", "Guardrails"]], ["Decision Packaging", ["Release notes", "Market page", "Stakeholder brief"]]];
  const governance = [["Organizations", "Create an organization, invite members, and assign approval roles."], ["Approvals", "PM, QA, Legal, and Security sign-offs are role-gated and logged."], ["Blockers", "Open blockers prevent a clean launch decision until resolved or accepted with rationale."], ["Evidence", "Export decision evidence and certificates for review or audit."]];
  return (
    <main className="min-h-screen bg-white text-slate-950">
      <PublicHeader onNavigate={onNavigate} />
      <section className="px-6 py-20 md:py-28 lg:px-8"><div className="mx-auto max-w-6xl"><SectionTitle eyebrow="Guide" title="How to operate ReleaseOps." subtitle="Use this page as the working guide: create a review, inspect the pipeline output, assign governance work, and close the decision record." /></div></section>
      <section className="bg-slate-950 px-6 py-20 text-white lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-[0.8fr_1.2fr]">
          <SectionTitle dark eyebrow="System flow" title="How a release review moves from feature context to launch decision." subtitle="The review is not a static report. It becomes a stored decision record with risks, controls, approvals, evidence, and audit history." />
          <SystemFlowAnimation />
        </div>
      </section>
      <section className="px-6 py-20 lg:px-8"><div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-[0.85fr_1.15fr]"><SectionTitle eyebrow="Quick start" title="Run a review in four steps." /><ol className="divide-y divide-slate-200 border-y border-slate-200">{quickStart.map(([number, title, body]) => <li key={title} className="grid gap-4 py-6 md:grid-cols-[56px_220px_1fr]"><span className="text-sm font-bold text-blue-600">{number}</span><h3 className="text-lg font-semibold">{title}</h3><p className="text-sm leading-7 text-slate-600">{body}</p></li>)}</ol></div></section>
      <section className="bg-slate-50 px-6 py-20 lg:px-8"><div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-[0.85fr_1.15fr]"><SectionTitle eyebrow="Review Stages" title="Each stage owns a different part of the release decision." /><div className="grid gap-4 md:grid-cols-3">{agents.map(([name, items]) => <div key={name} className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm"><h3 className="text-lg font-semibold">{name}</h3><ul className="mt-5 space-y-3">{items.map((item) => <li key={item} className="text-sm text-slate-600">/ {item}</li>)}</ul></div>)}</div></div></section>
      <section className="px-6 py-20 lg:px-8"><div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-[0.85fr_1.15fr]"><SectionTitle eyebrow="Governance workflow" title="What to do after the review completes." /><dl className="divide-y divide-slate-200 border-y border-slate-200">{governance.map(([title, body]) => <div key={title} className="grid gap-3 py-6 md:grid-cols-[180px_1fr]"><dt className="text-sm font-semibold">{title}</dt><dd className="text-sm leading-7 text-slate-600">{body}</dd></div>)}</dl></div></section>
    </main>
  );
}

function AuthModal({ mode, onClose, onModeChange }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()} className="relative w-full max-w-md">
        <button type="button" onClick={onClose} className="absolute -right-2 -top-2 z-10 rounded-full bg-slate-950 px-3 py-1 text-sm font-bold text-white shadow-sm">Close</button>
        {mode === "signup" ? (
          <SignUp routing="virtual" signInUrl="#" afterSignUpUrl="/" />
        ) : (
          <SignIn routing="virtual" signUpUrl="#" afterSignInUrl="/" />
        )}
        <button type="button" onClick={() => onModeChange(mode === "signup" ? "login" : "signup")} className="mt-3 w-full rounded-md bg-white px-4 py-2 text-sm font-semibold text-violet-700 shadow-sm">
          {mode === "signup" ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
        </button>
      </div>
    </div>
  );
}

function IntegratedAppHeader({ page, user, isAdmin, showGuide, onNavigate, onNewCheck, onToggleGuide, onLogout }) {
  const navItems = [
    ["Dashboard", "dash"],
    ["Reviews", "sessions"],
    ...(isAdmin ? [["Admin", "admin"]] : []),
    ["Settings", "settings"],
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-[#e6e0d6] bg-white/90 px-6 py-4 text-slate-950 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <button type="button" onClick={() => onNavigate("dash")} className="text-left">
          <Logo />
        </button>
        <nav className="hidden items-center gap-2 lg:flex">
          {navItems.map(([label, key]) => {
            const active = page === key || (key === "sessions" && (page === "detail" || page === "compare"));
            return (
              <button key={key} type="button" onClick={() => onNavigate(key)} className={cn("rounded-md px-3 py-2 text-sm font-semibold transition-colors", active ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-[#fbfaf7] hover:text-slate-950")}>
                {label}
              </button>
            );
          })}
          <button type="button" onClick={onNewCheck} className="ml-2 rounded-md border border-slate-950 bg-slate-950 px-3.5 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-800">+ New Release Review</button>
          <button type="button" onClick={onToggleGuide} className={cn("rounded-md border px-3.5 py-2 text-sm font-semibold transition-colors", showGuide ? "border-slate-950 bg-slate-950 text-white" : "border-transparent text-slate-600 hover:bg-[#fbfaf7] hover:text-slate-950")}>Guide</button>
        </nav>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-md bg-[#fbfaf7] px-3 py-2 text-sm text-slate-700 md:inline-flex">{user?.name || user?.email || "User"}</span>
          <UserButton afterSignOutUrl="/" />
          <button type="button" onClick={onLogout} className="rounded-md border border-transparent px-3 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50">Sign out</button>
        </div>
      </div>
      <nav className="mx-auto mt-3 flex max-w-7xl gap-2 overflow-x-auto lg:hidden">
        {navItems.map(([label, key]) => {
          const active = page === key || (key === "sessions" && (page === "detail" || page === "compare"));
          return (
            <button key={key} type="button" onClick={() => onNavigate(key)} className={cn("shrink-0 rounded-md px-3 py-2 text-sm font-semibold transition-colors", active ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-[#fbfaf7] hover:text-slate-950")}>
              {label}
            </button>
          );
        })}
        <button type="button" onClick={onNewCheck} className="shrink-0 rounded-md border border-slate-950 bg-slate-950 px-3.5 py-2 text-sm font-bold text-white">New Review</button>
        <button type="button" onClick={onToggleGuide} className={cn("shrink-0 rounded-md border px-3.5 py-2 text-sm font-semibold", showGuide ? "border-slate-950 bg-slate-950 text-white" : "border-transparent text-slate-600 hover:bg-[#fbfaf7]")}>Guide</button>
      </nav>
    </header>
  );
}

function IntegratedAppLayout({ children, ...headerProps }) {
  return (
    <main className="releaseops-light-app min-h-screen bg-white text-slate-950">
      <IntegratedAppHeader {...headerProps} />
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">{children}</div>
    </main>
  );
}

function JoinInvitation({ token, authenticated, onSignIn, onAccepted }) {
  const [invite, setInvite] = useState(null);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setStatus("loading");
    teamsAPI.inviteInfo(token)
      .then((data) => {
        setInvite(data);
        setStatus("ready");
      })
      .catch((err) => {
        setMessage(err.message || "Invitation not found or already used.");
        setStatus("error");
      });
  }, [token]);

  const accept = async () => {
    if (!authenticated) {
      onSignIn();
      return;
    }
    setStatus("accepting");
    setMessage("");
    try {
      await teamsAPI.acceptInvite(token);
      setStatus("accepted");
      setMessage("Invitation accepted. Your organization access is now active.");
      window.history.replaceState({}, "", "/");
      setTimeout(onAccepted, 700);
    } catch (err) {
      setStatus("ready");
      setMessage(err.message || "Could not accept this invitation.");
    }
  };

  return (
    <main className="releaseops-light-app min-h-screen bg-white text-slate-950">
      <PublicHeader onNavigate={() => onAccepted()} />
      <section className="mx-auto max-w-xl px-6 py-16">
        <div className="rounded-md border border-[#e6e0d6] bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Organization invitation</p>
          <h1 className="mt-3 text-2xl font-bold text-slate-950">
            {invite?.team_name || "ReleaseOps organization"}
          </h1>
          {status === "loading" ? (
            <p className="mt-4 text-sm text-slate-600">Loading invitation...</p>
          ) : status === "error" ? (
            <p className="mt-4 text-sm text-red-700">{message}</p>
          ) : (
            <>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                {invite?.inviter_email} invited {invite?.invitee_email} to join this organization.
              </p>
              {message ? <p className="mt-3 text-sm text-slate-700">{message}</p> : null}
              <button
                type="button"
                onClick={accept}
                disabled={status === "accepting" || status === "accepted"}
                className="mt-6 rounded-md bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {status === "accepted" ? "Accepted" : status === "accepting" ? "Accepting..." : authenticated ? "Accept invitation" : "Sign in to accept"}
              </button>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

export default function ReleaseOpsAgentUI() {
  const clerk = useAuth();
  const { user: clerkUser } = useUser();
  const [joinToken, setJoinToken] = useState(() => {
    const match = window.location.pathname.match(/^\/join\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  });
  const [page, setPage] = useState("landing");
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [compareA, setCompareA] = useState(null);
  const [compareB, setCompareB] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const raw = await sessionsAPI.list();
      setSessions(transformSessionList(raw));
    } catch {
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (clerk?.getToken) {
      setAuthTokenProvider(() => clerk.getToken());
    }
  }, [clerk?.getToken]);

  useEffect(() => {
    if (!clerk?.isLoaded) return;
    if (!clerk.isSignedIn) {
      setAuthenticated(false);
      setUser(null);
      setSessions([]);
      return;
    }
    const primaryEmail = clerkUser?.primaryEmailAddress?.emailAddress || clerkUser?.emailAddresses?.[0]?.emailAddress || "";
    const displayName = clerkUser?.fullName || clerkUser?.username || primaryEmail || "User";
    setUser({ name: displayName, email: primaryEmail, role: "user" });
    setAuthenticated(true);
    setAuthMode(null);
    if (page === "landing") setPage("dash");
    fetchSessions();
  }, [clerk?.isLoaded, clerk?.isSignedIn, clerkUser?.id, fetchSessions]);

  const beginAuth = (mode = "signup") => {
    setAuthMode(mode);
  };

  const navigate = (nextPage) => {
    if (["dash", "sessions", "detail", "compare", "settings", "admin"].includes(nextPage) && !authenticated) {
      beginAuth("signup");
      return;
    }
    setPage(nextPage);
    if (nextPage !== "detail") setSessionId(null);
    if (nextPage !== "compare") {
      setCompareA(null);
      setCompareB(null);
    }
  };

  const logout = () => {
    clerk?.signOut?.();
    setAuthenticated(false);
    setUser(null);
    setPage("landing");
    setSessions([]);
  };

  const openSession = (id) => {
    setSessionId(id);
    setPage("detail");
  };

  const activeSession = sessionId ? sessions.find((session) => session.id === sessionId) : null;
  const isAdmin = user?.role === "super_admin";
  const headerProps = {
    page,
    user,
    isAdmin,
    showGuide,
    onNavigate: navigate,
    onNewCheck: () => setShowNew(true),
    onToggleGuide: () => setShowGuide((value) => !value),
    onLogout: logout,
  };

  const publicNavigate = (target) => {
    const map = { Landing: "landing", Product: "product", Guide: "guide", Dashboard: "dash", "New Release Review": "dash" };
    navigate(map[target] || target);
  };

  return (
    <div className="min-h-screen bg-white">
      {joinToken ? (
        <JoinInvitation
          token={joinToken}
          authenticated={authenticated}
          onSignIn={() => beginAuth("login")}
          onAccepted={() => {
            setJoinToken(null);
            setPage("dash");
            fetchSessions();
          }}
        />
      ) : null}
      {!joinToken ? (
      <>
      {page === "landing" ? <LandingPage onNavigate={publicNavigate} /> : null}
      {page === "product" ? <ProductPage onNavigate={publicNavigate} /> : null}
      {page === "guide" ? <GuidePage onNavigate={publicNavigate} /> : null}
      {page === "dash" ? (
        <IntegratedAppLayout {...headerProps}>
          <LegacyDashboard sessions={sessions} loading={sessionsLoading} onNew={() => setShowNew(true)} onOpen={openSession} onRefresh={fetchSessions} />
        </IntegratedAppLayout>
      ) : null}
      {page === "sessions" ? (
        <IntegratedAppLayout {...headerProps}>
          <LegacySessionsList sessions={sessions} loading={sessionsLoading} onOpen={openSession} onNew={() => setShowNew(true)} onCompare={(a, b) => { setCompareA(a); setCompareB(b); setPage("compare"); }} />
        </IntegratedAppLayout>
      ) : null}
      {page === "detail" && sessionId ? (
        <IntegratedAppLayout {...headerProps}>
          <LegacySessionDetail sessionId={sessionId} fallback={activeSession} onBack={() => navigate("sessions")} onOpenSession={openSession} onRefreshSessions={fetchSessions} />
        </IntegratedAppLayout>
      ) : null}
      {page === "compare" && compareA && compareB ? (
        <IntegratedAppLayout {...headerProps}>
          <LegacyCompareView sessions={sessions} idA={compareA} idB={compareB} onBack={() => navigate("sessions")} />
        </IntegratedAppLayout>
      ) : null}
      {page === "admin" && isAdmin ? (
        <IntegratedAppLayout {...headerProps}>
          <LegacyAdmin />
        </IntegratedAppLayout>
      ) : null}
      {page === "settings" ? (
        <IntegratedAppLayout {...headerProps}>
          <LegacySettings />
        </IntegratedAppLayout>
      ) : null}
      {showNew ? <div className="releaseops-light-app"><LegacyNewCheck onClose={() => setShowNew(false)} onComplete={(id) => { setShowNew(false); fetchSessions().then(() => openSession(id)); }} /></div> : null}
      {showGuide ? <div className="releaseops-light-app"><LegacyGuidePanel onClose={() => setShowGuide(false)} /></div> : null}
      </>
      ) : null}
      {authMode ? <AuthModal mode={authMode} onClose={() => setAuthMode(null)} onModeChange={setAuthMode} /> : null}
    </div>
  );
}
