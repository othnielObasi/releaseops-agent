/* ReleaseOps v3 — Guide Panel (Tailwind) */

import { Label } from "../components/ui";

export default function GuidePanel({ onClose }) {
  return (
    <div className="fixed top-0 right-0 bottom-0 w-[360px] bg-lg-sf border-l border-lg-bd z-[150] overflow-auto px-5 py-[18px] shadow-[-6px_0_24px_rgba(0,0,0,.4)]">
      <div className="flex justify-between items-center mb-[18px]">
        <div className="text-base font-bold text-tx">Guide</div>
        <button onClick={onClose} className="bg-transparent border-none text-tx-3 text-base cursor-pointer hover:text-tx">×</button>
      </div>

      {/* Quick Start */}
      <Label>Quick Start</Label>
      {[
        { n: 1, t: "Click + New Release Review", d: "From anywhere in the app." },
        { n: 2, t: "Describe the AI workflow", d: "Include data access, actions, users, and production context." },
        { n: 3, t: "Watch the review pipeline", d: "Release Analysis, Validation Planning, and Decision Packaging." },
        { n: 4, t: "Explore results", d: "6 tabs: Overview, Spec & Risks, Tests, Docs, Regulation, Governance." },
      ].map((s, i) => (
        <div key={i} className="flex gap-2 mb-2.5">
          <div className="w-5 h-5 rounded-full bg-accent-purple/10 border border-accent-purple/30 flex items-center justify-center text-accent-purple2 text-xs font-bold shrink-0">{s.n}</div>
          <div>
            <div className="text-sm font-semibold text-tx">{s.t}</div>
            <div className="text-xs text-tx-3 mt-px">{s.d}</div>
          </div>
        </div>
      ))}

      <div className="h-px bg-lg-bd my-3.5" />

      {/* Agents */}
      <Label>Review Stages</Label>
      {[
        { n: "Release Analysis", c: "border-accent-green text-accent-green", o: ["Release spec", "Risk register", "Checklist"] },
        { n: "Validation Planning", c: "border-accent-purple2 text-accent-purple2", o: ["Test strategy", "Test cases", "Guardrails"] },
        { n: "Decision Packaging", c: "border-accent-orange2 text-accent-orange2", o: ["Release notes", "Decision record", "Stakeholder summary"] },
      ].map((a, i) => (
        <div key={i} className={`p-2 bg-lg-sf2 rounded-md border-l-[3px] ${a.c.split(" ")[0]} mb-1.5`}>
          <div className={`text-sm font-bold ${a.c.split(" ")[1]}`}>{a.n}</div>
          {a.o.map((o, j) => <div key={j} className="text-xs text-tx-3 mt-px">- {o}</div>)}
        </div>
      ))}

      <div className="h-px bg-lg-bd my-3.5" />

      {/* Regulation Engine */}
      <Label>Regulation Engine</Label>
      <div className="text-xs text-tx-2 leading-relaxed">
        Maps risks to 7 frameworks: EU AI Act, OWASP Top 10 LLM, NIST AI RMF, ISO 42001, GDPR, SOC 2, HIPAA.
        EU tiering is one lens; the full crosswalk covers security, privacy, management, audit, and sector controls.
      </div>

      <div className="h-px bg-lg-bd my-3.5" />

      {/* Governance */}
      <Label>Governance</Label>
      {[
        { l: "Sign-offs", d: "PM, Legal, QA, Security approvals" },
        { l: "Gates", d: "CI/CD + PR score threshold enforcement" },
        { l: "Certificates", d: "Auditor-ready PDF with all evidence" },
        { l: "Drift Monitor", d: "Weekly re-scan for regression" },
        { l: "Compare", d: "Side-by-side session diff" },
      ].map((a, i) => (
        <div key={i} className={`flex justify-between py-1 ${i < 4 ? "border-b border-lg-bd" : ""}`}>
          <span className="text-xs text-tx">{a.l}</span>
          <span className="text-xs text-tx-4">{a.d}</span>
        </div>
      ))}
    </div>
  );
}
