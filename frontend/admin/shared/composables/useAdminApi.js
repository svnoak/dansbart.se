/**
 * Admin API Composable
 * Provides authenticated fetch wrapper for admin API calls
 *
 * When using Authentik (ENABLE_AUTH_FEATURES=true): Uses Authorization: Bearer token
 * When using password auth (ENABLE_AUTH_FEATURES=false): Uses X-Admin-Token header
 */

import { unref } from 'vue';
import { useAdminAuth } from './useAdminAuth.js';

export function useAdminApi(token) {
  const { logout, refreshToken, usePasswordAuth, adminPassword } = useAdminAuth();

  const fetchWithAuth = async (url, options = {}) => {
    let headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Use different auth headers based on auth mode
    if (usePasswordAuth.value) {
      // Password auth mode - use X-Admin-Token header
      headers['X-Admin-Token'] = adminPassword.value;
    } else {
      // Authentik mode - use Bearer token
      const rawToken = unref(token);
      const tokenValue =
        rawToken && typeof rawToken === 'object' && 'value' in rawToken ? rawToken.value : rawToken;
      headers['Authorization'] = `Bearer ${tokenValue}`;
    }

    let response = await fetch(url, { ...options, headers });

    // Handle 401 - try to refresh token (only in Authentik mode)
    if (response.status === 401 && !usePasswordAuth.value) {
      console.log('[useAdminApi] Got 401, attempting token refresh');
      const refreshed = await refreshToken();
      if (refreshed) {
        // Get the new token from auth state
        const { accessToken } = useAdminAuth();
        headers['Authorization'] = `Bearer ${accessToken.value}`;
        response = await fetch(url, { ...options, headers });
      } else {
        // Refresh failed - redirect to login
        logout();
        throw new Error('Session expired');
      }
    }

    if (response.status === 401 && usePasswordAuth.value) {
      // Invalid password in password auth mode
      throw new Error('Invalid admin password');
    }

    if (response.status === 403) {
      throw new Error('Admin access required');
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(data.detail || 'Request failed');
    }

    return response;
  };

  return { fetchWithAuth };
}
