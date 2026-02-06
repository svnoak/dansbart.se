/**
 * E2E tests for admin API (auth + read-only admin endpoints).
 */

import { test, expect } from '@playwright/test';
import { apiFetch, getAdminToken, apiFetchWithAuth } from '../helpers/api.js';

test.describe('Admin auth', () => {
  test('POST /api/admin/auth/login returns token with correct password', async () => {
    const res = await apiFetch('/api/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password: process.env.ADMIN_PASSWORD || '123' }),
    });
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.token).toBeDefined();
    expect(typeof body.token).toBe('string');
  });

  test('POST /api/admin/auth/login rejects wrong password', async () => {
    const res = await apiFetch('/api/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password: 'wrong-password' }),
    });
    expect(res.status).toBe(401);
  });

  test('protected admin endpoint returns 401 or 403 without token', async () => {
    const res = await apiFetch('/api/admin/tracks');
    expect([401, 403]).toContain(res.status);
  });

  test('GET /api/admin/auth/verify returns valid with token', async () => {
    const token = await getAdminToken();
    const res = await apiFetch('/api/admin/auth/verify', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.valid).toBe(true);
  });
});

test.describe('Admin endpoints (authenticated)', () => {
  let authFetch;

  test.beforeAll(async () => {
    const token = await getAdminToken();
    authFetch = apiFetchWithAuth(token);
  });

  test('GET /api/admin/tracks returns list', async () => {
    const res = await authFetch('/api/admin/tracks?limit=5&offset=0');
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe('number');
  });

  test('GET /api/admin/artists returns list', async () => {
    const res = await authFetch('/api/admin/artists?limit=5&offset=0');
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe('number');
  });

  test('GET /api/admin/maintenance/isrc-stats returns stats', async () => {
    const res = await authFetch('/api/admin/maintenance/isrc-stats');
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(typeof body.total_tracks).toBe('number');
    expect(typeof body.with_isrc).toBe('number');
  });

  test('GET /api/admin/spider/stats returns crawl stats', async () => {
    const res = await authFetch('/api/admin/spider/stats');
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body).toBeDefined();
  });

  test('GET /api/admin/spider/history returns list', async () => {
    const res = await authFetch('/api/admin/spider/history?limit=5&offset=0');
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe('number');
  });

  test('GET /api/admin/rejections returns list', async () => {
    const res = await authFetch('/api/admin/rejections?limit=5&offset=0');
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
  });

  test('GET /api/admin/pending-artists returns list', async () => {
    const res = await authFetch('/api/admin/pending-artists?limit=5&offset=0');
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
  });

  test('GET /api/admin/style-keywords returns list', async () => {
    const res = await authFetch('/api/admin/style-keywords?limit=5&offset=0');
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
  });

  test('GET /api/admin/style-keywords/stats returns stats', async () => {
    const res = await authFetch('/api/admin/style-keywords/stats');
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body).toBeDefined();
  });

  test('GET /api/admin/analytics/dashboard returns data', async () => {
    const res = await authFetch('/api/admin/analytics/dashboard');
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body).toBeDefined();
  });
});
