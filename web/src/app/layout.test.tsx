import React from 'react';
import { render } from '@testing-library/react';
import { cookies } from 'next/headers';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { THEME_STORAGE_KEY } from '@/features/theme';
import RootLayout from './layout';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('next/font/google', () => ({
  Sora: () => ({ variable: '--font-display', className: '' }),
  Gabarito: () => ({ variable: '--font-ui', className: 'gabarito' }),
}));

vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@tanstack/react-query-devtools', () => ({
  ReactQueryDevtools: () => null,
}));

const mockedCookies = vi.mocked(cookies);

function mockCookieValue(value: string | undefined) {
  mockedCookies.mockResolvedValue({
    get: (name: string) => (name === THEME_STORAGE_KEY && value !== undefined ? { name, value } : undefined),
  } as any);
}

describe('RootLayout — estampado de data-theme (S-059)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // TS-22
  it('estampa data-theme="dark" en <html> cuando la cookie dice dark', async () => {
    mockCookieValue('dark');

    const element = await RootLayout({ children: React.createElement('div', null, 'contenido') });
    render(element);

    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  // TS-23
  it('sin cookie, estampa data-theme="light"', async () => {
    mockCookieValue(undefined);

    const element = await RootLayout({ children: React.createElement('div', null, 'contenido') });
    render(element);

    expect(document.documentElement.dataset.theme).toBe('light');
  });

  // TS-24
  it('cookie con valor inválido cae a data-theme="light"', async () => {
    mockCookieValue('neon');

    const element = await RootLayout({ children: React.createElement('div', null, 'contenido') });
    render(element);

    expect(document.documentElement.dataset.theme).toBe('light');
  });

  // TS-25
  it('el estampado ocurre en el layout raíz (app/layout.tsx), leído del código fuente', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(path.join(__dirname, 'layout.tsx'), 'utf8');

    expect(source).toMatch(/data-theme/);
    expect(source).toMatch(/cookies\(\)/);
  });
});
