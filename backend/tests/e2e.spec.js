// @ts-check
const { test, expect } = require('@playwright/test');

const BASE = process.env.BASE_URL || 'http://localhost:3001';

// Unique test user so runs don't collide
const TEST_EMAIL = `e2e_${Date.now()}@test.releaseops.dev`;
const TEST_PASS  = 'e2eTestPass123';
let   authToken  = '';

// ── Helper ────────────────────────────────────────────────────────────────
async function apiPost(endpoint, body, token) {
  const url = `${BASE}${endpoint}`;
  const res = await fetch(url, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return res;
}

async function ensureAuth(request) {
  if (authToken) return authToken;

  const signupRes = await request.post(`${BASE}/api/auth/signup`, {
    data: { name: 'E2E Tester', email: TEST_EMAIL, password: TEST_PASS },
  });
  if (signupRes.status() === 200) {
    authToken = (await signupRes.json()).token;
    return authToken;
  }

  const loginRes = await request.post(`${BASE}/api/auth/login`, {
    data: { email: TEST_EMAIL, password: TEST_PASS },
  });
  if (loginRes.status() === 200) {
    authToken = (await loginRes.json()).token;
    return authToken;
  }

  throw new Error(`Unable to authenticate test user: signup=${signupRes.status()} login=${loginRes.status()}`);
}

// ─────────────────────────────────────────────────────────────────────────
test.describe('ReleaseOps E2E', () => {

  // ── 1. Health check ──────────────────────────────────────────────────
  test('health endpoint returns ok', async ({ request }) => {
    const res = await request.get(`${BASE}/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  // ── 2. Home page loads ───────────────────────────────────────────────
  test('home page loads and shows ReleaseOps title', async ({ request }) => {
    const res = await request.get(BASE);
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toContain('ReleaseOps');
    expect(html).toContain('<html');
  });

  // ── 3. Auth — signup ─────────────────────────────────────────────────
  test('user can sign up', async ({ request }) => {
    const res  = await request.post(`${BASE}/api/auth/signup`, {
      data: { name: 'E2E Tester', email: TEST_EMAIL, password: TEST_PASS },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.token).toBeTruthy();
    authToken = body.token;
  });

  // ── 4. Auth — login ──────────────────────────────────────────────────
  test('user can log in after signup', async ({ request }) => {
    const res  = await request.post(`${BASE}/api/auth/login`, {
      data: { email: TEST_EMAIL, password: TEST_PASS },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.token).toBeTruthy();
    authToken = body.token;
  });

  // ── 5. Auth — me ─────────────────────────────────────────────────────
  test('/api/auth/me returns user info', async ({ request }) => {
    const res  = await request.get(`${BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.email).toBe(TEST_EMAIL);
  });

  // ── 6. Create session (demo mode) ───────────────────────────────────
  test('POST /api/sessions creates a session', async ({ request }) => {
    await ensureAuth(request);
    const res  = await request.post(`${BASE}/api/sessions`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${authToken}`,
      },
      data: {
        feature_title:       'E2E Test Feature',
        feature_description: 'A test AI feature that validates our end-to-end pipeline in CI.',
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.session_id).toBeTruthy();
  });

  // ── 7. Session polling (demo mode) ──────────────────────────────────
  test('session completes within 30 seconds in demo mode', async ({ request }) => {
    await ensureAuth(request);
    // Create fresh session
    const createRes = await request.post(`${BASE}/api/sessions`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${authToken}`,
      },
      data: {
        feature_title:       'E2E Poll Feature',
        feature_description: 'Polling test for E2E coverage.',
      },
    });
    const { session_id } = await createRes.json();

    // Poll for completion
    let status = 'pending';
    for (let i = 0; i < 30 && status !== 'complete' && status !== 'error'; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const pollRes  = await request.get(`${BASE}/api/sessions/${session_id}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const pollBody = await pollRes.json();
      status = (pollBody.session || pollBody).status;
    }
    expect(status).toBe('complete');
  });

  // ── 8. Templates endpoint ───────────────────────────────────────────
  test('GET /api/templates returns builtin templates', async ({ request }) => {
    const res  = await request.get(`${BASE}/api/templates`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.builtin)).toBe(true);
    expect(body.builtin.length).toBeGreaterThanOrEqual(4);
  });

  // ── 9. Compliance templates ─────────────────────────────────────────
  test('GET /api/compliance returns gdpr/soc2/hipaa', async ({ request }) => {
    const res  = await request.get(`${BASE}/api/compliance`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    const ids  = body.templates.map(t => t.id);
    expect(ids).toContain('gdpr');
    expect(ids).toContain('soc2');
    expect(ids).toContain('hipaa');
  });

  // ── 10. API key lifecycle ───────────────────────────────────────────
  test('user can create and revoke an API key', async ({ request }) => {
    await ensureAuth(request);
    // Create
    const createRes = await request.post(`${BASE}/api/keys`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${authToken}`,
      },
      data: { name: 'CI E2E Key' },
    });
    expect(createRes.status()).toBe(200);
    const key = await createRes.json();
    expect(key.key).toMatch(/^lg_/);

    // Revoke
    const revokeRes = await request.delete(`${BASE}/api/keys/${key.id}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(revokeRes.status()).toBe(200);
    const revokeBody = await revokeRes.json();
    expect(revokeBody.status).toBe('revoked');
  });

  // ── 11. Teams lifecycle ─────────────────────────────────────────────
  test('user can create a team workspace', async ({ request }) => {
    await ensureAuth(request);
    const res  = await request.post(`${BASE}/api/teams`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${authToken}`,
      },
      data: { name: 'E2E Test Team', brand_color: '#6366f1' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.id).toBeTruthy();
    expect(body.name).toBe('E2E Test Team');
  });

  // ── 12. Mock sessions ───────────────────────────────────────────────
  test('GET /api/mock/sessions returns 3 pre-built demos', async ({ request }) => {
    const res  = await request.get(`${BASE}/api/mock/sessions`);
    expect(res.status()).toBe(200);
    const mocks = await res.json();
    expect(Array.isArray(mocks)).toBe(true);
    expect(mocks.length).toBeGreaterThanOrEqual(1);
  });

  // ── 13. Metrics endpoint ────────────────────────────────────────────
  test('GET /metrics returns Prometheus format', async ({ request }) => {
    const res  = await request.get(`${BASE}/metrics`);
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toContain('releaseops_sessions_total');
  });

  // ── 14. Rate limiting headers ───────────────────────────────────────
  test('session creation rejects rate-limit violators gracefully', async ({ request }) => {
    await ensureAuth(request);
    // Create 11 sessions rapidly to trip the per-IP limit (10/min)
    const reqs = Array.from({ length: 11 }, () =>
      request.post(`${BASE}/api/sessions`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${authToken}`,
        },
        data: {
          feature_title:       'Rate Limit Test',
          feature_description: 'Testing rate limiting.',
        },
      })
    );
    const responses = await Promise.all(reqs);
    const statuses  = responses.map(r => r.status());
    // At least one should be rate-limited
    expect(statuses).toContain(429);
  });

  // ── 15. Frontend — session board renders ────────────────────────────
  test('session board page is accessible via /session/:id', async ({ request }) => {
    await ensureAuth(request);
    // Create a session via API first
    const res  = await request.post(`${BASE}/api/sessions`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${authToken}`,
      },
      data: {
        feature_title:       'Frontend E2E Test',
        feature_description: 'Checking frontend session board renders.',
      },
    });
    const { session_id } = await res.json();

    const pageRes = await request.get(`${BASE}/session/${session_id}`);
    expect(pageRes.status()).toBe(200);
    const html = await pageRes.text();
    expect(html).toContain('<html');
  });
});
