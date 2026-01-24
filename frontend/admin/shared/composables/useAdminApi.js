/**
 * Admin API Composable
 * Provides authenticated fetch wrapper for admin API calls using Bearer token
 */

import { unref } from 'vue';
import { useAdminAuth } from './useAdminAuth.js';

export function useAdminApi(token) {
  const { logout, refreshToken } = useAdminAuth();

  const fetchWithAuth = async (url, options = {}) => {
    const rawToken = unref(token);
    const tokenValue =
      rawToken && typeof rawToken === 'object' && 'value' in rawToken ? rawToken.value : rawToken;

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenValue}`,
      ...options.headers,
    };

    let response = await fetch(url, { ...options, headers });

    // Handle 401 - try to refresh token
    if (response.status === 401) {
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
