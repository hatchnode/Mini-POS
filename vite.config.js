import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the built app works from any sub-path (e.g. GitHub Pages).
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
