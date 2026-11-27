import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { decodedToken } from '@/shared/utils/decoded-token';
import { GET, HEAD } from './route';

vi.mock('@/shared/utils/decoded-token', () => ({
  decodedToken: vi.fn(),
}));

function request() {
  return new NextRequest('http://localhost/api/attachments/42/preview');
}

function params() {
  return { params: Promise.resolve({ id: '42' }) };
}

describe('GET /api/attachments/[id]/preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(decodedToken).mockResolvedValue({ accessToken: 'token-123' } as never);
    global.fetch = vi.fn();
  });

  it('propaga el 302 con el Location de la prefirmada, sin proxear el binario', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 302,
      headers: new Headers({ Location: 'https://bucket.test/f/abc.pdf?sig' }),
      body: null,
    } as unknown as Response);

    const response = await GET(request(), params());

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('https://bucket.test/f/abc.pdf?sig');
    expect(response.headers.get('Content-Length')).toBeNull();
  });

  it('hace el fetch a la api con redirect manual para no seguir la redirección', async () => {
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

describe('HEAD /api/attachments/[id]/preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(decodedToken).mockResolvedValue({ accessToken: 'token-123' } as never);
    global.fetch = vi.fn();
  });

  it('propaga Content-Type, Content-Disposition y Content-Length de los metadatos', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 302,
      headers: new Headers({
        Location: 'https://bucket.test/f/abc.pdf?sig',
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="informe.pdf"',
        'Content-Length': '4194304',
      }),
      body: null,
    } as unknown as Response);

    const response = await HEAD(request(), params());

    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect(response.headers.get('Content-Disposition')).toBe('inline; filename="informe.pdf"');
    expect(response.headers.get('Content-Length')).toBe('4194304');
  });

  it('retorna 401 sin token de acceso', async () => {
    vi.mocked(decodedToken).mockResolvedValue(null);

    const response = await HEAD(request(), params());

    expect(response.status).toBe(401);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('propaga el status del error del upstream', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers(),
      json: () => Promise.resolve({ code: 'file_not_available' }),
    } as unknown as Response);

    const response = await HEAD(request(), params());

    expect(response.status).toBe(404);
  });
});
