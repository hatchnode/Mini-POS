import { defineConfig } from 'vite';
import { serviceWorkerPlugin } from './tools/serviceWorkerPlugin.js';

export default defineConfig({
  // Relative base so the built app works from any sub-path (e.g. GitHub Pages).
  base: './',
  plugins: [serviceWorkerPlugin()],
  // With "npm run server" running, the dev server passes API calls on to it.
  server: { proxy: { '/api': 'http://localhost:8080' } },
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
