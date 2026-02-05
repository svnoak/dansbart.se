/**
 * Custom fetch wrapper for admin API calls with Bearer token
 * 
 * This function uses the token from useAdminAuth composable to ensure
 * consistency with the authentication system. It reads from the same
 * storage key that useAdminAuth uses (admin_password_token for password auth,
 * or OIDC token from the auth state).
 * 
 * Note: For new code, prefer using useAdminApi composable directly in Vue components.
 */
import { useAdminAuth } from '../shared/composables/useAdminAuth.js';

export const customAdminFetch = async <T>(
  url: string,
  options: RequestInit = {}
): Promise<T> => {
  // Get token from useAdminAuth - this ensures we use the same token source
  // as the rest of the application
  const { accessToken } = useAdminAuth();
  const token = accessToken.value;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      ...options.headers,
    },
  });

  if (response.status === 401) {
    // Try to refresh token using useAdminAuth
    const { refreshToken, logout } = useAdminAuth();
    const refreshed = await refreshToken();
    
    if (refreshed) {
      // Retry with new token
      const { accessToken: newAccessToken } = useAdminAuth();
      const retryResponse = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': newAccessToken.value ? `Bearer ${newAccessToken.value}` : '',
          ...options.headers,
        },
      });
      
      if (!retryResponse.ok) {
        const error = await retryResponse.json().catch(() => ({ detail: 'Request failed' }));
        throw new Error(error.detail || `HTTP ${retryResponse.status}`);
      }
      
      return retryResponse.json();
    } else {
      // Refresh failed - logout and redirect to login
      logout();
      window.location.href = '/admin/login';
      throw new Error('Session expired');
    }
  }

  if (response.status === 403) {
    const error = await response.json().catch(() => ({ detail: 'Admin access required' }));
    throw new Error(error.detail || 'Admin access required');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
};
