/**
 * Feature flags for application features.
 *
 * Auth is driven by the backend: GET /api/config/auth returns authEnabled.
 * When authEnabled is false: no login, no playlists, no profile (use useAuthConfig()).
 * When authEnabled is true: full OIDC login, playlists, profile.
 *
 * Optional toggles below only apply when auth is enabled; they are not read from backend.
 */

export const FEATURES = {
  ENABLE_PLAYLISTS: true,
  ENABLE_USER_PROFILE: true,
};
