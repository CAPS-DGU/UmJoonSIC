import path from 'path';
import { defineConfig } from 'vitest/config';

// Unit tests for the renderer's pure modules (no Electron, no DOM): `pnpm test`.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
