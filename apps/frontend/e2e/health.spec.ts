import { test, expect, request } from '@playwright/test';

/**
 * Backend health probe — verifies the API itself responds before the UI flows.
 * Doesn't need a browser, runs as a pure HTTP test.
 */
const API = process.env.E2E_API_URL || 'http://localhost:4000/api';

test.describe('Backend health', () => {
  test('GET /api/health → 200', async () => {
    const ctx = await request.newContext();
    const res = await ctx.get(`${API}/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  test('GET /api/health/ready → 200 with db up', async () => {
    const ctx = await request.newContext();
    const res = await ctx.get(`${API}/health/ready`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ready).toBe(true);
    expect(body.db).toBe('up');
  });

  test('GET /api/docs Swagger UI is served', async () => {
    const ctx = await request.newContext();
    const res = await ctx.get(`${API.replace(/\/api$/, '')}/api/docs`);
    // Swagger UI returns 200 + HTML
    expect(res.status()).toBe(200);
    expect((await res.text()).toLowerCase()).toContain('swagger');
  });
});
