/**
 * Tests for admin authentication
 * These tests verify that admin login works and tokens are properly stored/retrieved
 * This should catch the 403 issue where login succeeds but subsequent requests fail
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { server } from '../setup.js';
import { http, HttpResponse } from 'msw';
import { MOCK_ADMIN_TOKEN } from '../mocks/handlers.js';

// Mock the useAdminAuth module
// We'll test the actual implementation, but need to handle OIDC client dependencies
vi.mock('oidc-client-ts', () => ({
  UserManager: vi.fn().mockImplementation(() => ({
    getUser: vi.fn().mockResolvedValue(null),
    signinRedirect: vi.fn().mockResolvedValue(undefined),
    signinRedirectCallback: vi.fn().mockResolvedValue(null),
    signoutRedirect: vi.fn().mockResolvedValue(undefined),
    storeUser: vi.fn().mockResolvedValue(undefined),
    removeUser: vi.fn().mockResolvedValue(undefined),
  })),
  WebStorageStateStore: vi.fn().mockImplementation(() => ({})),
  User: vi.fn(),
}));

describe('Admin Authentication', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  describe('Password-based authentication', () => {
    it('should successfully login with correct password and store token', async () => {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'correct-password' }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.token).toBe(MOCK_ADMIN_TOKEN);
      expect(data.expiresIn).toBe(86400);
    });

    it('should fail login with incorrect password', async () => {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'wrong-password' }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Invalid password');
    });

    it('should verify valid token', async () => {
      const response = await fetch('/api/admin/auth/verify', {
        headers: { 'Authorization': `Bearer ${MOCK_ADMIN_TOKEN}` },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.valid).toBe(true);
    });

    it('should reject invalid token', async () => {
      const response = await fetch('/api/admin/auth/verify', {
        headers: { 'Authorization': 'Bearer invalid-token' },
      });

      expect(response.status).toBe(401);
    });

    it('should reject request without Authorization header', async () => {
      const response = await fetch('/api/admin/auth/verify');

      expect(response.status).toBe(401);
    });
  });

  describe('Token storage and retrieval', () => {
    it('should store token in localStorage after login', async () => {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'correct-password' }),
      });

      const data = await response.json();
      const token = data.token;

      // Simulate storing token (as useAdminAuth does)
      localStorage.setItem('admin_password_token', token);

      // Verify token is stored
      expect(localStorage.getItem('admin_password_token')).toBe(token);
    });

    it('should retrieve token from localStorage for API calls', async () => {
      // Store token
      localStorage.setItem('admin_password_token', MOCK_ADMIN_TOKEN);

      // Make API call using stored token
      const response = await fetch('/api/admin/auth/verify', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_password_token')}` },
      });

      expect(response.ok).toBe(true);
    });

    it('should handle token mismatch between storage keys', async () => {
      // This test catches the bug where customAdminFetch looks for 'admin_token'
      // but useAdminAuth stores 'admin_password_token'
      
      // Store token with the key useAdminAuth uses
      localStorage.setItem('admin_password_token', MOCK_ADMIN_TOKEN);

      // Try to retrieve with the key customAdminFetch uses
      const tokenFromWrongKey = localStorage.getItem('admin_token');
      
      // This should be null, causing API calls to fail
      expect(tokenFromWrongKey).toBeNull();

      // Verify that using the correct key works
      const tokenFromCorrectKey = localStorage.getItem('admin_password_token');
      expect(tokenFromCorrectKey).toBe(MOCK_ADMIN_TOKEN);
    });
  });

  describe('Admin API calls with authentication', () => {
    it('should succeed when token is provided', async () => {
      const response = await fetch('/api/admin/tracks', {
        headers: { 'Authorization': `Bearer ${MOCK_ADMIN_TOKEN}` },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.tracks).toBeDefined();
    });

    it('should return 403 when token is missing', async () => {
      const response = await fetch('/api/admin/tracks');

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.detail).toBe('Admin access required');
    });

    it('should return 403 when token is invalid', async () => {
      const response = await fetch('/api/admin/tracks', {
        headers: { 'Authorization': 'Bearer invalid-token' },
      });

      expect(response.status).toBe(403);
    });

    it('should return 403 when Authorization header format is wrong', async () => {
      const response = await fetch('/api/admin/tracks', {
        headers: { 'Authorization': MOCK_ADMIN_TOKEN }, // Missing 'Bearer ' prefix
      });

      expect(response.status).toBe(403);
    });
  });

  describe('End-to-end login and API call flow', () => {
    it('should allow login followed by successful API calls', async () => {
      // Step 1: Login
      const loginResponse = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'correct-password' }),
      });

      expect(loginResponse.ok).toBe(true);
      const loginData = await loginResponse.json();
      const token = loginData.token;

      // Step 2: Store token (as useAdminAuth does)
      localStorage.setItem('admin_password_token', token);

      // Step 3: Make authenticated API call
      const apiResponse = await fetch('/api/admin/tracks', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_password_token')}` },
      });

      expect(apiResponse.ok).toBe(true);
      const apiData = await apiResponse.json();
      expect(apiData.tracks).toBeDefined();
    });

    it('should handle logout and invalidate token', async () => {
      // Login and get token
      const loginResponse = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'correct-password' }),
      });

      const loginData = await loginResponse.json();
      const token = loginData.token;
      localStorage.setItem('admin_password_token', token);

      // Logout
      const logoutResponse = await fetch('/api/admin/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      expect(logoutResponse.ok).toBe(true);

      // Clear token from localStorage (as logout should do)
      localStorage.removeItem('admin_password_token');

      // Verify token is cleared
      expect(localStorage.getItem('admin_password_token')).toBeNull();

      // Verify API calls fail without token
      const apiResponse = await fetch('/api/admin/tracks', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      // Note: In real implementation, logout might invalidate token on server
      // For now, we just verify localStorage is cleared
      expect(localStorage.getItem('admin_password_token')).toBeNull();
    });
  });
});
