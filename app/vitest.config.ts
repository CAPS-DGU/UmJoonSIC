import path from 'path';
import { defineConfig } from 'vitest/config';

// Unit tests for modules without Electron or DOM (renderer and main process): `pnpm test`.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'electron/**/*.test.ts'],
    environment: 'node',
  },
});
