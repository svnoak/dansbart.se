/**
 * Authentication composable using Authentik OIDC.
 *
 * Handles user authentication via Authentik using the oidc-client-ts library.
 * Provides login, logout, and authenticated API requests.
 */
import { ref, computed } from 'vue';
import { UserManager, WebStorageStateStore } from 'oidc-client-ts';
import { showError, showToast } from './useToast.js';

// OIDC Client Configuration
const oidcConfig = {
  authority: 'http://localhost:9000/application/o/dansbart/',
  client_id: 'dansbart-client',
  redirect_uri: 'http://localhost:8080/auth/callback',
  post_logout_redirect_uri: 'http://localhost:8080/',
  response_type: 'code',
  scope: 'openid email profile',
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  automaticSilentRenew: true,  // Auto-refresh tokens

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
const user = ref(null);
const accessToken = ref(null);
const isAuthenticated = computed(() => !!user.value && !!accessToken.value);

// Promise that resolves when auth is initialized
let authInitPromise;

// --- INITIALIZATION ---
async function initAuth() {
  try {
    console.log('[useAuth] Initializing auth...');
    const storedUser = await userManager.getUser();
    console.log('[useAuth] Stored user:', storedUser);

    if (storedUser && !storedUser.expired) {
      user.value = storedUser.profile;
      accessToken.value = storedUser.access_token;
      console.log('[useAuth] User authenticated:', user.value);
    } else {
      user.value = null;
      accessToken.value = null;
      console.log('[useAuth] No valid user found');
    }
  } catch (error) {
    console.error('[useAuth] Init error:', error);
  }
  console.log('[useAuth] Auth initialized');
}

// Wait for auth to be initialized
async function waitForAuth() {
  await authInitPromise;
}

// --- AUTH ACTIONS ---
async function login() {
  try {
    await userManager.signinRedirect();
  } catch (error) {
    console.error('Login error:', error);
    showError('Kunde inte starta inloggning');
  }
}

async function handleCallback() {
  try {
    console.log('[useAuth] Handling callback...');
    const oidcUser = await userManager.signinRedirectCallback();
    console.log('[useAuth] Callback user:', oidcUser);

    user.value = oidcUser.profile;
    accessToken.value = oidcUser.access_token;
    console.log('[useAuth] User set:', user.value);
    console.log('[useAuth] Token set:', accessToken.value ? 'Yes' : 'No');

    showToast(`Välkommen, ${user.value.name || user.value.email}!`, 'success');
    return true;
  } catch (error) {
    console.error('[useAuth] Callback error:', error);
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
    const oidcUser = await userManager.signinSilent();
    if (oidcUser) {
      user.value = oidcUser.profile;
      accessToken.value = oidcUser.access_token;
      return true;
    }
    return false;
  } catch (error) {
    console.error('Token refresh error:', error);
    return false;
  }
}

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
    const refreshed = await refreshToken();
    if (refreshed) {
      // Retry with new token
      headers['Authorization'] = `Bearer ${accessToken.value}`;
      response = await fetch(url, { ...options, headers });
    } else {
      // Refresh failed - force re-login
      showError('Din session har gått ut. Logga in igen.');
      await login();
      throw new Error('Session expired');
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
