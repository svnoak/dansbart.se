/**
 * Auth configuration from the backend.
 * Single source of truth: one flag (authEnabled) drives login, playlists, and user features.
 *
 * - When authEnabled is false: no login, no playlists, no profile (password-only admin).
 * - When authEnabled is true: full OIDC login, playlists, profile (Authentik).
 */
import { ref, readonly } from 'vue';

const API_BASE = '/api';

const authEnabled = ref(null);
const authMethod = ref('oidc');
const loading = ref(true);
const error = ref(null);

let initPromise = null;

async function fetchAuthConfig() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    loading.value = true;
    error.value = null;
    try {
      const response = await fetch(`${API_BASE}/config/auth`);
      if (!response.ok) throw new Error(`Auth config failed: ${response.status}`);
      const config = await response.json();
      authEnabled.value = config.authEnabled === true;
      authMethod.value = config.authMethod || (config.authEnabled ? 'oidc' : 'password');
      return config;
    } catch (e) {
      console.error('[useAuthConfig] Failed to fetch auth config:', e);
      error.value = e;
      // Safe fallback: assume auth disabled so site still works without backend
      authEnabled.value = false;
      authMethod.value = 'password';
      return { authEnabled: false, authMethod: 'password' };
    } finally {
      loading.value = false;
    }
  })();
  return initPromise;
}

/** Resolve when config is ready (call early in app so rest of app can use it). */
function waitForAuthConfig() {
  return fetchAuthConfig();
}

/**
 * Use auth config. Call fetchAuthConfig() or waitForAuthConfig() at app startup
 * so refs are populated before router/header render.
 */
export function useAuthConfig() {
  return {
    /** true = OIDC login + playlists; false = no login, no playlists */
    authEnabled: readonly(authEnabled),
    /** 'oidc' | 'password' (password only used for admin when authEnabled is false) */
    authMethod: readonly(authMethod),
    loading: readonly(loading),
    error: readonly(error),
    fetchAuthConfig,
    waitForAuthConfig,
  };
}
