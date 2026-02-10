/**
 * Feature flags. Auth is driven by backend GET /api/config/auth (use useAuthConfig()).
 */

export const FEATURES = {
  ENABLE_PLAYLISTS: true,
  ENABLE_USER_PROFILE: true,
} as const;
