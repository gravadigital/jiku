import { AxiosError, type AxiosResponse } from 'axios';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));

function buildUnauthorizedError(code: string, message: string): AxiosError {
  const error = new AxiosError(message);
  error.response = {
    status: 401,
    data: { code, message },
  } as AxiosResponse;
  return error;
}

describe('apiClient response interceptor (S-034)', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    // @ts-expect-error -- jsdom allows reassigning window.location for this test
    delete window.location;
    // @ts-expect-error -- minimal stub, only `href` is exercised by the interceptor
    window.location = { href: '' };
  });

  afterEach(() => {
    // @ts-expect-error -- restoring the original jsdom Location after the test-only stub
    window.location = originalLocation;
    vi.resetModules();
  });

  it('TS-2 (S-034): 401 con code "unauthorized" redirige a /login y propaga el error normalizado', async () => {
    const { apiClient } = await import('./axios');
    const rejectedHandler = apiClient.interceptors.response.handlers?.[0]?.rejected;
    expect(rejectedHandler).toBeTypeOf('function');

    const error = buildUnauthorizedError('unauthorized', 'Unauthorized');

    await expect(rejectedHandler!(error)).rejects.toEqual({
      code: 'unauthorized',
      message: 'Unauthorized',
      status: 401,
    });
    expect(window.location.href).toBe('/login');
  });

  it('TS-3 (S-034): 401 con code "user_not_found" (histórico) redirige a /login igual, sin rama especial', async () => {
    const { apiClient } = await import('./axios');
    const rejectedHandler = apiClient.interceptors.response.handlers?.[0]?.rejected;
    expect(rejectedHandler).toBeTypeOf('function');

    const error = buildUnauthorizedError('user_not_found', 'User not found');

    await expect(rejectedHandler!(error)).rejects.toEqual({
      code: 'user_not_found',
      message: 'User not found',
      status: 401,
    });
    expect(window.location.href).toBe('/login');
  });

  it('TS-1 (S-082): conserva `details` cuando viene y no agrega la clave cuando no', async () => {
    const { apiClient } = await import('./axios');
    const rejectedHandler = apiClient.interceptors.response.handlers?.[0]?.rejected;

    const conflict = new AxiosError('x');
    conflict.response = {
      status: 409,
      data: {
        code: 'version_conflict',
        message: 'El documento cambió',
        details: { currentVersion: 7 },
      },
    } as AxiosResponse;
    await expect(rejectedHandler!(conflict)).rejects.toEqual({
      code: 'version_conflict',
      message: 'El documento cambió',
      status: 409,
      details: { currentVersion: 7 },
    });

    const plain = new AxiosError('x');
    plain.response = { status: 404, data: { code: 'nf', message: 'nf' } } as AxiosResponse;
    const rejected = await rejectedHandler!(plain).catch((e: object) => e);
    expect('details' in (rejected as object)).toBe(false);
  });
});
