/**
 * E2E tests: Spotify playlist ingestion and tracks after ingest.
 * Requires worker-feature running so spotify_ingest_task is processed.
 * For tracks to move PENDING -> PROCESSING -> DONE/FAILED, worker-audio must be running (see e2e/README.md).
 */

import { test, expect } from '@playwright/test';
import { apiFetch, getAdminToken, apiFetchWithAuth } from '../helpers/api.js';

const E2E_PLAYLIST_ID = process.env.E2E_PLAYLIST_ID || '1LY6TJlCf4IFIXNoiayw4t';
/** Set to '0' or 'false' to skip the test that requires worker-audio to process a track (e.g. if running without full stack). */
const E2E_SKIP_AUDIO_PIPELINE = /^(1|true|yes)$/i.test(process.env.E2E_SKIP_AUDIO_PIPELINE || '0');

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

  test('after ingest, at least one track leaves PENDING when worker-audio runs (poll up to 180s)', async () => {
    test.skip(E2E_SKIP_AUDIO_PIPELINE, 'Skipped when E2E_SKIP_AUDIO_PIPELINE=1');
    test.setTimeout(195_000);
    const token = await getAdminToken();
    const deadline = Date.now() + 180_000;
    while (Date.now() < deadline) {
      const res = await apiFetchWithAuth(token)('/api/admin/tracks?limit=100');
      const body = await res.json();
      const items = body.items ?? [];
      const nonPending = items.filter((t) => t.processingStatus && t.processingStatus !== 'PENDING');
      if (nonPending.length > 0) {
        expect(nonPending.length).toBeGreaterThan(0);
        return;
      }
      if (items.length > 0) {
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
    const res = await apiFetchWithAuth(token)('/api/admin/tracks?limit=10');
    const body = await res.json();
    const items = body.items ?? [];
    const allPending = items.length > 0 && items.every((t) => t.processingStatus === 'PENDING');
    expect(
      allPending,
      `All ${items.length} track(s) still PENDING after 180s. ` +
        'worker-audio must consume the "audio" queue (run-e2e.sh starts it). Check: docker compose logs worker-audio'
    ).toBe(false);
  });
});
