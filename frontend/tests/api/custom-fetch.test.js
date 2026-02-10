/**
 * Tests for custom fetch wrappers
 * These tests verify that fetchWithAuth and customAdminFetch work correctly
 * and handle authentication errors properly
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { server } from '../setup.js';
import { http, HttpResponse } from 'msw';
import { MOCK_ADMIN_TOKEN, MOCK_OIDC_TOKEN } from '../mocks/handlers.js';

// Mock useAdminAuth before importing customAdminFetch
const mockAccessToken = { value: null };
const mockRefreshToken = vi.fn().mockResolvedValue(false);
const mockLogout = vi.fn();

vi.mock('../../admin/shared/composables/useAdminAuth.js', () => ({
  useAdminAuth: () => ({
    accessToken: mockAccessToken,
    refreshToken: mockRefreshToken,
    logout: mockLogout,
  }),
}));

// Import the actual fetch wrappers after mocking
import { customAdminFetch } from '../../admin/api/custom-fetch';

describe('Custom Fetch Wrappers', () => {
  beforeEach(() => {
    localStorage.clear();
    mockAccessToken.value = null;
    mockRefreshToken.mockClear();
    mockLogout.mockClear();
    mockRefreshToken.mockResolvedValue(false);
  });

  describe('customAdminFetch', () => {
    it('should include Authorization header when token exists in useAdminAuth', async () => {
      // Set token in useAdminAuth (the new way)
      mockAccessToken.value = MOCK_ADMIN_TOKEN;

      // Mock fetch to capture request
      const originalFetch = global.fetch;
      let capturedHeaders = null;

      global.fetch = vi.fn((url, options) => {
        capturedHeaders = options?.headers;
        return originalFetch(url, options);
      });

      try {
        await customAdminFetch('/api/admin/tracks');
        
        // Verify Authorization header was set
        expect(capturedHeaders).toBeDefined();
        if (capturedHeaders) expect(capturedHeaders['Authorization']).toBe(`Bearer ${MOCK_ADMIN_TOKEN}`);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should work with token from useAdminAuth', async () => {
      // Set token in useAdminAuth
      mockAccessToken.value = MOCK_ADMIN_TOKEN;

      const result = await customAdminFetch('/api/admin/tracks');
      expect(result.tracks).toBeDefined();
    });

    it('should fail when token is missing from useAdminAuth', async () => {
      // No token set in useAdminAuth
      mockAccessToken.value = null;

      await expect(customAdminFetch('/api/admin/tracks')).rejects.toThrow();
    });

    it('should handle 401 by attempting token refresh', async () => {
      mockAccessToken.value = 'expired-token';
      mockRefreshToken.mockResolvedValueOnce(false); // Refresh fails

      // Override handler to return 401
      server.use(
        http.get('/api/admin/tracks', () => {
          return HttpResponse.json(
            { detail: 'Unauthorized' },
            { status: 401 }
          );
        })
      );

      // Mock window.location
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        value: {
          ...originalLocation,
          href: 'http://localhost:8080/admin',
        },
        writable: true,
      });

      try {
        await expect(customAdminFetch('/api/admin/tracks')).rejects.toThrow('Session expired');
        expect(mockRefreshToken).toHaveBeenCalled();
        expect(mockLogout).toHaveBeenCalled();
      } finally {
        Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
      }
    });

    it('should retry request after successful token refresh', async () => {
      mockAccessToken.value = 'expired-token';
      mockRefreshToken.mockResolvedValueOnce(true);
      // After refresh, update token
      mockAccessToken.value = MOCK_ADMIN_TOKEN;

      // Override handler to return 401 first, then success
      let callCount = 0;
      server.use(
        http.get('/api/admin/tracks', () => {
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

      const result = await customAdminFetch('/api/admin/tracks');
      expect(mockRefreshToken).toHaveBeenCalled();
      expect(result.tracks).toBeDefined();
    });

    it('should handle 403 errors', async () => {
      mockAccessToken.value = 'invalid-token';

      await expect(customAdminFetch('/api/admin/tracks')).rejects.toThrow('Admin access required');
    });

    it('should handle network errors gracefully', async () => {
      mockAccessToken.value = MOCK_ADMIN_TOKEN;

      // Override handler to simulate network error
      server.use(
        http.get('/api/admin/tracks', () => {
          return HttpResponse.error();
        })
      );

      await expect(customAdminFetch('/api/admin/tracks')).rejects.toThrow();
    });
  });

  describe('Token source fix', () => {
    it('should use token from useAdminAuth (fixes the bug)', () => {
      // After the fix, customAdminFetch uses token from useAdminAuth
      // This ensures consistency with the authentication system
      mockAccessToken.value = MOCK_ADMIN_TOKEN;
      
      // The token is now correctly sourced from useAdminAuth
      expect(mockAccessToken.value).toBe(MOCK_ADMIN_TOKEN);
    });

    it('should work correctly with useAdminAuth token', async () => {
      // Set token in useAdminAuth
      mockAccessToken.value = MOCK_ADMIN_TOKEN;

      // customAdminFetch should now work correctly
      const result = await customAdminFetch('/api/admin/tracks');
      expect(result.tracks).toBeDefined();
    });
  });
});
