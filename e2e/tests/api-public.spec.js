/**
 * E2E tests for all public API endpoints (no auth).
 */

import { test, expect } from '@playwright/test';
import { apiFetch } from '../helpers/api.js';

test.describe('Health', () => {
  test('GET /actuator/health returns UP', async () => {
    const res = await apiFetch('/actuator/health');
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.status).toBe('UP');
  });
});

test.describe('Config', () => {
  test('GET /api/config/auth returns auth config', async () => {
    const res = await apiFetch('/api/config/auth');
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(typeof body.authEnabled).toBe('boolean');
    expect(['oidc', 'password'].includes(body.authMethod)).toBe(true);
  });
});

test.describe('Tracks (public)', () => {
  test('GET /api/tracks returns paginated items', async () => {
    const res = await apiFetch('/api/tracks?limit=5&offset=0');
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe('number');
    expect(typeof body.page).toBe('number');
    expect(typeof body.size).toBe('number');
  });

  test('GET /api/tracks/search returns results for query', async () => {
    const res = await apiFetch('/api/tracks/search?q=test&size=5');
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
  });
});

test.describe('Artists (public)', () => {
  test('GET /api/artists returns paginated list', async () => {
    const res = await apiFetch('/api/artists?limit=5&offset=0');
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe('number');
  });

  test('GET /api/artists/search returns results', async () => {
    const res = await apiFetch('/api/artists/search?q=a&size=5');
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
  });
});

test.describe('Albums (public)', () => {
  test('GET /api/albums returns paginated list', async () => {
    const res = await apiFetch('/api/albums?limit=5&offset=0');
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe('number');
  });

  test('GET /api/albums/search returns results', async () => {
    const res = await apiFetch('/api/albums/search?q=a&size=5');
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
  });
});

test.describe('Styles (public)', () => {
  test('GET /api/styles/tree returns style tree', async () => {
    const res = await apiFetch('/api/styles/tree');
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('GET /api/styles/keywords returns keywords', async () => {
    const res = await apiFetch('/api/styles/keywords');
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});

test.describe('Stats (public)', () => {
  test('GET /api/stats returns library stats', async () => {
    const res = await apiFetch('/api/stats');
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body).toBeDefined();
    expect(typeof body.totalTracks === 'number' || body.totalTracks === undefined).toBe(true);
  });
});

test.describe('Discovery (public)', () => {
  test('GET /api/discovery/popular returns list', async () => {
    const res = await apiFetch('/api/discovery/popular?limit=5');
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('GET /api/discovery/recent returns list', async () => {
    const res = await apiFetch('/api/discovery/recent?limit=5');
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('GET /api/discovery/curated returns list', async () => {
    const res = await apiFetch('/api/discovery/curated?limit=5');
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('GET /api/discovery/by-style returns style overview', async () => {
    const res = await apiFetch('/api/discovery/by-style');
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('GET /api/discovery/playlists returns curated playlists', async () => {
    const res = await apiFetch('/api/discovery/playlists');
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});
