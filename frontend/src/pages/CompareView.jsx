/* ReleaseOps v3 — Compare View Page (Tailwind) */

import { Badge, Card, Button, CircularScore, Label } from "../components/ui";

export default function CompareView({ sessions = [], idA, idB, onBack }) {
  const a = sessions.find((s) => s.id === idA);
  const b = sessions.find((s) => s.id === idB);
  if (!a || !b) return null;

  return (
    <div className="max-w-[960px] mx-auto pt-5">
      <div className="flex items-center gap-2.5 mb-5 animate-fade-up">
        <Button variant="ghost" size="xs" onClick={onBack}>← Back</Button>
        <h1 className="text-xl font-extrabold text-tx">⚡ Session Comparison</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 animate-fade-up-1">
        {[a, b].map((s, i) => (
          <Card key={i}>
            <div className="flex items-center gap-1.5 mb-3">
              <span className="text-lg">{s.icon}</span>
              <div>
                <div className="text-base font-bold text-tx">{s.title}</div>
                <div className="text-xs text-tx-4">{s.date}</div>
              </div>
            </div>
            <div className="text-center mb-3"><CircularScore score={s.st.score} size={70} /></div>
            <div className="grid grid-cols-4 gap-1.5 mb-3">
              {[{ l: "Risks", v: s.st.risks, c: "text-accent-orange" }, { l: "Tests", v: s.st.tests, c: "text-accent-teal" }, { l: "Guards", v: s.st.guard, c: "text-accent-purple2" }, { l: "Check", v: s.st.check, c: "text-accent-green" }].map((x, j) => (
                <div key={j} className="text-center p-1.5 bg-lg-sf2 rounded-md">
                  <div className={`text-base font-extrabold ${x.c}`}>{x.v}</div>
                  <div className="text-xs text-tx-4">{x.l}</div>
                </div>
              ))}
            </div>
            <Label>EU Tier</Label>
            <Badge color={s.euTier === "High-Risk" ? "rd" : "or"} size="xs">{s.euTier}</Badge>
            <Label className="mt-3">Risks</Label>
            {s.risks.map((r, j) => (
              <div key={j} className="text-xs text-tx-2 py-0.5">{r.id}: {r.n} — <span className={r.s === "High" ? "text-accent-red" : "text-accent-orange"}>{r.s}</span></div>
            ))}
            <Label className="mt-3">Sign-offs</Label>
            {s.signoffs.map((so, j) => (
              <div key={j} className="text-xs text-tx-2 py-0.5">{so.role}: <span className={so.status === "approved" ? "text-accent-green" : so.status === "rejected" ? "text-accent-red" : "text-accent-orange"}>{so.status}</span></div>
            ))}
          </Card>
        ))}
      </div>

      {/* Score diff */}
      <Card className="mt-3.5 animate-fade-up-2">
        <Label>Score Difference</Label>
        <div className="flex items-center justify-center gap-5">
          <div className="text-center">
            <div className={`text-2xl font-extrabold ${a.st.score >= b.st.score ? "text-accent-green" : "text-accent-red"}`}>{a.st.score}</div>
            <div className="text-xs text-tx-4">{a.title.slice(0, 20)}...</div>
          </div>
          <div className="text-xl text-tx-3">vs</div>
          <div className="text-center">
            <div className={`text-2xl font-extrabold ${b.st.score >= a.st.score ? "text-accent-green" : "text-accent-red"}`}>{b.st.score}</div>
            <div className="text-xs text-tx-4">{b.title.slice(0, 20)}...</div>
          </div>
          <div className="px-4 py-2 bg-lg-sf2 rounded-lg">
            <div className={`text-base font-extrabold ${a.st.score - b.st.score > 0 ? "text-accent-green" : a.st.score - b.st.score < 0 ? "text-accent-red" : "text-tx"}`}>
              {a.st.score - b.st.score > 0 ? "+" : ""}{a.st.score - b.st.score}
            </div>
            <div className="text-xs text-tx-4">delta</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
