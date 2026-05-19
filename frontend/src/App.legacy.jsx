/* ═══════════════════════════════════════════════════════════════
   ReleaseOps v3 — Main App (Tailwind)
   ═══════════════════════════════════════════════════════════════ */

import { useState, useEffect, useCallback } from "react";
import { Button } from "./components/ui";
import { auth as authAPI, sessions as sessionsAPI } from "./services/api";
import { transformSessionList, transformSession } from "./services/transform";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import ReviewsList from "./pages/ReviewsList";
import SessionDetail from "./pages/SessionDetail";
import CompareView from "./pages/CompareView";
import Admin from "./pages/Admin";
import Settings from "./pages/Settings";
import NewCheck from "./pages/NewCheck";
import GuidePanel from "./pages/GuidePanel";

export default function App() {
  const [page, setPage] = useState("landing");
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState(null);
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [compareA, setCompareA] = useState(null);
  const [compareB, setCompareB] = useState(null);
  const [sessions, setReviews] = useState([]);
  const [sessionsLoading, setReviewsLoading] = useState(false);

  const fetchReviews = useCallback(async () => {
    setReviewsLoading(true);
    try {
      const raw = await sessionsAPI.list();
      setReviews(transformSessionList(raw));
    } catch { /* ignore — user may not be authed yet */ }
    finally { setReviewsLoading(false); }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("releaseops_token");
    if (token) {
      authAPI.me().then((u) => {
        setUser(u);
        setAuthenticated(true);
        setPage("dash");
        fetchReviews();
      }).catch(() => { localStorage.removeItem("releaseops_token"); });
    }
  }, [fetchReviews]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      const res = authMode === "signup"
        ? await authAPI.signup(authForm.name, authForm.email, authForm.password)
        : await authAPI.login(authForm.email, authForm.password);
      localStorage.setItem("releaseops_token", res.token);
      setUser({ name: res.name, email: res.email, role: res.role });
      setAuthenticated(true);
      setAuthMode(null);
      setAuthForm({ name: "", email: "", password: "" });
      setPage("dash");
      fetchReviews();
    } catch (err) {
      setAuthError(err.message || "Authentication failed");
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("releaseops_token");
    setAuthenticated(false);
    setUser(null);
    setPage("landing");
  };

  const navigate = (p) => { setPage(p); setSessionId(null); setCompareA(null); setCompareB(null); };
  const openSession = (id) => { setSessionId(id); setPage("detail"); };
  const session = sessionId ? sessions.find((s) => s.id === sessionId) : null;
  const isAdmin = user?.role === "super_admin";

  const navItems = [
    { k: "dash", l: "Dashboard", i: "📊" },
    { k: "sessions", l: "Reviews", i: "📋" },
    ...(isAdmin ? [{ k: "admin", l: "Admin", i: "🔒" }] : []),
    { k: "settings", l: "Settings", i: "⚙" },
  ];

  return (
    <div className="min-h-screen bg-lg-bg font-sans text-tx relative">
      {/* Background mesh gradient */}
      <div className="fixed inset-0 bg-mesh-1 bg-mesh-2 bg-mesh-3 pointer-events-none" />

      {/* ── Navbar ── */}
      <nav className="glass-strong sticky top-0 z-50 px-4 py-2 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-1.5 cursor-pointer group" onClick={() => authenticated ? navigate("dash") : navigate("landing")}>
          <span className="text-accent-yellow text-sm group-hover:animate-pulse"></span>
          <span className="text-sm font-bold text-tx tracking-tight">ReleaseOps</span>
        </div>

        {authenticated ? (
          <>
            {/* Nav links — desktop */}
            <div className="hidden md:flex items-center gap-0.5">
              {navItems.map((n) => {
                const active = page === n.k || (n.k === "sessions" && (page === "detail" || page === "compare"));
                return (
                  <button
                    key={n.k}
                    onClick={() => navigate(n.k)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-sans transition-all duration-200 cursor-pointer border
                      ${active
                        ? n.k === "admin"
                          ? "bg-accent-orange/10 border-accent-orange/30 text-accent-orange2 font-semibold"
                          : "bg-lg-sf3 border-transparent text-tx font-semibold"
                        : "bg-transparent border-transparent text-tx-3 hover:text-tx hover:bg-lg-sf2"
                      }`}
                  >
                    <span className="text-xs">{n.i}</span>{n.l}
                  </button>
                );
              })}
              <Button variant="primary" size="xs" onClick={() => setShowNew(true)} className="ml-2">+ New Release Review</Button>
              <button
                onClick={() => setShowGuide((p) => !p)}
                className={`ml-1.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium font-sans transition-all duration-200 cursor-pointer border
                  ${showGuide
                    ? "bg-accent-purple border-accent-purple text-white"
                    : "bg-transparent border-lg-bd text-tx-3 hover:border-lg-bd2 hover:text-tx"
                  }`}
              >📖 Guide</button>
            </div>

            {/* Mobile nav */}
            <div className="flex md:hidden items-center gap-1">
              {navItems.slice(0, 2).map((n) => (
                <button key={n.k} onClick={() => navigate(n.k)} className="px-2 py-1 text-xs text-tx-3 hover:text-tx cursor-pointer font-sans">{n.i}</button>
              ))}
              <Button variant="primary" size="xs" onClick={() => setShowNew(true)}>+</Button>
            </div>

            {/* User */}
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-lg-sf2 border border-lg-bd">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-lg-bg ${isAdmin ? "bg-accent-orange" : "bg-accent-green"}`}
                >
                  {(user?.name || "U")[0].toUpperCase()}
                </div>
                <span className="text-xs text-tx">{user?.name || user?.email}</span>
                {isAdmin && <span className="text-xs text-accent-orange font-semibold">ADMIN</span>}
              </div>
              <Button variant="danger" size="xs" onClick={logout}>Sign out</Button>
            </div>
          </>
        ) : (
          <div className="flex gap-2">
            <Button variant="ghost" size="xs" onClick={() => { setAuthMode("login"); setAuthError(""); }}>Sign In</Button>
            <Button variant="primary" size="xs" onClick={() => { setAuthMode("signup"); setAuthError(""); }}>Sign Up Free →</Button>
          </div>
        )}
      </nav>

      {/* ── Auth Modal ── */}
      {authMode && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4" onClick={() => setAuthMode(null)}>
          <form
            onSubmit={handleAuth}
            onClick={(e) => e.stopPropagation()}
            className="border-gradient w-full max-w-sm animate-fade-up"
          >
            <div className="bg-lg-sf rounded-xl p-7 relative overflow-hidden">
              {/* Subtle glow behind form */}
              <div className="absolute -top-20 -right-20 w-40 h-40 bg-accent-purple/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-accent-blue/8 rounded-full blur-3xl pointer-events-none" />

              <div className="relative">
                <h2 className="text-lg font-bold text-tx">{authMode === "signup" ? "Create Account" : "Welcome Back"}</h2>
                <p className="text-sm text-tx-3 mt-1 mb-5">{authMode === "signup" ? "Start your first release check in 60 seconds." : "Sign in to ReleaseOps."}</p>

                {authError && (
                  <div className="bg-accent-red/10 border border-accent-red/25 rounded-lg px-3 py-2 mb-4 text-sm text-accent-red2">{authError}</div>
                )}

                {authMode === "signup" && (
                  <input type="text" placeholder="Full name" required value={authForm.name} onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })} className="input-glass mb-2" />
                )}
                <input type="email" placeholder="Email address" required value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} className="input-glass mb-2" />
                <input type="password" placeholder="Password (min 6 chars)" required minLength={6} value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} className="input-glass mb-4" />

                <Button variant="cta" size="md" className="w-full" disabled={authLoading}>
                  {authLoading ? "Please wait..." : (authMode === "signup" ? "Create Account" : "Sign In")}
                </Button>

                <div className="text-center mt-4 text-sm text-tx-3">
                  {authMode === "signup" ? "Already have an account?" : "Don't have an account?"}{" "}
                  <span className="text-accent-purple cursor-pointer font-semibold hover:underline" onClick={() => { setAuthMode(authMode === "signup" ? "login" : "signup"); setAuthError(""); }}>
                    {authMode === "signup" ? "Sign in" : "Sign up"}
                  </span>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ── Page Content ── */}
      <main className="relative z-10 px-4 pb-10 md:px-6">
        {page === "landing" && <Landing onLogin={() => { setAuthMode("signup"); setAuthError(""); }} />}
        {page === "dash" && <Dashboard sessions={sessions} loading={sessionsLoading} onNew={() => setShowNew(true)} onOpen={openSession} />}
        {page === "sessions" && <ReviewsList sessions={sessions} loading={sessionsLoading} onOpen={openSession} onNew={() => setShowNew(true)} onCompare={(a, b) => { setCompareA(a); setCompareB(b); setPage("compare"); }} />}
        {page === "detail" && sessionId && <SessionDetail sessionId={sessionId} fallback={session} onBack={() => navigate("sessions")} onOpenSession={openSession} onRefreshReviews={fetchReviews} />}
        {page === "compare" && compareA && compareB && <CompareView sessions={sessions} idA={compareA} idB={compareB} onBack={() => navigate("sessions")} />}
        {page === "admin" && isAdmin && <Admin />}
        {page === "settings" && <Settings />}
      </main>

      {/* ── Modals / Panels ── */}
      {showNew && <NewCheck onClose={() => setShowNew(false)} onComplete={(id) => { setShowNew(false); fetchReviews().then(() => openSession(id)); }} />}
      {showGuide && <GuidePanel onClose={() => setShowGuide(false)} />}

      {/* ── Footer ── */}
      <footer className="relative z-10 text-center py-3 border-t border-lg-bd text-xs text-tx-4">
         ReleaseOps v3 — Decision-support outputs require human review. Regulation data is not legal advice.
      </footer>
    </div>
  );
}
