/* ═══════════════════════════════════════════════════════════════
   ReleaseOps v3 — API Service Layer
   Centralised fetch wrappers for backend communication.
   All requests proxy through Vite → localhost:3001.
   ═══════════════════════════════════════════════════════════════ */

const BASE = "/api";

/** Helper: fetch with JSON handling, auth header, and error normalisation */
async function request(path, options = {}) {
  const token = localStorage.getItem("releaseops_token");
  const headers = { ...options.headers };
  if (options.body !== undefined && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = res.status === 502
      ? "Backend API is unavailable. Start the backend on port 3001, then try again."
      : body.detail || `Request failed: ${res.status}`;
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

async function requestBlob(path, options = {}) {
  const token = localStorage.getItem("releaseops_token");
  const headers = { ...options.headers };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = res.status === 502
      ? "Backend API is unavailable. Start the backend on port 3001, then try again."
      : body.detail || `Request failed: ${res.status}`;
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }
  return res.blob();
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/* ── Auth ── */
export const auth = {
  login: (email, password) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  signup: (name, email, password) =>
    request("/auth/signup", { method: "POST", body: JSON.stringify({ name, email, password }) }),

  me: () => request("/auth/me"),
};

/* ── Sessions ── */
export const sessions = {
  list: () => request("/sessions"),

  get: (id) => request(`/sessions/${encodeURIComponent(id)}`),

  integrations: (id) => request(`/sessions/${encodeURIComponent(id)}/integrations`),

  saveIntegrations: (id, payload) =>
    request(`/sessions/${encodeURIComponent(id)}/integrations`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  create: (payload) =>
    request("/sessions", { method: "POST", body: JSON.stringify(payload) }),

  delete: (id) =>
    request(`/sessions/${encodeURIComponent(id)}`, { method: "DELETE" }),
};

/* ── Integration Defaults ── */
export const integrationSettings = {
  get: () => request("/integrations"),

  save: (payload) =>
    request("/integrations", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
};

/* ── Analysis (v2 pipeline) ── */
export const analysis = {
  run: (sessionId, body) =>
    request(`/sessions/${encodeURIComponent(sessionId)}/analyze`, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),

  status: (sessionId) =>
    request(`/sessions/${encodeURIComponent(sessionId)}`),

  results: (sessionId) =>
    request(`/sessions/${encodeURIComponent(sessionId)}/v2/summary`),
};

/* ── Versions ── */
export const versions = {
  list: (sessionId) =>
    request(`/sessions/${encodeURIComponent(sessionId)}/versions`),
};

/* ── Governance ── */
export const governance = {
  signoffs: (sessionId) =>
    request(`/sessions/${encodeURIComponent(sessionId)}/sign-offs`),

  signoff: (sessionId, payload) =>
    request(`/sessions/${encodeURIComponent(sessionId)}/sign-off`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateBlocker: (sessionId, blockerId, payload) =>
    request(`/sessions/${encodeURIComponent(sessionId)}/blockers/${encodeURIComponent(blockerId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  audit: (sessionId) =>
    request(`/sessions/${encodeURIComponent(sessionId)}/audit`),

  decision: (sessionId) =>
    request(`/sessions/${encodeURIComponent(sessionId)}/decision`),

  gates: () => request("/gates"),

  evaluateGate: (sessionId) =>
    request(`/sessions/${encodeURIComponent(sessionId)}/v2/summary`),
};

/* ── Teams ── */
export const teams = {
  list: () => request("/teams"),
  create: (name, brand_color) =>
    request("/teams", { method: "POST", body: JSON.stringify({ name, brand_color }) }),
  members: (teamId) => request(`/teams/${encodeURIComponent(teamId)}/members`),
  invite: (teamId, email, role = "member") =>
    request(`/teams/${encodeURIComponent(teamId)}/invite`, { method: "POST", body: JSON.stringify({ email, role }) }),
  addMember: (teamId, payload) =>
    request(`/teams/${encodeURIComponent(teamId)}/members`, { method: "POST", body: JSON.stringify(payload) }),
  updateMemberRole: (teamId, email, role) =>
    request(`/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(email)}`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),
  removeMember: (teamId, email) =>
    request(`/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(email)}`, { method: "DELETE" }),
  branding: (teamId) => request(`/teams/${encodeURIComponent(teamId)}/branding`),
  updateBranding: (teamId, data) =>
    request(`/teams/${encodeURIComponent(teamId)}/branding`, { method: "PATCH", body: JSON.stringify(data) }),
};

/* ── API Keys ── */
export const keys = {
  list: () => request("/keys"),
  create: (name) => request("/keys", { method: "POST", body: JSON.stringify({ name }) }),
  revoke: (keyId) => request(`/keys/${encodeURIComponent(keyId)}`, { method: "DELETE" }),
};

/* ── Gates ── */
export const gates = {
  list: () => request("/gates"),
  create: (payload) => request("/gates", { method: "POST", body: JSON.stringify(payload) }),
  evaluate: (gateId, sessionId) =>
    request(`/gates/${encodeURIComponent(gateId)}/evaluate`, { method: "POST", body: JSON.stringify({ session_id: sessionId }) }),
};

/* ── Admin ── */
export const admin = {
  users: () => request("/admin/users"),
  auditLog: (page = 0) => request(`/admin/login-history?page=${page}`),
  stats: () => request("/admin/stats"),
};

/* ── Evidence / Export ── */
export const exports = {
  evidencePack: async (sessionId) => {
    const blob = await requestBlob(`/sessions/${encodeURIComponent(sessionId)}/export/evidence`);
    triggerDownload(blob, `releaseops-${sessionId}-evidence.zip`);
    return true;
  },

  certificate: (sessionId) =>
    request(`/sessions/${encodeURIComponent(sessionId)}/certificate`, { method: "POST" }),

  share: (sessionId) =>
    request(`/sessions/${encodeURIComponent(sessionId)}/share`, { method: "POST" }),
};

/* ── Health ── */
export const health = () => request("/health");
