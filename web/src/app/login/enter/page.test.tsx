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
});
