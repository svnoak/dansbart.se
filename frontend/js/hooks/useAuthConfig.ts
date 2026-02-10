/**
 * Auth configuration from the backend.
 * Single source of truth: one flag (authEnabled) drives login, playlists, and user features.
 *
 * - When authEnabled is false: no login, no playlists, no profile (password-only admin).
 * - When authEnabled is true: full OIDC login, playlists, profile (Authentik).
 */
import { ref, readonly, type Ref } from 'vue';

const API_BASE = '/api';

/** Backend auth config shape (API may return snake_case or camelCase) */
export interface AuthConfig {
  authEnabled?: boolean;
  authMethod?: string;
}

const authEnabled: Ref<boolean | null> = ref<boolean | null>(null);
const authMethod: Ref<string> = ref<string>('oidc');
const loading = ref<boolean>(true);
const error = ref<Error | null>(null);

let initPromise: Promise<AuthConfig> | null = null;

async function fetchAuthConfig(): Promise<AuthConfig> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    loading.value = true;
    error.value = null;
    try {
      const response = await fetch(`${API_BASE}/config/auth`);
      if (!response.ok) throw new Error(`Auth config failed: ${response.status}`);
      const config = (await response.json()) as AuthConfig;
      const enabled = config.authEnabled === true;
      authEnabled.value = enabled;
      authMethod.value =
        (typeof config.authMethod === 'string' ? config.authMethod : undefined) ??
        (enabled ? 'oidc' : 'password');
      return { authEnabled: enabled, authMethod: authMethod.value };
    } catch (e) {
      console.error('[useAuthConfig] Failed to fetch auth config:', e);
      error.value = e instanceof Error ? e : new Error(String(e));
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
function waitForAuthConfig(): Promise<AuthConfig> {
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

