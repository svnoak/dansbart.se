/**
 * MSW request handlers for mocking backend API responses
 * These handlers simulate the Java backend API behavior
 */

import { http, HttpResponse } from 'msw';

const API_BASE = '/api';

// Mock tokens for testing
export const MOCK_ADMIN_TOKEN = 'mock-admin-token-12345';
export const MOCK_OIDC_TOKEN = 'mock-oidc-token-67890';
export const MOCK_REFRESH_TOKEN = 'mock-refresh-token-abcde';

// Helper to extract Bearer token from Authorization header
function getBearerToken(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

// Helper to check if request has valid admin token
function hasValidAdminToken(request) {
  const token = getBearerToken(request);
  return token === MOCK_ADMIN_TOKEN || token === MOCK_OIDC_TOKEN;
}

// Auth configuration endpoint
export const authConfigHandler = http.get(`${API_BASE}/config/auth`, () => {
  return HttpResponse.json({
    authEnabled: true,
    authMethod: 'password', // Can be 'password' or 'oidc'
  });
});

// Admin password login endpoint
export const adminLoginHandler = http.post(`${API_BASE}/admin/auth/login`, async ({ request }) => {
  const body = await request.json();
  
  if (body.password === 'correct-password') {
    return HttpResponse.json({
      token: MOCK_ADMIN_TOKEN,
      expiresIn: 86400, // 24 hours
    });
  }
  
  return HttpResponse.json(
    { error: 'Invalid password' },
    { status: 401 }
  );
});

// Admin token verification endpoint
export const adminVerifyHandler = http.get(`${API_BASE}/admin/auth/verify`, ({ request }) => {
  const token = getBearerToken(request);
  
  if (token === MOCK_ADMIN_TOKEN || token === MOCK_OIDC_TOKEN) {
    return HttpResponse.json({ valid: true });
  }
  
  return HttpResponse.json(
    { error: 'Invalid token' },
    { status: 401 }
  );
});

// Admin logout endpoint
export const adminLogoutHandler = http.post(`${API_BASE}/admin/auth/logout`, ({ request }) => {
  const token = getBearerToken(request);
  
  if (token) {
    return HttpResponse.json({ message: 'Logged out' });
  }
  
  return HttpResponse.json({ message: 'Logged out' });
});

// Example admin endpoint - tracks list
export const adminTracksHandler = http.get(`${API_BASE}/admin/tracks`, ({ request }) => {
  if (!hasValidAdminToken(request)) {
    return HttpResponse.json(
      { detail: 'Admin access required' },
      { status: 403 }
    );
  }
  
  return HttpResponse.json({
    tracks: [
      { id: 1, title: 'Test Track 1', artist: 'Test Artist' },
      { id: 2, title: 'Test Track 2', artist: 'Test Artist' },
    ],
  });
});

// Example admin endpoint - artists list
export const adminArtistsHandler = http.get(`${API_BASE}/admin/artists`, ({ request }) => {
  if (!hasValidAdminToken(request)) {
    return HttpResponse.json(
      { detail: 'Admin access required' },
      { status: 403 }
    );
  }
  
  return HttpResponse.json({
    artists: [
      { id: 1, name: 'Test Artist' },
    ],
  });
});

// User profile endpoint (requires auth)
export const userProfileHandler = http.get(`${API_BASE}/users/me`, ({ request }) => {
  const token = getBearerToken(request);
  
  if (!token) {
    return HttpResponse.json(
      { detail: 'Authentication required' },
      { status: 401 }
    );
  }
  
  // Validate token - only accept valid tokens
  if (token !== MOCK_OIDC_TOKEN && token !== MOCK_ADMIN_TOKEN) {
    return HttpResponse.json(
      { detail: 'Invalid token' },
      { status: 401 }
    );
  }
  
  return HttpResponse.json({
    id: 1,
    email: 'test@example.com',
    display_name: 'Test User',
  });
});

// Public tracks endpoint (no auth required)
export const publicTracksHandler = http.get(`${API_BASE}/tracks`, () => {
  return HttpResponse.json({
    tracks: [
      { id: 1, title: 'Public Track 1' },
    ],
  });
});

// OIDC token endpoint (for refresh)
export const oidcTokenHandler = http.post('http://localhost:9000/application/o/token/', async ({ request }) => {
  const body = await request.formData();
  const grantType = body.get('grant_type');
  const refreshToken = body.get('refresh_token');
  
  if (grantType === 'refresh_token' && refreshToken === MOCK_REFRESH_TOKEN) {
    return HttpResponse.json({
      access_token: MOCK_OIDC_TOKEN,
      refresh_token: MOCK_REFRESH_TOKEN,
      token_type: 'Bearer',
      expires_in: 3600,
    });
  }
  
  return HttpResponse.json(
    { error: 'invalid_grant' },
    { status: 400 }
  );
});

// Export all handlers
export const handlers = [
  authConfigHandler,
  adminLoginHandler,
  adminVerifyHandler,
  adminLogoutHandler,
  adminTracksHandler,
  adminArtistsHandler,
  userProfileHandler,
  publicTracksHandler,
  oidcTokenHandler,
];
