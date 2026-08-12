import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  css: {
    // `generateScopedName` es una opción de postcss-modules, y Vite 8 usa lightningcss
    // por defecto, que la ignora.
    transformer: 'postcss',
    modules: {
      // Los tests afirman sobre los nombres de clase sin hashear (`toHaveClass('full')`),
      // que es lo que hacía `next/jest`. Sin esto Vite entrega `_full_75cd92`.
      generateScopedName: '[local]',
    },
  },
  test: {
    environment: 'jsdom',
    // Procesa los CSS modules en vez de devolver un proxy vacío.
    css: true,
    // `globals: true` deja disponibles describe/it/expect sin importarlos, igual que jest.
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    // Los tests viven en dos lugares: __tests__/ y junto al código.
    include: ['{src,__tests__}/**/*.{test,spec}.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
      // react-markdown no funciona en jsdom: se sustituye por un render plano.
      'react-markdown': new URL('./__mocks__/react-markdown.tsx', import.meta.url).pathname,
    },
  },
});
