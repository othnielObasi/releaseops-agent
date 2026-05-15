/* LaunchGuard v3 — Sessions List Page (Tailwind) */

import { useState } from "react";
import { Badge, Card, Button, CircularScore } from "../components/ui";

export default function SessionsList({ sessions = [], loading, onOpen, onNew, onCompare }) {
  const [filter, setFilter] = useState("all");
  const [compareMode, setCompareMode] = useState(false);
  const [selected, setSelected] = useState([]);

  const filtered = filter === "all" ? sessions : sessions.filter((s) => s.type === filter);

  const toggleSelect = (id) => {
    if (selected.includes(id)) setSelected(selected.filter((x) => x !== id));
    else if (selected.length < 2) setSelected([...selected, id]);
  };

  return (
    <div className="max-w-[960px] mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center pt-6 mb-4 animate-fade-up">
        <div>
          <h1 className="text-3xl font-extrabold text-tx">Sessions</h1>
          <p className="text-sm text-tx-3 mt-1">{sessions.length} checks</p>
        </div>
        <div className="flex gap-1.5">
          {compareMode && selected.length === 2 && (
            <Button variant="primary" size="sm" onClick={() => { onCompare(selected[0], selected[1]); setCompareMode(false); setSelected([]); }}>Compare Selected</Button>
          )}
          <Button variant={compareMode ? "danger" : "ghost"} size="sm" onClick={() => { setCompareMode(!compareMode); setSelected([]); }}>
            {compareMode ? "Cancel" : "⚡ Compare"}
          </Button>
          <Button variant="primary" size="sm" onClick={onNew}>+ New Check</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1 mb-3 animate-fade-up-1">
        {[{ k: "all", l: "All" }, { k: "live", l: "Live" }, { k: "demo", l: "Demos" }].map((f) => (
          <Button key={f.k} variant={filter === f.k ? "primary" : "ghost"} size="xs" onClick={() => setFilter(f.k)}>{f.l}</Button>
        ))}
      </div>

      {/* Table */}
      <div className="border border-lg-bd rounded-xl overflow-hidden">
        {/* Header Row */}
        <div className={`grid ${compareMode ? "grid-cols-[30px_2fr_70px_50px_50px_50px_70px_60px]" : "grid-cols-[2fr_70px_50px_50px_50px_70px_60px]"} px-3.5 py-2 bg-lg-sf2 border-b border-lg-bd`}>
          {compareMode && <div />}
          {["Session", "Score", "Risks", "Tests", "Guards", "Date", "Type"].map((h) => (
            <div key={h} className="text-xs font-bold text-tx-3 tracking-wide uppercase">{h}</div>
          ))}
        </div>

        {/* Rows */}
        {filtered.map((s, i) => (
          <div
            key={s.id}
            onClick={() => compareMode ? toggleSelect(s.id) : onOpen(s.id)}
            className={`grid ${compareMode ? "grid-cols-[30px_2fr_70px_50px_50px_50px_70px_60px]" : "grid-cols-[2fr_70px_50px_50px_50px_70px_60px]"} px-3.5 py-2.5 cursor-pointer transition-colors duration-150 hover:bg-lg-sf2 ${selected.includes(s.id) ? "bg-accent-purple/8" : ""} ${i < filtered.length - 1 ? "border-b border-lg-bd" : ""}`}
          >
            {/* Checkbox */}
            {compareMode && (
              <div className="flex items-center">
                <div className={`w-3.5 h-3.5 rounded-sm border-2 flex items-center justify-center text-xs text-white ${selected.includes(s.id) ? "border-accent-purple bg-accent-purple" : "border-lg-bd2 bg-transparent"}`}>
                  {selected.includes(s.id) && "✓"}
                </div>
              </div>
            )}
            {/* Session info */}
            <div className="flex items-center gap-1.5">
              <span className="text-sm">{s.icon}</span>
              <div>
                <div className="text-sm font-semibold text-tx">{s.title}</div>
                <div className="text-xs text-tx-3">{s.desc.slice(0, 50)}...</div>
              </div>
            </div>
            <div className="flex items-center"><CircularScore score={s.st.score} size={30} /></div>
            <div className="flex items-center text-sm font-semibold text-accent-orange">{s.st.risks}</div>
            <div className="flex items-center text-sm font-semibold text-accent-teal">{s.st.tests}</div>
            <div className="flex items-center text-sm font-semibold text-accent-purple2">{s.st.guard}</div>
            <div className="flex items-center text-xs text-tx-3 font-mono">{s.date.split(",")[0]}</div>
            <div className="flex items-center"><Badge color={s.type === "demo" ? "or" : "bl"} size="xs">{s.type}</Badge></div>
          </div>
        ))}
      </div>
    </div>
  );
}
