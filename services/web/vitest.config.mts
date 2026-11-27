import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    // Pins the timezone so date assertions do not depend on the machine's. A
    // date literal like '2026-08-01' is parsed as midnight UTC, which is the
    // previous day west of Greenwich: without this, tests pass locally and fail
    // in CI, where the runner is UTC.
    env: {
      TZ: 'UTC',
    },
  },
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
      '@root': new URL('./src', import.meta.url).pathname,
      '@public': new URL('./public', import.meta.url).pathname,
    },
  },
});
