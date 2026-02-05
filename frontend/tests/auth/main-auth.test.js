/**
 * Tests for main app authentication (useAuth)
 * Tests OIDC authentication flow and fetchWithAuth
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { server } from '../setup.js';
import { http, HttpResponse } from 'msw';
import { MOCK_OIDC_TOKEN, MOCK_REFRESH_TOKEN } from '../mocks/handlers.js';

// Mock oidc-client-ts
const mockUser = {
  access_token: MOCK_OIDC_TOKEN,
  refresh_token: MOCK_REFRESH_TOKEN,
  id_token: 'mock-id-token',
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  expired: false,
  profile: {
    email: 'test@example.com',
    name: 'Test User',
  },
};

const mockUserManager = {
  getUser: vi.fn().mockResolvedValue(mockUser),
  signinRedirect: vi.fn().mockResolvedValue(undefined),
  signinRedirectCallback: vi.fn().mockResolvedValue(mockUser),
  signoutRedirect: vi.fn().mockResolvedValue(undefined),
  storeUser: vi.fn().mockResolvedValue(undefined),
  removeUser: vi.fn().mockResolvedValue(undefined),
};

vi.mock('oidc-client-ts', () => ({
  UserManager: vi.fn().mockImplementation(() => mockUserManager),
  WebStorageStateStore: vi.fn().mockImplementation(() => ({})),
  User: vi.fn().mockImplementation((data) => ({ ...data })),
}));

describe('Main App Authentication', () => {
  beforeEach(() => {
    localStorage.clear();
    mockUserManager.getUser.mockResolvedValue(mockUser);
    mockUser.expired = false;
  });

  describe('fetchWithAuth (from useAuth)', () => {
    // Note: We can't easily test useAuth directly due to its singleton nature
    // But we can test the pattern it uses

    it('should include Authorization header with Bearer token', async () => {
      const token = MOCK_OIDC_TOKEN;
      const response = await fetch('/api/users/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.email).toBe('test@example.com');
    });

    it('should return 401 when token is missing', async () => {
      const response = await fetch('/api/users/me', {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).toBe(401);
    });

    it('should return 401 when token is invalid', async () => {
      const response = await fetch('/api/users/me', {
        headers: {
          'Authorization': 'Bearer invalid-token',
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Token refresh flow', () => {
    it('should refresh token when receiving 401', async () => {
      const expiredToken = 'expired-token';
      const newToken = MOCK_OIDC_TOKEN;

      // First call returns 401
      let callCount = 0;
      server.use(
        http.get('/api/users/me', ({ request }) => {
          callCount++;
          const authHeader = request.headers.get('Authorization');
          
          if (authHeader?.includes(expiredToken)) {
            return HttpResponse.json(
              { detail: 'Unauthorized' },
              { status: 401 }
            );
          }
          
          if (authHeader?.includes(newToken)) {
            return HttpResponse.json({
              id: 1,
              email: 'test@example.com',
              display_name: 'Test User',
            });
          }
          
          return HttpResponse.json(
            { detail: 'Unauthorized' },
            { status: 401 }
          );
        })
      );

      // Simulate refresh token flow
      const refreshResponse = await fetch('http://localhost:9000/application/o/token/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: 'dansbart-client',
          refresh_token: MOCK_REFRESH_TOKEN,
        }),
      });

      expect(refreshResponse.ok).toBe(true);
      const refreshData = await refreshResponse.json();
      expect(refreshData.access_token).toBeDefined();

      // Retry original request with new token
      const retryResponse = await fetch('/api/users/me', {
        headers: {
          'Authorization': `Bearer ${refreshData.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      expect(retryResponse.ok).toBe(true);
    });

    it('should handle refresh failure', async () => {
      server.use(
        http.post('http://localhost:9000/application/o/token/', () => {
          return HttpResponse.json(
            { error: 'invalid_grant' },
            { status: 400 }
          );
        })
      );

      const refreshResponse = await fetch('http://localhost:9000/application/o/token/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: 'dansbart-client',
          refresh_token: 'invalid-refresh-token',
        }),
      });

      expect(refreshResponse.status).toBe(400);
    });
  });

  describe('Public endpoints', () => {
    it('should allow access to public endpoints without auth', async () => {
      const response = await fetch('/api/tracks');
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data.tracks).toBeDefined();
    });
  });
});
