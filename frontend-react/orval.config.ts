import { defineConfig } from 'orval';

export default defineConfig({
  dansbart: {
    input: {
      target: '../api-spec/openapi.yaml',
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
        fetch: {
          // Return the response body only; types then match what the backend actually sends.
          includeHttpResponseReturnType: false,
        },
      },
    },
  },
});

