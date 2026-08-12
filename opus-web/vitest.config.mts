import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  css: {
    // `generateScopedName` is a postcss-modules option, and Vite 8 defaults to
    // lightningcss, which ignores it.
    transformer: 'postcss',
    modules: {
      // The tests assert on unhashed class names (`toHaveClass('full')`), which is
      // what `next/jest` produced. Without this Vite yields `_full_75cd92`.
      generateScopedName: '[local]',
    },
  },
  test: {
    environment: 'jsdom',
    // Processes CSS modules instead of returning an empty proxy.
    css: true,
    // `globals: true` exposes describe/it/expect without importing them, like jest.
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    // Tests live in two places: __tests__/ and next to the code.
    include: ['{src,__tests__}/**/*.{test,spec}.{ts,tsx}'],
    // Pins the timezone so date assertions do not depend on the machine's. See
    // the note in web/vitest.config.mts.
    env: {
      TZ: 'UTC',
    },
  },
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
      // react-markdown does not work in jsdom: replaced by a plain render.
      'react-markdown': new URL('./__mocks__/react-markdown.tsx', import.meta.url).pathname,
    },
  },
});
