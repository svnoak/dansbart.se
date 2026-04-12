import { defineConfig } from 'orval';

export default defineConfig({
  dansbart: {
    input: {
      target: './openapi.json',
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
          'Admin: Users',
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
          path: './src/api/http-client.ts',
          name: 'httpClient',
        },
        fetch: {
          // Return the response body only; types then match what the backend actually sends.
          includeHttpResponseReturnType: false,
        },
      },
    },
  },
});

