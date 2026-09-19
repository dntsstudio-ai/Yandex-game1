import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 8192,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
