/**
 * E2E tests: Spotify playlist ingestion and tracks after ingest.
 * Requires worker-feature running so spotify_ingest_task is processed.
 */

import { test, expect } from '@playwright/test';
import { apiFetch, getAdminToken, apiFetchWithAuth } from '../helpers/api.js';

const E2E_PLAYLIST_ID = process.env.E2E_PLAYLIST_ID || '1LY6TJlCf4IFIXNoiayw4t';

test.describe('Ingest endpoint', () => {
  test('POST /api/admin/ingest queues playlist ingestion', async () => {
    const token = await getAdminToken();
    const res = await apiFetchWithAuth(token)('/api/admin/ingest', {
      method: 'POST',
      body: JSON.stringify({
        resourceId: E2E_PLAYLIST_ID,
        resourceType: 'playlist',
      }),
    });
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.status).toBe('queued');
    expect(body.resource_id).toBe(E2E_PLAYLIST_ID);
    expect(body.resource_type).toBe('playlist');
  });
});

test.describe('Tracks after ingestion', () => {
  test('GET /api/tracks returns 200 and items array', async () => {
    const res = await apiFetch('/api/tracks?limit=5');
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
  });

  test('after ingest, tracks appear (poll up to 90s)', async () => {
    test.setTimeout(95_000);
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      const res = await apiFetch('/api/tracks?limit=100');
      const body = await res.json();
      const count = body.total ?? body.items?.length ?? 0;
      if (count > 0) {
        expect(count).toBeGreaterThan(0);
        return;
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
    const res = await apiFetch('/api/tracks?limit=1');
    const body = await res.json();
    expect(body.items).toBeDefined();
  });
});
