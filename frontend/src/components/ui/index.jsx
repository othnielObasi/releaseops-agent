/* ReleaseOps v3 — Reusable UI Primitives (Tailwind) */

const palette = {
  gn: ["bg-accent-green/10", "text-accent-green2"],
  pr: ["bg-accent-purple/10", "text-accent-purple2"],
  rd: ["bg-accent-red/10", "text-accent-red2"],
  or: ["bg-accent-orange/10", "text-accent-orange2"],
  bl: ["bg-accent-blue/10", "text-accent-blue2"],
  tl: ["bg-accent-teal/10", "text-accent-teal"],
  pk: ["bg-accent-pink/10", "text-accent-pink"],
};

const sizeMap = {
  xs: "text-xs px-2 py-0.5",
  sm: "text-sm px-2.5 py-1",
  lg: "text-sm px-3.5 py-1.5",
};

// ── Badge ──
export function Badge({ children, color = "gn", size = "sm", className = "" }) {
  const [bg, fg] = palette[color] || palette.gn;
  return (
    <span className={`${bg} ${fg} ${sizeMap[size] || sizeMap.sm} rounded-md font-semibold whitespace-nowrap inline-flex items-center gap-1 ${className}`}>
      {children}
    </span>
  );
}

// ── Card ──
export function Card({ children, className = "", onClick }) {
  return (
    <div
      onClick={onClick}
      className={`card-glow p-5 ${onClick ? "cursor-pointer hover:border-accent-purple/20" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

// ── Button ──
const btnBase = "inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold font-sans transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-default focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple/40";

const btnVariants = {
  primary: "bg-accent-purple hover:bg-accent-purple/80 text-white shadow-lg shadow-accent-purple/20 hover:shadow-accent-purple/30",
  cta: "bg-gradient-to-r from-accent-purple to-accent-blue text-white shadow-lg shadow-accent-purple/25 hover:shadow-accent-purple/40 hover:brightness-110",
  danger: "bg-transparent text-accent-red2 border border-accent-red/25 hover:bg-accent-red/10",
  success: "bg-accent-green/15 text-accent-green2 border border-accent-green/25 hover:bg-accent-green/25",
  ghost: "bg-transparent text-tx-2 border border-lg-bd hover:bg-lg-sf2 hover:border-lg-bd2 hover:text-tx",
  default: "bg-lg-sf2 text-tx-2 border border-lg-bd hover:bg-lg-sf3 hover:text-tx",
};

const btnSizes = {
  xs: "text-xs px-3 py-1.5",
  sm: "text-sm px-4 py-2",
  md: "text-base px-5 py-2.5",
  lg: "text-base px-6 py-3",
};

export function Button({ children, variant = "default", size = "sm", onClick, disabled, className = "" }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${btnBase} ${btnVariants[variant] || btnVariants.default} ${btnSizes[size] || btnSizes.sm} ${className}`}
    >
      {children}
    </button>
  );
}

// ── Progress Bar ──
export function ProgressBar({ percent, color = "bg-accent-green", height = "h-1.5" }) {
  return (
    <div className={`flex-1 ${height} bg-lg-sf3 rounded-full overflow-hidden`}>
      <div className={`h-full ${color} rounded-full transition-all duration-1000 ease-out`} style={{ width: `${percent}%` }} />
    </div>
  );
}

// ── Circular Score ──
export function CircularScore({ score, size = 88 }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (score / 100) * c;
  const col = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : score >= 40 ? "#f59e0b" : "#ef4444";
  const grade = score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1d2234" strokeWidth={5} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={5} strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" className="transition-all duration-[1500ms] ease-out" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-extrabold leading-none" style={{ fontSize: size * 0.28, color: col }}>{score}</span>
        <span className="text-xs text-tx-4 font-bold mt-0.5">{grade}</span>
      </div>
    </div>
  );
}

// ── Section Label ──
export function Label({ children }) {
  return (
    <div className="text-sm font-bold text-tx-3 tracking-wide uppercase mb-3">{children}</div>
  );
}

// ── Spinner ──
export function Spinner({ size = 13, color = "#a78bfa" }) {
  return (
    <div
      className="rounded-full border-2 border-lg-sf3 animate-spin"
      style={{ width: size, height: size, borderTopColor: color }}
    />
  );
}
