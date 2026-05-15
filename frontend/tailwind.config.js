/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        lg: {
          bg: "#07080c",
          bg2: "#0c0e14",
          sf: "#11131b",
          sf2: "#171b27",
          sf3: "#1d2234",
          bd: "#1a1e30",
          bd2: "#252b42",
        },
        accent: {
          green: "#22c55e",
          green2: "#4ade80",
          purple: "#7c3aed",
          purple2: "#a78bfa",
          red: "#ef4444",
          red2: "#f87171",
          orange: "#f59e0b",
          orange2: "#fbbf24",
          blue: "#3b82f6",
          blue2: "#60a5fa",
          teal: "#14b8a6",
          pink: "#ec4899",
          yellow: "#eab308",
        },
        tx: {
          DEFAULT: "#f1f5f9",
          2: "#94a3b8",
          3: "#64748b",
          4: "#334155",
        },
      },
      fontFamily: {
        sans: ["Inter", "SF Pro Display", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "SF Mono", "monospace"],
      },
      animation: {
        "fade-up": "fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both",
        "fade-up-1": "fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.05s both",
        "fade-up-2": "fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.1s both",
        "fade-up-3": "fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.15s both",
        "fade-up-4": "fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.2s both",
        "fade-up-5": "fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.25s both",
        "glow-pulse": "glowPulse 3s ease-in-out infinite",
        "spin-slow": "spin 8s linear infinite",
        "shimmer": "shimmer 2s linear infinite",
        "float": "float 6s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 15px rgba(124,58,237,0.15)" },
          "50%": { boxShadow: "0 0 30px rgba(124,58,237,0.3)" },
        },
        shimmer: {
          from: { backgroundPosition: "-200% 0" },
          to: { backgroundPosition: "200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "hero-glow": "radial-gradient(ellipse 60% 50% at 50% -10%, rgba(124,58,237,0.15), transparent)",
        "mesh-1": "radial-gradient(at 20% 30%, rgba(124,58,237,0.08) 0, transparent 50%)",
        "mesh-2": "radial-gradient(at 80% 20%, rgba(34,197,94,0.06) 0, transparent 50%)",
        "mesh-3": "radial-gradient(at 50% 80%, rgba(59,130,246,0.06) 0, transparent 50%)",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
}

