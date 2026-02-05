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
      target: './js/api/generated',
      schemas: './js/api/models',
      client: 'fetch',
      clean: true,
      prettier: true,
      override: {
        mutator: {
          path: './js/api/custom-fetch.ts',
          name: 'customFetch',
        },
      },
    },
  },
  dansbartAdmin: {
    input: {
      target: '../api-spec/openapi.yaml',
      filters: {
        tags: [
          'Admin',
          'Admin - Tracks',
          'Admin Artists',
          'Admin Albums',
          'Admin Rejections',
          'Admin Maintenance',
          'Admin Style Keywords',
          'Admin Spider',
          'Admin Spotify',
          'Admin Duplicates',
          'Admin Pending',
          'Admin Analytics',
          'admin-auth-controller',
        ],
      },
    },
    output: {
      mode: 'tags-split',
      target: './admin/api/generated',
      schemas: './admin/api/models',
      client: 'fetch',
      clean: true,
      prettier: true,
      override: {
        mutator: {
          path: './admin/api/custom-fetch.ts',
          name: 'customAdminFetch',
        },
      },
    },
  },
});
