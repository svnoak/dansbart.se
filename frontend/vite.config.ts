import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import faroUploader from '@grafana/faro-rollup-plugin';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    ...(process.env.FARO_API_KEY
      ? [
          faroUploader({
            appName: process.env.FARO_APP_NAME ?? 'dansbart-frontend',
            endpoint: process.env.FARO_UPLOAD_ENDPOINT ?? '',
            appId: process.env.FARO_APP_ID ?? '',
            stackId: process.env.FARO_STACK_ID ?? '',
            apiKey: process.env.FARO_API_KEY,
            gzipContents: true,
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
      // DiscourseConnect flow: proxy /sso/* to Spring so the backend can handle
      // the SSO initiation and callback. The React /login page is served by Vite directly.
      '/sso': { target: 'http://localhost:8000', changeOrigin: true },
      '/logout': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
