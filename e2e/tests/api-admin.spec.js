/**
 * E2E tests for admin API endpoints.
 * Requires SPRING_PROFILES_ACTIVE=local (auth bypassed).
 */

import { test, expect } from '@playwright/test';
import { apiFetch } from '../helpers/api.js';

test.describe('Admin endpoints', () => {
  test('GET /api/admin/tracks returns list', async () => {
    const res = await apiFetch('/api/admin/tracks?limit=5&offset=0');
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe('number');
  });

  test('GET /api/admin/artists returns list', async () => {
    const res = await apiFetch('/api/admin/artists?limit=5&offset=0');
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe('number');
  });

  test('GET /api/admin/maintenance/isrc-stats returns stats', async () => {
    const res = await apiFetch('/api/admin/maintenance/isrc-stats');
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(typeof body.total_tracks).toBe('number');
    expect(typeof body.with_isrc).toBe('number');
  });

  test('GET /api/admin/spider/stats returns crawl stats', async () => {
    const res = await apiFetch('/api/admin/spider/stats');
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body).toBeDefined();
  });

  test('GET /api/admin/spider/history returns list', async () => {
    const res = await apiFetch('/api/admin/spider/history?limit=5&offset=0');
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe('number');
  });

  test('GET /api/admin/rejections returns list', async () => {
    const res = await apiFetch('/api/admin/rejections?limit=5&offset=0');
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
  });

  test('GET /api/admin/pending-artists returns list', async () => {
    const res = await apiFetch('/api/admin/pending-artists?limit=5&offset=0');
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
  });

  test('GET /api/admin/style-keywords returns list', async () => {
    const res = await apiFetch('/api/admin/style-keywords?limit=5&offset=0');
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
  });

  test('GET /api/admin/analytics/dashboard returns data', async () => {
    const res = await apiFetch('/api/admin/analytics/dashboard');
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body).toBeDefined();
  });
});
