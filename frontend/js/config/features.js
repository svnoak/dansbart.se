/**
 * Feature flags for controlling application features
 *
 * Toggle these flags to enable/disable features during development
 */

export const FEATURES = {
  // Authentication and user features
  // Set to false to hide login button and all auth-dependent features
  ENABLE_AUTH_FEATURES: false,

  // Individual feature toggles (only apply if ENABLE_AUTH_FEATURES is true)
  ENABLE_PLAYLISTS: true,
  ENABLE_USER_PROFILE: true,
};
