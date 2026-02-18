import { defineConfig } from 'orval';

export default defineConfig({
  dansbart: {
    input: {
      target: 'http://localhost:8000/v3/api-docs',
      filters: {
        tags: [
          'Discovery',
          'Playlists',
          'Artists',
          'Stats',
          'Styles',
          'Analytics',
          'Tracks',
          'Albums',
          'Users',
          'Data Export',
          'Structure Versions',
          'auth-config-controller',
          'Admin - Tracks',
          'Admin Artists',
          'Admin Albums',
          'Admin Style Keywords',
          'Admin Analytics',
          'Admin Spotify',
          'Admin Pending',
          'Admin Duplicates',
          'Admin Maintenance',
          'Admin Rejections',
          'Admin',
          'Admin Spider',
        ],
      },
    },
    output: {
      mode: 'tags-split',
      target: './src/api/generated',
      schemas: './src/api/models',
      client: 'fetch',
      clean: true,
      prettier: true,
      override: {
        mutator: {
          path: './src/api/custom-fetch.ts',
          name: 'customFetch',
        },
        fetch: {
          // Return the response body only; types then match what the backend actually sends.
          includeHttpResponseReturnType: false,
        },
      },
    },
  },
});

