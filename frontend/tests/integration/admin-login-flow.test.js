/**
 * Integration tests for admin login flow
 * These tests simulate the exact scenario where login succeeds but subsequent requests fail
 * This should catch the 403 issue the user is experiencing
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { server } from '../setup.js';
import { http, HttpResponse } from 'msw';
import { MOCK_ADMIN_TOKEN } from '../mocks/handlers.js';

describe('Admin Login Flow Integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Password-based login flow', () => {
    it('should complete full login-to-API-call flow successfully', async () => {
      // Step 1: Login
      const loginResponse = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'correct-password' }),
      });

      expect(loginResponse.ok).toBe(true);
      const { token } = await loginResponse.json();
      expect(token).toBe(MOCK_ADMIN_TOKEN);

      // Step 2: Store token (simulating what useAdminAuth does)
      localStorage.setItem('admin_password_token', token);

      // Step 3: Verify token is stored correctly
      expect(localStorage.getItem('admin_password_token')).toBe(token);

      // Step 4: Make authenticated API call using stored token
      const tracksResponse = await fetch('/api/admin/tracks', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_password_token')}`,
        },
      });

      expect(tracksResponse.ok).toBe(true);
      const tracksData = await tracksResponse.json();
      expect(tracksData.tracks).toBeDefined();
    });

    it('should fail when customAdminFetch uses wrong localStorage key', async () => {
      // This test reproduces the actual bug:
      // useAdminAuth stores token as 'admin_password_token'
      // customAdminFetch reads from 'admin_token'

      // Step 1: Login and store token (as useAdminAuth does)
      const loginResponse = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'correct-password' }),
      });

      const { token } = await loginResponse.json();
      localStorage.setItem('admin_password_token', token); // useAdminAuth stores here

      // Step 2: Try to use token (as customAdminFetch does)
      // customAdminFetch reads from 'admin_token', not 'admin_password_token'
      const tokenFromWrongKey = localStorage.getItem('admin_token');
      expect(tokenFromWrongKey).toBeNull(); // This is the bug!

      // Step 3: API call fails because token is null
      const tracksResponse = await fetch('/api/admin/tracks', {
        headers: {
          'Authorization': tokenFromWrongKey ? `Bearer ${tokenFromWrongKey}` : '',
        },
      });

      expect(tracksResponse.status).toBe(403); // Fails because no token!
    });

    it('should work when both storage keys are set (demonstrating fix)', async () => {
      // This shows the workaround: set both keys
      const loginResponse = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'correct-password' }),
      });

      const { token } = await loginResponse.json();

      // Set both keys (workaround)
      localStorage.setItem('admin_password_token', token);
      localStorage.setItem('admin_token', token);

      // Now both should work
      expect(localStorage.getItem('admin_password_token')).toBe(token);
      expect(localStorage.getItem('admin_token')).toBe(token);

      // API call should succeed
      const tracksResponse = await fetch('/api/admin/tracks', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
        },
      });

      expect(tracksResponse.ok).toBe(true);
    });
  });

  describe('Multiple sequential API calls', () => {
    it('should maintain authentication across multiple requests', async () => {
      // Login
      const loginResponse = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'correct-password' }),
      });

      const { token } = await loginResponse.json();
      localStorage.setItem('admin_password_token', token);

      // Make multiple API calls
      const headers = {
        'Authorization': `Bearer ${localStorage.getItem('admin_password_token')}`,
      };

      const tracksResponse = await fetch('/api/admin/tracks', { headers });
      expect(tracksResponse.ok).toBe(true);

      const artistsResponse = await fetch('/api/admin/artists', { headers });
      expect(artistsResponse.ok).toBe(true);

      // Verify token is still valid
      const verifyResponse = await fetch('/api/admin/auth/verify', { headers });
      expect(verifyResponse.ok).toBe(true);
    });

    it('should handle token expiration gracefully', async () => {
      const loginResponse = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'correct-password' }),
      });

      const { token } = await loginResponse.json();
      localStorage.setItem('admin_password_token', token);

      // Simulate token expiration by using invalid token
      server.use(
        http.get('/api/admin/tracks', ({ request }) => {
          const authHeader = request.headers.get('Authorization');
          if (authHeader?.includes('expired')) {
            return HttpResponse.json(
              { detail: 'Token expired' },
              { status: 401 }
            );
          }
          return HttpResponse.json({ tracks: [] });
        })
      );

      // Try with expired token
      const expiredResponse = await fetch('/api/admin/tracks', {
        headers: { 'Authorization': 'Bearer expired-token' },
      });

      expect(expiredResponse.status).toBe(401);
    });
  });

  describe('Error scenarios', () => {
    it('should handle 403 when token is missing', async () => {
      // Don't login, just try to access API
      const response = await fetch('/api/admin/tracks');
      expect(response.status).toBe(403);
    });

    it('should handle 403 when token is invalid', async () => {
      const response = await fetch('/api/admin/tracks', {
        headers: { 'Authorization': 'Bearer invalid-token' },
      });
      expect(response.status).toBe(403);
    });

    it('should handle 401 when token is expired', async () => {
      server.use(
        http.get('/api/admin/tracks', () => {
          return HttpResponse.json(
            { detail: 'Token expired' },
            { status: 401 }
          );
        })
      );

      const response = await fetch('/api/admin/tracks', {
        headers: { 'Authorization': 'Bearer expired-token' },
      });

      expect(response.status).toBe(401);
    });
  });
});
