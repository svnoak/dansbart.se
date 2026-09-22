import { describe, it, expect, afterEach, vi } from 'vitest';
import { httpClient, ApiError } from './http-client';

describe('httpClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws an ApiError with status 409 for a conflict response', async () => {
    vi.stubGlobal('fetch', async () =>
      new Response('{}', { status: 409, statusText: 'Conflict' })
    );

    await expect(httpClient('/test')).rejects.toBeInstanceOf(ApiError);
  });

  it('keeps the message text', async () => {
    vi.stubGlobal('fetch', async () =>
      new Response('{}', { status: 409, statusText: 'Conflict' })
    );

    await expect(httpClient('/test')).rejects.toThrow(
      /^Request failed: 409/
    );
  });
});
