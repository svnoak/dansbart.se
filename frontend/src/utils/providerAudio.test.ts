import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAudioBlob, ProviderAuthError, ProviderGoneError } from './providerAudio';

function mockFetch(status: number, body = 'audio') {
  const fetchMock = vi.fn().mockResolvedValue(new Response(body, { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('fetchAudioBlob', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the Bearer header and returns a blob', async () => {
    const fetchMock = mockFetch(200);
    const blob = await fetchAudioBlob('https://example.com/file', 'token-1');
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/file', {
      headers: { Authorization: 'Bearer token-1' },
    });
    expect(await blob.text()).toBe('audio');
  });

  it('sends the Range header when asked', async () => {
    const fetchMock = mockFetch(206);
    await fetchAudioBlob('https://example.com/file', 'token-1', { range: 'bytes=0-1023' });
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/file', {
      headers: { Authorization: 'Bearer token-1', Range: 'bytes=0-1023' },
    });
  });

  it('throws ProviderAuthError on 401 and 403', async () => {
    mockFetch(401);
    await expect(fetchAudioBlob('u', 't')).rejects.toBeInstanceOf(ProviderAuthError);
    mockFetch(403);
    await expect(fetchAudioBlob('u', 't')).rejects.toBeInstanceOf(ProviderAuthError);
  });

  it('throws ProviderGoneError on 404', async () => {
    mockFetch(404);
    await expect(fetchAudioBlob('u', 't')).rejects.toBeInstanceOf(ProviderGoneError);
  });
});
