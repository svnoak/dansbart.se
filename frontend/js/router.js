import { createRouter, createWebHistory } from 'vue-router';
import { useAuth } from './hooks/useAuth.js';
import { useAuthConfig } from './hooks/useAuthConfig.js';
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
    meta: { page: 'playlist' }  // No requiresAuth - handles both authenticated and public access
  },
  {
    path: '/shared/:token',
    name: 'sharedPlaylist',
    // Redirect route - resolves share token to playlist ID
    redirect: to => {
      // Store the token for the redirect handler to resolve
      sessionStorage.setItem('pendingShareToken', to.params.token);
      return { name: 'resolveShare' };
    }
  },
  {
    path: '/resolve-share',
    name: 'resolveShare',
    // This route handles the async token resolution
    component: {
      template: '<div class="flex items-center justify-center min-h-screen"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>',
      async mounted() {
        const token = sessionStorage.getItem('pendingShareToken');
        sessionStorage.removeItem('pendingShareToken');

        const { useAuthConfig } = await import('./hooks/useAuthConfig.js');
        const { waitForAuthConfig, authEnabled } = useAuthConfig();
        await waitForAuthConfig();
        const fallbackRoute = authEnabled.value ? { name: 'playlists' } : { name: 'discovery' };

        if (!token) {
          this.$router.push(fallbackRoute);
          return;
        }

        try {
          const response = await fetch(`/api/playlists/share/${token}`);
          if (response.ok) {
            const playlist = await response.json();
            this.$router.replace({ name: 'playlist', params: { id: playlist.id } });
          } else {
            this.$router.push(fallbackRoute);
          }
        } catch (error) {
          console.error('Failed to resolve share token:', error);
          this.$router.push(fallbackRoute);
        }
      }
    },
    meta: { page: 'resolveShare' }
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
