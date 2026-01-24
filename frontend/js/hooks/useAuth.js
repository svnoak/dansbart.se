/**
 * Authentication composable using Authentik OIDC.
 *
 * Handles user authentication via Authentik using the oidc-client-ts library.
 * Provides login, logout, and authenticated API requests.
 */
import { ref, computed } from 'vue';
import { UserManager, WebStorageStateStore, User } from 'oidc-client-ts';
import { showError, showToast } from './useToast.js';

// OIDC Client Configuration
const oidcConfig = {
  authority: 'http://localhost:9000/application/o/dansbart/',
  client_id: 'dansbart-client',
  redirect_uri: 'http://localhost:8080/auth/callback',
  post_logout_redirect_uri: 'http://localhost:8080/',
  response_type: 'code',
  scope: 'openid email profile offline_access groups',  // groups scope for admin access
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  automaticSilentRenew: false,  // Disabled - Authentik blocks iframe with X-Frame-Options

  // Metadata override to ensure correct token endpoint
  metadata: {
    issuer: 'http://localhost:9000/application/o/dansbart/',
    authorization_endpoint: 'http://localhost:9000/application/o/authorize/',
    token_endpoint: 'http://localhost:9000/application/o/token/',
    userinfo_endpoint: 'http://localhost:9000/application/o/userinfo/',
    end_session_endpoint: 'http://localhost:9000/application/o/dansbart/end-session/',
    jwks_uri: 'http://localhost:9000/application/o/dansbart/jwks/',
  },
};

const userManager = new UserManager(oidcConfig);

// --- SHARED STATE (Singleton) ---
const user = ref(null);  // Full user profile from backend
const accessToken = ref(null);
const isAuthenticated = computed(() => !!user.value && !!accessToken.value);

// Promise that resolves when auth is initialized
let authInitPromise;

// Fetch user profile from backend API
async function fetchUserProfile(token) {
  try {
    const response = await fetch('/api/users/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch {
    return null;
  }
}

// --- INITIALIZATION ---
async function initAuth() {
  try {
    // Debug: Check what's in localStorage
    const storageKey = `oidc.user:${oidcConfig.authority}:${oidcConfig.client_id}`;
    const rawStored = localStorage.getItem(storageKey);
    console.log('[useAuth] initAuth - localStorage key:', storageKey);
    console.log('[useAuth] initAuth - raw localStorage value:', rawStored ? 'exists (' + rawStored.length + ' chars)' : 'null');

    const storedUser = await userManager.getUser();
    console.log('[useAuth] initAuth - storedUser:', storedUser ? 'exists' : 'null');
    console.log('[useAuth] initAuth - expired:', storedUser?.expired);
    console.log('[useAuth] initAuth - has refresh_token:', !!storedUser?.refresh_token);

    if (storedUser && !storedUser.expired) {
      accessToken.value = storedUser.access_token;

      // Fetch full user profile from backend
      const userProfile = await fetchUserProfile(storedUser.access_token);
      if (userProfile) {
        user.value = userProfile;
        console.log('[useAuth] initAuth - user profile loaded from backend');
      } else {
        // Fallback to OIDC profile if backend fails
        user.value = storedUser.profile;
        console.log('[useAuth] initAuth - using OIDC profile fallback');
      }
    } else if (storedUser && storedUser.expired && storedUser.refresh_token) {
      // Token expired but we have refresh token - try to refresh
      console.log('[useAuth] initAuth - token expired, attempting refresh...');
      const refreshed = await refreshToken();
      if (!refreshed) {
        console.log('[useAuth] initAuth - refresh failed, clearing auth state');
        user.value = null;
        accessToken.value = null;
      }
    } else {
      console.log('[useAuth] initAuth - no valid session');
      user.value = null;
      accessToken.value = null;
    }
  } catch (error) {
    console.error('[useAuth] initAuth error:', error);
    showError("Oj, något gick fel");
  }
}

// Wait for auth to be initialized
async function waitForAuth() {
  await authInitPromise;
}

// --- AUTH ACTIONS ---
async function login() {
  try {
    await userManager.signinRedirect();
  } catch {
    showError('Kunde inte starta inloggning');
  }
}

async function handleCallback() {
  try {
    console.log('[useAuth] handleCallback - starting signinRedirectCallback');
    const oidcUser = await userManager.signinRedirectCallback();
    console.log('[useAuth] handleCallback - signinRedirectCallback completed');
    console.log('[useAuth] handleCallback - oidcUser:', oidcUser ? 'exists' : 'null');
    console.log('[useAuth] handleCallback - access_token:', oidcUser?.access_token ? 'exists' : 'missing');
    console.log('[useAuth] handleCallback - refresh_token:', oidcUser?.refresh_token ? 'exists' : 'missing');

    // Verify user was stored in localStorage
    const storedCheck = await userManager.getUser();
    console.log('[useAuth] handleCallback - verified stored user:', storedCheck ? 'exists' : 'null');

    if (!storedCheck) {
      console.error('[useAuth] handleCallback - USER NOT STORED! Attempting manual store...');
      await userManager.storeUser(oidcUser);
      const recheck = await userManager.getUser();
      console.log('[useAuth] handleCallback - after manual store:', recheck ? 'exists' : 'still null');
    }

    accessToken.value = oidcUser.access_token;

    // Fetch full user profile from backend
    const userProfile = await fetchUserProfile(oidcUser.access_token);
    if (userProfile) {
      user.value = userProfile;
    } else {
      // Fallback to OIDC profile
      user.value = oidcUser.profile;
    }

    showToast(`Välkommen, ${user.value.display_name || user.value.email}!`, 'success');
    return true;
  } catch (error) {
    console.error('[useAuth] handleCallback error:', error);
    showError('Inloggning misslyckades');
    return false;
  }
}

async function logout() {
  try {
    await userManager.signoutRedirect();
    user.value = null;
    accessToken.value = null;
  } catch (error) {
    console.error('Logout error:', error);
    showError('Kunde inte logga ut');
  }
}

async function refreshToken() {
  try {
    // Use signinSilent with refresh token (not iframe) if available
    // oidc-client-ts will use refresh_token if available and iframe fails
    const storedUser = await userManager.getUser();

    if (!storedUser?.refresh_token) {
      console.log('[useAuth] No refresh token available');
      return false;
    }

    // Manually refresh using the token endpoint
    const tokenEndpoint = oidcConfig.metadata.token_endpoint;
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: oidcConfig.client_id,
        refresh_token: storedUser.refresh_token,
      }),
    });

    if (!response.ok) {
      console.error('[useAuth] Token refresh failed:', response.status);
      return false;
    }

    const tokenResponse = await response.json();

    // Create a proper User object with updated tokens
    // The User class requires specific structure for toStorageString()
    const updatedUserData = {
      id_token: storedUser.id_token,
      session_state: storedUser.session_state,
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token || storedUser.refresh_token,
      token_type: tokenResponse.token_type || storedUser.token_type || 'Bearer',
      scope: storedUser.scope,
      profile: storedUser.profile,
      expires_at: Math.floor(Date.now() / 1000) + tokenResponse.expires_in,
    };

    const updatedUser = new User(updatedUserData);
    await userManager.storeUser(updatedUser);
    accessToken.value = tokenResponse.access_token;

    // Fetch full user profile from backend
    const userProfile = await fetchUserProfile(tokenResponse.access_token);
    if (userProfile) {
      user.value = userProfile;
    } else {
      // Fallback to OIDC profile
      user.value = storedUser.profile;
    }

    console.log('[useAuth] Token refreshed successfully');
    return true;
  } catch (error) {
    console.error('[useAuth] Token refresh error:', error);
    return false;
  }
}

// Flag to prevent multiple login redirects
let isRedirectingToLogin = false;

// --- API HELPERS ---
async function fetchWithAuth(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (accessToken.value) {
    headers['Authorization'] = `Bearer ${accessToken.value}`;
  }

  let response = await fetch(url, { ...options, headers });

  // Handle 401 - try to refresh token
  if (response.status === 401 && accessToken.value) {
    console.log('[useAuth] Got 401, attempting token refresh...');
    const refreshed = await refreshToken();
    if (refreshed) {
      console.log('[useAuth] Token refreshed successfully, retrying request');
      // Retry with new token
      headers['Authorization'] = `Bearer ${accessToken.value}`;
      response = await fetch(url, { ...options, headers });
    } else {
      console.log('[useAuth] Token refresh failed');
      // Refresh failed - clear auth state and redirect to login
      // Only redirect once to prevent multiple redirects
      if (!isRedirectingToLogin) {
        isRedirectingToLogin = true;
        user.value = null;
        accessToken.value = null;
        showError('Din session har gått ut. Logga in igen.');

        // Store current URL for return after login
        sessionStorage.setItem('returnUrl', window.location.pathname);

        // Small delay to let the error toast show
        setTimeout(() => {
          login();
        }, 500);
      }

      // Return a fake response to let calling code handle gracefully
      // eslint-disable-next-line no-undef
      return new Response(JSON.stringify({ detail: 'Session expired' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  return response;
}

// Initialize on load and store the promise
authInitPromise = initAuth();

// Export composable
export function useAuth() {
  return {
    user,
    isAuthenticated,
    waitForAuth,
    accessToken,
    login,
    logout,
    handleCallback,
    fetchWithAuth,
    refreshToken,
  };
}
