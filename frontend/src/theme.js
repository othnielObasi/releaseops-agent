/* ═══════════════════════════════════════════════════════════════
   LaunchGuard v3 — Design Tokens & Global Styles
   ═══════════════════════════════════════════════════════════════ */

export const T = {
  bg: "#07080c", bg2: "#0c0e14",
  sf: "#11131b", sf2: "#171b27", sf3: "#1d2234",
  bd: "#1a1e30", bd2: "#252b42",
  gn: "#22c55e", gn2: "#4ade80",
  gnA: "rgba(34,197,94,.10)", gnA2: "rgba(34,197,94,.22)",
  pr: "#7c3aed", pr2: "#a78bfa",
  prA: "rgba(124,58,237,.10)",
  rd: "#ef4444", rd2: "#f87171",
  rdA: "rgba(239,68,68,.10)",
  or: "#f59e0b", or2: "#fbbf24",
  orA: "rgba(245,158,11,.10)",
  bl: "#3b82f6", bl2: "#60a5fa",
  blA: "rgba(59,130,246,.10)",
  tl: "#14b8a6", tlA: "rgba(20,184,166,.10)",
  pk: "#ec4899", pkA: "rgba(236,72,153,.10)",
  yl: "#eab308",
  tx: "#f1f5f9", tx2: "#94a3b8", tx3: "#64748b", tx4: "#334155",
};

export const FONT_SANS = `'Inter','SF Pro Display',system-ui,sans-serif`;
export const FONT_MONO = `'JetBrains Mono','SF Mono',monospace`;

export const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
* { box-sizing: border-box; margin: 0; padding: 0; }
::-webkit-scrollbar { width: 5px; }
::-webkit-scrollbar-thumb { background: ${T.bd2}; border-radius: 3px; }
::-webkit-scrollbar-track { background: transparent; }
input::placeholder, textarea::placeholder { color: ${T.tx4}; }
@keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes glow { 0%,100% { box-shadow: 0 0 8px rgba(124,58,237,.12); } 50% { box-shadow: 0 0 20px rgba(124,58,237,.25); } }
.fu { animation: fadeUp .45s cubic-bezier(.16,1,.3,1) both; }
.s1 { animation-delay: .04s; }
.s2 { animation-delay: .08s; }
.s3 { animation-delay: .12s; }
.s4 { animation-delay: .16s; }
.s5 { animation-delay: .2s; }
.s6 { animation-delay: .24s; }
`;
