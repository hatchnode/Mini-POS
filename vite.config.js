import { defineConfig } from 'vite';
import { serviceWorkerPlugin } from './tools/serviceWorkerPlugin.js';

export default defineConfig({
  // Relative base so the built app works from any sub-path (e.g. GitHub Pages).
  base: './',
  plugins: [serviceWorkerPlugin()],
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
