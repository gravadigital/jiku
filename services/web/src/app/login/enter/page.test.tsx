import fs from 'node:fs';
import path from 'node:path';
import { redirect } from 'next/navigation';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '@/lib/axios';
import LoginEnter from './page';

vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('@/lib/axios', () => ({ apiClient: { post: vi.fn() } }));

describe('login-entrada (/login/enter)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TS-6 (S-034): falla POST /auth/present y aun así redirige a "/" (sin consecuencia visible)', async () => {
    // presentInApi() traga el error internamente (authApi.ts) — simulamos el fallo en el punto
    // real donde ocurre, sin mockear presentInApi por encima de su propio try/catch.
    vi.mocked(apiClient.post).mockRejectedValue(new Error('Failed to present in API'));

    await LoginEnter();

    expect(apiClient.post).toHaveBeenCalledWith('/auth/present', {});
    expect(redirect).toHaveBeenCalledWith('/');
  });

  // TS-33 (S-059): esta ruta pública siempre redirige y nunca renderiza markup propio (no hay
  // <html>/sidebar que montar acá — el estampado de data-theme lo cubre el layout raíz, ver
  // src/app/layout.test.tsx TS-22/TS-23/TS-24), así que no puede montar el selector de tema. Se
  // confirma leyendo el código fuente en vez de renderizar: el componente no devuelve JSX.
  it('S-059 TS-33: no renderiza ningún markup propio (siempre redirige) — no puede montar el selector de tema', () => {
    const source = fs.readFileSync(path.resolve(__dirname, './page.tsx'), 'utf8');
    expect(source).not.toMatch(/return\s*\(?\s*</);
    expect(source).not.toMatch(/SidebarNav|ThemeToggle/);
  });
});
