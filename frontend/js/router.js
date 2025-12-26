import { createRouter, createWebHistory } from 'vue-router';

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
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// Handle old query-parameter based URLs for backwards compatibility
router.beforeEach((to, _from, next) => {
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

  next();
});

export default router;
