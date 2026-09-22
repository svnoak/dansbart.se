import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getSpotifyArtistAlbums,
  getSpotifyAlbumTracks,
  ingestSpotifyAlbum,
  ingestSpotifyTrack,
} from '@/api/generated/spotify-ingest/spotify-ingest';

describe('spotifyIngestUrls', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('[]', { status: 200 }))));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getSpotifyArtistAlbums should use /api/spotify/ path', async () => {
    await getSpotifyArtistAlbums('test-id');

    const fetchCalls = vi.mocked(global.fetch).mock.calls;
    expect(fetchCalls.length).toBe(1);
    const urlCalled = String(fetchCalls[0][0]);
    expect(urlCalled).toContain('/api/spotify/');
    expect(urlCalled).not.toContain('/api/admin/');
  });

  it('getSpotifyAlbumTracks should use /api/spotify/ path', async () => {
    await getSpotifyAlbumTracks('test-id');

    const fetchCalls = vi.mocked(global.fetch).mock.calls;
    expect(fetchCalls.length).toBe(1);
    const urlCalled = String(fetchCalls[0][0]);
    expect(urlCalled).toContain('/api/spotify/');
    expect(urlCalled).not.toContain('/api/admin/');
  });

  it('ingestSpotifyAlbum should use /api/spotify/ path', async () => {
    await ingestSpotifyAlbum({ spotifyAlbumId: 'test-id' });

    const fetchCalls = vi.mocked(global.fetch).mock.calls;
    expect(fetchCalls.length).toBe(1);
    const urlCalled = String(fetchCalls[0][0]);
    expect(urlCalled).toContain('/api/spotify/');
    expect(urlCalled).not.toContain('/api/admin/');
  });

  it('ingestSpotifyTrack should use /api/spotify/ path', async () => {
    await ingestSpotifyTrack({ spotifyTrackId: 'test-id' });

    const fetchCalls = vi.mocked(global.fetch).mock.calls;
    expect(fetchCalls.length).toBe(1);
    const urlCalled = String(fetchCalls[0][0]);
    expect(urlCalled).toContain('/api/spotify/');
    expect(urlCalled).not.toContain('/api/admin/');
  });
});
