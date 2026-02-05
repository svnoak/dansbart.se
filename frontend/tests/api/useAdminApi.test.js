/**
 * Tests for useAdminApi composable
 * Tests the fetchWithAuth function that uses tokens from useAdminAuth
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { server } from '../setup.js';
import { http, HttpResponse } from 'msw';
import { MOCK_ADMIN_TOKEN } from '../mocks/handlers.js';

// Mock useAdminAuth
const mockAccessToken = { value: null };
const mockLogout = vi.fn();
const mockRefreshToken = vi.fn().mockResolvedValue(false);

vi.mock('../../admin/shared/composables/useAdminAuth.js', () => ({
  useAdminAuth: () => ({
    accessToken: mockAccessToken,
    logout: mockLogout,
    refreshToken: mockRefreshToken,
  }),
}));

// Import useAdminApi
import { useAdminApi } from '../../admin/shared/composables/useAdminApi.js';

describe('useAdminApi', () => {
  beforeEach(() => {
    mockAccessToken.value = null;
    mockLogout.mockClear();
    mockRefreshToken.mockClear();
  });

  describe('fetchWithAuth', () => {
    it('should include Authorization header with token from useAdminAuth', async () => {
      mockAccessToken.value = MOCK_ADMIN_TOKEN;
      const { fetchWithAuth } = useAdminApi(mockAccessToken);

      const response = await fetchWithAuth('/api/admin/tracks');
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data.tracks).toBeDefined();
    });

    it('should handle missing token', async () => {
      mockAccessToken.value = null;
      const { fetchWithAuth } = useAdminApi(mockAccessToken);

      // fetchWithAuth throws an error on 403, so we need to catch it
      await expect(fetchWithAuth('/api/admin/tracks')).rejects.toThrow('Admin access required');
    });

    it('should handle 401 by attempting token refresh', async () => {
      mockAccessToken.value = 'expired-token';
      mockRefreshToken.mockResolvedValueOnce(true);
      mockAccessToken.value = MOCK_ADMIN_TOKEN; // Simulate refresh updating token

      // Override handler to return 401 first, then success
      let callCount = 0;
      server.use(
        http.get('/api/admin/tracks', ({ request }) => {
          callCount++;
          if (callCount === 1) {
            return HttpResponse.json(
              { detail: 'Unauthorized' },
              { status: 401 }
            );
          }
          return HttpResponse.json({ tracks: [] });
        })
      );

      const { fetchWithAuth } = useAdminApi(mockAccessToken);
      const response = await fetchWithAuth('/api/admin/tracks');

      expect(mockRefreshToken).toHaveBeenCalled();
      expect(response.ok).toBe(true);
    });

    it('should logout when token refresh fails', async () => {
      mockAccessToken.value = 'expired-token';
      mockRefreshToken.mockResolvedValueOnce(false);

      server.use(
        http.get('/api/admin/tracks', () => {
          return HttpResponse.json(
            { detail: 'Unauthorized' },
            { status: 401 }
          );
        })
      );

      const { fetchWithAuth } = useAdminApi(mockAccessToken);

      await expect(fetchWithAuth('/api/admin/tracks')).rejects.toThrow('Session expired');
      expect(mockLogout).toHaveBeenCalled();
    });

    it('should handle 403 errors', async () => {
      mockAccessToken.value = 'invalid-token';
      const { fetchWithAuth } = useAdminApi(mockAccessToken);

      await expect(fetchWithAuth('/api/admin/tracks')).rejects.toThrow('Admin access required');
    });

    it('should handle non-OK responses', async () => {
      mockAccessToken.value = MOCK_ADMIN_TOKEN;

      server.use(
        http.get('/api/admin/tracks', () => {
          return HttpResponse.json(
            { detail: 'Server error' },
            { status: 500 }
          );
        })
      );

      const { fetchWithAuth } = useAdminApi(mockAccessToken);

      await expect(fetchWithAuth('/api/admin/tracks')).rejects.toThrow('Server error');
    });

    it('should pass through custom headers', async () => {
      mockAccessToken.value = MOCK_ADMIN_TOKEN;
      const { fetchWithAuth } = useAdminApi(mockAccessToken);

      const originalFetch = global.fetch;
      let capturedOptions = null;

      global.fetch = vi.fn((url, options) => {
        capturedOptions = options;
        return originalFetch(url, options);
      });

      try {
        await fetchWithAuth('/api/admin/tracks', {
          headers: { 'X-Custom-Header': 'custom-value' },
        });

        expect(capturedOptions.headers['X-Custom-Header']).toBe('custom-value');
        expect(capturedOptions.headers['Authorization']).toBe(`Bearer ${MOCK_ADMIN_TOKEN}`);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
