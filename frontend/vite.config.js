import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
        'admin-panel': resolve(__dirname, 'admin-panel.html'),
        privacy: resolve(__dirname, 'privacy.html'),
        terms: resolve(__dirname, 'terms.html')
      }
    },
    minify: 'esbuild',
    sourcemap: false
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'js'),
      'vue': 'vue/dist/vue.esm-bundler.js'
    }
  }
});
