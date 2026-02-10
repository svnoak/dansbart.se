import { createRouter, createWebHistory, type RouteRecordRaw, type NavigationGuardNext, type RouteLocationNormalized } from 'vue-router';
import { useAuth } from './hooks/useAuth';
import { useAuthConfig } from './hooks/useAuthConfig';
import AuthCallbackPage from './components/AuthCallbackPage';
import ProfilePage from './components/ProfilePage';
import PlaylistsPage from './components/PlaylistsPage';
import PlaylistDetailPage from './components/PlaylistDetailPage';
import ResolveSharePage from './components/ResolveSharePage';

const routes = [
  {
    path: '/',
    name: 'discovery',
    meta: { page: 'discovery' },
  },
  {
    path: '/search',
    name: 'search',
    meta: { page: 'search' },
  },
  {
    path: '/classify',
    name: 'classify',
    meta: { page: 'classify' },
  },
  {
    path: '/artist/:id',
    name: 'artist',
    meta: { page: 'artist' },
  },
  {
    path: '/album/:id',
    name: 'album',
    meta: { page: 'album' },
  },
  {
    path: '/track/:id',
    name: 'track',
    meta: { page: 'search' },
  },
  {
    path: '/auth/callback',
    name: 'authCallback',
    component: AuthCallbackPage,
    meta: { page: 'authCallback' },
  },
  {
    path: '/profile',
    name: 'profile',
    component: ProfilePage,
    meta: { page: 'profile', requiresAuth: true },
  },
  {
    path: '/playlists',
    name: 'playlists',
    component: PlaylistsPage,
    meta: { page: 'playlists', requiresAuth: true },
  },
  {
    path: '/playlist/:id',
    name: 'playlist',
    component: PlaylistDetailPage,
    // No requiresAuth - handles both authenticated and public access
    meta: { page: 'playlist' },
  },
  {
    path: '/shared/:token',
    name: 'sharedPlaylist',
    // Redirect route - resolves share token to playlist ID
    redirect: (to: RouteLocationNormalized) => {
      // Store the token for the redirect handler to resolve
      sessionStorage.setItem('pendingShareToken', String(to.params.token));
      return { name: 'resolveShare' };
    },
  },
  {
    path: '/resolve-share',
    name: 'resolveShare',
    component: ResolveSharePage,
    meta: { page: 'resolveShare' },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes: routes as RouteRecordRaw[],
});

// Handle old query-parameter based URLs for backwards compatibility
router.beforeEach(async (to: RouteLocationNormalized, from: RouteLocationNormalized, next: NavigationGuardNext) => {
  // Check if we're on the root path with old-style query parameters
  if (to.path === '/' && to.query.page) {
    const page = to.query.page as string;
    const id = to.query.id as string | undefined;

    // Redirect old URLs to new path-based URLs
    if (page === 'artist' && id) {
      return next({ name: 'artist', params: { id }, query: {} });
    } else if (page === 'album' && id) {
      return next({ name: 'album', params: { id }, query: {} });
    } else if (page === 'search') {
      // Preserve filter query params for search
      const { page: _page, id: _id, ...filterParams } = to.query;
      return next({ name: 'search', query: filterParams });
    } else if (page === 'classify') {
      return next({ name: 'classify', query: {} });
    }
  }

  // Handle old track deep link format
  if (to.path === '/' && to.query.track) {
    const trackId = to.query.track as string;
    const { track: _track, ...otherParams } = to.query;
    return next({ name: 'track', params: { id: trackId }, query: otherParams });
  }

  // Auth config: single backend flag drives login/playlists visibility
  const { waitForAuthConfig, authEnabled } = useAuthConfig();
  await waitForAuthConfig();

  // When auth is disabled, profile and playlists are hidden; redirect to home
  if (!authEnabled.value && (to.name === 'profile' || to.name === 'playlists')) {
    return next({ name: 'discovery' });
  }

  // Auth guard for routes that require login (only when auth is enabled)
  const { user, isAuthenticated, waitForAuth, login } = useAuth();

  if (to.meta.requiresAuth) {
    // Skip auth check if coming from callback page (we just authenticated)
    if (from.name === 'authCallback') {
      console.log('[Router] Coming from callback, skipping auth check');
      next();
      return;
    }

    // Wait for auth to initialize
    await waitForAuth();

    // Auth is initialized, check if user is authenticated
    if (!isAuthenticated.value) {
      sessionStorage.setItem('returnUrl', to.fullPath);
      login();
      return;
    }

    // Check if user needs to set a username (has auto-generated username)
    // Skip this check if already going to profile page
    if (to.name !== 'profile' && (user.value as { username?: string } | null)?.username?.startsWith('user_')) {
      console.log('[Router] User has auto-generated username, redirecting to profile');
      // Store intended destination so we can redirect after username is set
      sessionStorage.setItem('returnUrl', to.fullPath);
      return next({ name: 'profile' });
    }
  }

  next();
});

export default router;

