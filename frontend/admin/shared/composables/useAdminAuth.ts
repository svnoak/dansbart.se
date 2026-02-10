/**
 * Admin Authentication Composable
 * Supports two authentication modes:
 * 1. Authentik OIDC (when ENABLE_AUTH_FEATURES=true)
 * 2. Password-based (when ENABLE_AUTH_FEATURES=false)
 *
 * Shares the same session as the main app - if user is logged into the main app,
 * the admin will use that token and just verify admin group membership.
 */

import { ref, computed } from 'vue';
import { UserManager, WebStorageStateStore, User } from 'oidc-client-ts';

// API base URL
const API_BASE = '/api';

// Auth mode (determined at runtime)
const authMode = ref('oidc'); // 'oidc' or 'password'
console.log('AuthMode:', authMode);
const passwordToken = ref(localStorage.getItem('admin_password_token') || null);

// Main app OIDC config - used to check existing session
const mainAppOidcConfig = {
  authority: 'http://localhost:9000/application/o/dansbart/',
  client_id: 'dansbart-client',
  redirect_uri: 'http://localhost:8080/auth/callback',
  post_logout_redirect_uri: 'http://localhost:8080/',
  response_type: 'code',
  scope: 'openid email profile offline_access groups',
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  automaticSilentRenew: false,
  metadata: {
    issuer: 'http://localhost:9000/application/o/dansbart/',
    authorization_endpoint: 'http://localhost:9000/application/o/authorize/',
    token_endpoint: 'http://localhost:9000/application/o/token/',
    userinfo_endpoint: 'http://localhost:9000/application/o/userinfo/',
    end_session_endpoint: 'http://localhost:9000/application/o/dansbart/end-session/',
    jwks_uri: 'http://localhost:9000/application/o/dansbart/jwks/',
  },
};

// Admin-specific OIDC config - used for login redirect from admin page
const adminOidcConfig = {
  ...mainAppOidcConfig,
  redirect_uri: 'http://localhost:8080/admin/index.html',
  post_logout_redirect_uri: 'http://localhost:8080/admin/index.html',
};

// Use main app's user manager to check existing session
const mainAppUserManager = new UserManager(mainAppOidcConfig);
// Use admin-specific config for login redirects from admin page
const adminUserManager = new UserManager(adminOidcConfig);

// Alias for backward compatibility - use main app manager for most operations
const userManager = mainAppUserManager;

// Shared state
const user = ref(null);
const accessToken = ref(null);
const isAdmin = ref(false);
const authError = ref('');
const isLoading = ref(true);

const isAuthenticated = computed(() => !!user.value && !!accessToken.value && isAdmin.value);

// Admin group name (must match backend config)
const ADMIN_GROUP = 'dansbart-admins';

// Decode JWT to extract groups claim
function decodeJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

// Check if user is in admin group
function checkAdminGroup(token) {
  const payload = decodeJwt(token);
  if (!payload) return false;
  const groups = payload.groups || [];
  return groups.includes(ADMIN_GROUP);
}

// Fetch auth configuration from backend
async function fetchAuthConfig() {
  try {
    const response = await fetch(`${API_BASE}/config/auth`);
    if (response.ok) {
      const config = await response.json();
      authMode.value = config.authMethod || 'oidc';
      console.log('[useAdminAuth] Auth mode from backend:', authMode.value);
      return config;
    }
    console.warn('[useAdminAuth] Backend returned non-OK status:', response.status);
  } catch (error) {
    console.error('[useAdminAuth] Failed to fetch auth config:', error);
  }

  // Check for injected config (from nginx or build process)
  if (window.__DANSBART_AUTH_CONFIG__) {
    const config = window.__DANSBART_AUTH_CONFIG__;
    authMode.value = config.authMethod || 'password';
    console.log('[useAdminAuth] Using injected config:', authMode.value);
    return config;
  }

  // SAFER FALLBACK: Default to password auth when backend unreachable
  // This allows local development without Authentik
  console.log('[useAdminAuth] Using fallback: password auth');
  authMode.value = 'password';
  return { authEnabled: false, authMethod: 'password' };
}

// Initialize auth state
async function initAuth() {
  isLoading.value = true;
  authError.value = '';

  try {
    // First, determine auth mode from backend
    const authConfig = await fetchAuthConfig();

    if (authConfig.authMethod === 'password') {
      // Password-based authentication
      await initPasswordAuth();
      return;
    }

    // OIDC authentication flow
    // Check if this is a callback from Authentik
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('code')) {
      console.log('[useAdminAuth] Handling OAuth callback');
      await handleCallback();
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    // Check for existing session
    const storedUser = await userManager.getUser();
    console.log('[useAdminAuth] Stored user:', storedUser ? 'exists' : 'null');

    if (storedUser && !storedUser.expired) {
      accessToken.value = storedUser.access_token;
      user.value = storedUser.profile;

      // Check admin group membership
      if (checkAdminGroup(storedUser.access_token)) {
        isAdmin.value = true;
        console.log('[useAdminAuth] User is admin');
      } else {
        isAdmin.value = false;
        authError.value = 'You do not have admin access. Please contact an administrator.';
        console.log('[useAdminAuth] User is NOT admin');
      }
    } else if (storedUser && storedUser.expired && storedUser.refresh_token) {
      console.log('[useAdminAuth] Token expired, attempting refresh');
      const refreshed = await refreshToken();
      if (!refreshed) {
        user.value = null;
        accessToken.value = null;
        isAdmin.value = false;
      }
    } else {
      user.value = null;
      accessToken.value = null;
      isAdmin.value = false;
    }
  } catch (error) {
    console.error('[useAdminAuth] Init error:', error);
    authError.value = 'Authentication error';
  } finally {
    isLoading.value = false;
  }
}

// Initialize password-based authentication
async function initPasswordAuth() {
  console.log('[useAdminAuth] Using password-based authentication');

  // Check for existing token in localStorage
  const storedToken = localStorage.getItem('admin_password_token');
  if (storedToken) {
    // Verify token is still valid
    try {
      const response = await fetch(`${API_BASE}/admin/auth/verify`, {
        headers: { 'Authorization': `Bearer ${storedToken}` }
      });

      if (response.ok) {
        passwordToken.value = storedToken;
        accessToken.value = storedToken;
        user.value = { name: 'Admin' };
        isAdmin.value = true;
        console.log('[useAdminAuth] Password token valid');
        isLoading.value = false;
        return;
      }
    } catch (error) {
      console.error('[useAdminAuth] Token verification failed:', error);
    }

    // Token invalid, clear it
    localStorage.removeItem('admin_password_token');
  }

  // No valid token
  passwordToken.value = null;
  accessToken.value = null;
  user.value = null;
  isAdmin.value = false;
  isLoading.value = false;
}

// Login with password (when OIDC is disabled)
async function loginWithPassword(password) {
  isLoading.value = true;
  authError.value = '';

  try {
    const response = await fetch(`${API_BASE}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });

    const data = await response.json();

    if (!response.ok) {
      authError.value = data.error || 'Login failed';
      isLoading.value = false;
      return false;
    }

    // Store token
    localStorage.setItem('admin_password_token', data.token);
    passwordToken.value = data.token;
    accessToken.value = data.token;
    user.value = { name: 'Admin' };
    isAdmin.value = true;
    console.log('[useAdminAuth] Password login successful');
    isLoading.value = false;
    return true;
  } catch (error) {
    console.error('[useAdminAuth] Password login error:', error);
    authError.value = 'Login failed';
    isLoading.value = false;
    return false;
  }
}

async function handleCallback() {
  try {
    // Use adminUserManager for callback since login redirect used it
    const oidcUser = await adminUserManager.signinRedirectCallback();
    accessToken.value = oidcUser.access_token;
    user.value = oidcUser.profile;

    // Store in main app's storage so both apps share the session
    await mainAppUserManager.storeUser(oidcUser);

    if (checkAdminGroup(oidcUser.access_token)) {
      isAdmin.value = true;
      console.log('[useAdminAuth] Login successful, user is admin');
    } else {
      isAdmin.value = false;
      authError.value = 'You do not have admin access. Please contact an administrator.';
      console.log('[useAdminAuth] Login successful, but user is NOT admin');
    }
  } catch (error) {
    console.error('[useAdminAuth] Callback error:', error);
    authError.value = 'Login failed';
  }
}

async function login() {
  try {
    // Use adminUserManager so redirect comes back to admin page
    await adminUserManager.signinRedirect();
  } catch (error) {
    console.error('[useAdminAuth] Login redirect error:', error);
    authError.value = 'Could not start login';
  }
}

async function logout() {
  try {
    if (authMode.value === 'password') {
      // Password-based logout
      if (passwordToken.value) {
        await fetch(`${API_BASE}/admin/auth/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${passwordToken.value}` }
        });
      }
      localStorage.removeItem('admin_password_token');
      passwordToken.value = null;
      accessToken.value = null;
      user.value = null;
      isAdmin.value = false;
      return;
    }

    // OIDC logout
    await userManager.signoutRedirect();
  } catch (error) {
    console.error('[useAdminAuth] Logout error:', error);
    // Force clear local state
    user.value = null;
    accessToken.value = null;
    isAdmin.value = false;
    passwordToken.value = null;
    localStorage.removeItem('admin_password_token');
    await userManager.removeUser();
  }
}

async function refreshToken() {
  try {
    const storedUser = await userManager.getUser();
    if (!storedUser?.refresh_token) {
      return false;
    }

    const tokenEndpoint = mainAppOidcConfig.metadata.token_endpoint;
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: mainAppOidcConfig.client_id,
        refresh_token: storedUser.refresh_token,
      }),
    });

    if (!response.ok) {
      return false;
    }

    const tokenResponse = await response.json();

    const updatedUserData = {
      id_token: storedUser.id_token,
      session_state: storedUser.session_state,
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token || storedUser.refresh_token,
      token_type: tokenResponse.token_type || 'Bearer',
      scope: storedUser.scope,
      profile: storedUser.profile,
      expires_at: Math.floor(Date.now() / 1000) + tokenResponse.expires_in,
    };

    const updatedUser = new User(updatedUserData);
    await userManager.storeUser(updatedUser);
    accessToken.value = tokenResponse.access_token;
    user.value = storedUser.profile;

    if (checkAdminGroup(tokenResponse.access_token)) {
      isAdmin.value = true;
    } else {
      isAdmin.value = false;
      authError.value = 'You do not have admin access.';
    }

    return true;
  } catch (error) {
    console.error('[useAdminAuth] Refresh error:', error);
    return false;
  }
}

// Initialize on module load
const authInitPromise = initAuth();

export function useAdminAuth() {
  return {
    user,
    accessToken,
    adminToken: accessToken,
    isAuthenticated,
    isAdmin,
    isLoading,
    authError,
    authMode,
    login,
    loginWithPassword,
    logout,
    refreshToken,
    waitForAuth: () => authInitPromise,
  };
}
