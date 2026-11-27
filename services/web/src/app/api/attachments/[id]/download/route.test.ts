import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { decodedToken } from '@/shared/utils/decoded-token';
import { GET } from './route';

vi.mock('@/shared/utils/decoded-token', () => ({
  decodedToken: vi.fn(),
}));

function request() {
  return new NextRequest('http://localhost/api/attachments/42/download');
}

function params() {
  return { params: Promise.resolve({ id: '42' }) };
}

describe('GET /api/attachments/[id]/download', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(decodedToken).mockResolvedValue({ accessToken: 'token-123' } as never);
    global.fetch = vi.fn();
  });

  it('propaga el 302 con el Location de la prefirmada, sin Content-Length', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 302,
      headers: new Headers({
        Location: 'https://bucket.test/f/abc.pdf?sig&disp=attachment',
      }),
      body: null,
    } as unknown as Response);

    const response = await GET(request(), params());

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe(
      'https://bucket.test/f/abc.pdf?sig&disp=attachment'
    );
    expect(response.headers.get('Content-Length')).toBeNull();
  });

  it('hace el fetch a la api con redirect manual', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 302,
      headers: new Headers({ Location: 'https://bucket.test/f/abc.pdf?sig' }),
      body: null,
    } as unknown as Response);

    await GET(request(), params());

    const [, init] = vi.mocked(global.fetch).mock.calls[0];
    expect((init as RequestInit).redirect).toBe('manual');
  });

  it('propaga el 404 de archivo no disponible con su código', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers(),
      json: () =>
        Promise.resolve({
          code: 'file_not_available',
          message: 'El archivo no está disponible',
        }),
    } as unknown as Response);

    const response = await GET(request(), params());

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: 'file_not_available',
      message: 'El archivo no está disponible',
    });
  });

  it('retorna 401 sin token de acceso y no llama a la api', async () => {
    vi.mocked(decodedToken).mockResolvedValue(null);

    const response = await GET(request(), params());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
