/* ReleaseOps v3 — Pipeline Visualization (Tailwind) */

import { useState, useEffect } from "react";
import { Badge, Spinner } from "./ui";

const LOGS = [
  ["Parsing release description...", "Extracting domain context...", "Generating release spec...", "Identifying personas and workflows...", "Scoring risks...", "Building checklist...", "Release analysis complete"],
  ["Analysing edge cases...", "Generating test strategy...", "Creating test cases...", "Defining guardrails...", "Validation planning complete"],
  ["Synthesising release notes...", "Preparing decision record...", "Building stakeholder summary...", "Decision packaging complete"],
];

const AGENTS = [
  { name: "Release Analysis", color: "accent-green", hex: "#22c55e" },
  { name: "Validation Planning", color: "accent-purple2", hex: "#c084fc" },
  { name: "Decision Packaging", color: "accent-orange2", hex: "#fb923c" },
];

export default function Pipeline({ phase, showLogs = false }) {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    if (!showLogs || phase < 0 || phase > 2) return;
    const lines = LOGS[phase] || [];
    let i = 0;
    const iv = setInterval(() => {
      if (i < lines.length) {
        setLogs((prev) => [...prev.slice(-10), { t: new Date().toISOString().slice(11, 19), m: lines[i], p: phase }]);
        i++;
      } else {
        clearInterval(iv);
      }
    }, 500);
    return () => clearInterval(iv);
  }, [phase, showLogs]);

  return (
    <div>
      <div className="flex items-center justify-center gap-0 py-3">
        {AGENTS.map((a, i) => {
          const done = phase > i;
          const active = phase === i;
          return (
            <div key={i} className="flex items-center">
              {i > 0 && <div className={`w-10 h-0.5 transition-all duration-400 ${done ? "bg-lg-bd2" : "bg-lg-bd"}`} />}
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${done ? `border-${a.color}/50 bg-${a.color}/5` : active ? `border-${a.color} bg-${a.color}/5 animate-glow-pulse` : "border-lg-bd bg-transparent"}`}>
                {done && <span className="text-accent-green text-sm font-bold">✓</span>}
                {active && <Spinner size={11} color={a.hex} />}
                <div className={`text-xs font-semibold ${done || active ? `text-${a.color}` : "text-tx-4"}`}>{a.name}</div>
              </div>
            </div>
          );
        })}
        {phase >= 3 && <Badge color="gn" className="ml-2.5">✓ COMPLETE</Badge>}
      </div>

      {showLogs && logs.length > 0 && (
        <div className="bg-lg-bg2 border border-lg-bd rounded-lg px-3 py-2 mt-1.5 max-h-[120px] overflow-auto font-mono text-sm">
          {logs.map((l, i) => (
            <div key={i} className={`py-0.5 ${l.p === 0 ? "text-accent-green" : l.p === 1 ? "text-accent-purple2" : "text-accent-orange2"} ${i === logs.length - 1 ? "opacity-100" : "opacity-50"}`}>
              <span className="text-tx-4 mr-2">{l.t}</span>{l.m}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
