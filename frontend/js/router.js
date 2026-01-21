import { createRouter, createWebHistory } from 'vue-router';
import { useAuth } from './hooks/useAuth.js';
import AuthCallbackPage from './components/AuthCallbackPage.js';
import ProfilePage from './components/ProfilePage.js';
import PlaylistsPage from './components/PlaylistsPage.js';
import PlaylistDetailPage from './components/PlaylistDetailPage.js';

const routes = [
  {
    path: '/',
    name: 'discovery',
    meta: { page: 'discovery' }
  },
  {
    path: '/search',
    name: 'search',
    meta: { page: 'search' }
  },
  {
    path: '/classify',
    name: 'classify',
    meta: { page: 'classify' }
  },
  {
    path: '/artist/:id',
    name: 'artist',
    meta: { page: 'artist' }
  },
  {
    path: '/album/:id',
    name: 'album',
    meta: { page: 'album' }
  },
  {
    path: '/track/:id',
    name: 'track',
    meta: { page: 'search' }
  },
  {
    path: '/auth/callback',
    name: 'authCallback',
    component: AuthCallbackPage,
    meta: { page: 'authCallback' }
  },
  {
    path: '/profile',
    name: 'profile',
    component: ProfilePage,
    meta: { page: 'profile', requiresAuth: true }
  },
  {
    path: '/playlists',
    name: 'playlists',
    component: PlaylistsPage,
    meta: { page: 'playlists', requiresAuth: true }
  },
  {
    path: '/playlist/:id',
    name: 'playlist',
    component: PlaylistDetailPage,
    meta: { page: 'playlist', requiresAuth: true }
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// Handle old query-parameter based URLs for backwards compatibility
router.beforeEach(async (to, _from, next) => {
  // Check if we're on the root path with old-style query parameters
  if (to.path === '/' && to.query.page) {
    const page = to.query.page;
    const id = to.query.id;

    // Redirect old URLs to new path-based URLs
    if (page === 'artist' && id) {
      return next({ name: 'artist', params: { id }, query: {} });
    } else if (page === 'album' && id) {
      return next({ name: 'album', params: { id }, query: {} });
    } else if (page === 'search') {
      // Preserve filter query params for search
      const { page: _, id: __, ...filterParams } = to.query;
      return next({ name: 'search', query: filterParams });
    } else if (page === 'classify') {
      return next({ name: 'classify', query: {} });
    }
  }

  // Handle old track deep link format
  if (to.path === '/' && to.query.track) {
    const trackId = to.query.track;
    const { track: _, ...otherParams } = to.query;
    return next({ name: 'track', params: { id: trackId }, query: otherParams });
  }

  // Auth guard
  const { user, isAuthenticated, waitForAuth, login } = useAuth();

  // Wait for auth initialization before checking authentication
  if (to.meta.requiresAuth) {
    // Skip auth check if coming from callback page (we just authenticated)
    if (_from.name === 'authCallback') {
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
    if (to.name !== 'profile' && user.value?.username?.startsWith('user_')) {
      console.log('[Router] User has auto-generated username, redirecting to profile');
      // Store intended destination so we can redirect after username is set
      sessionStorage.setItem('returnUrl', to.fullPath);
      return next({ name: 'profile' });
    }
  }

  next();
});

export default router;
