// @vitest-environment node
import { NextRequest } from 'next/server';
import { vi } from 'vitest';
import { GET, HEAD } from '@/app/api/files/[id]/preview/route';

// `auth` está sobrecargada en v5, así que se tipa el mock a mano.
const mockAuth = vi.fn<() => Promise<{ accessToken?: string } | null>>();
vi.mock('@/features/auth/config/nextauth.config', () => ({
  auth: () => mockAuth(),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

function makeRequest(): NextRequest {
  return {} as unknown as NextRequest;
}

function apiResponse(status: number, headers: Record<string, string> = {}, body: unknown = null) {
  return {
    status,
    headers: { get: (name: string) => headers[name] ?? null },
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(body === null ? '' : JSON.stringify(body)),
  };
}

describe('GET /api/files/[id]/preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.API_URL = 'https://api.test.io/';
  });

  it('TS-12: sin sesión responde 401 con {code, message} y sin llamar a fetch', async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await GET(makeRequest(), { params: Promise.resolve({ id: '1234' }) });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ code: 'unauthorized', message: 'Unauthorized' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('TS-13: reenvía con Bearer y redirect manual, y devuelve el 302 con su Location', async () => {
    mockAuth.mockResolvedValueOnce({ accessToken: 'tok' });
    const location = 'https://bucket.test/f/abc.pdf?X-Amz-Signature=get';
    mockFetch.mockResolvedValueOnce(
      apiResponse(302, { Location: location, 'Content-Type': 'application/pdf' })
    );

    const res = await GET(makeRequest(), { params: Promise.resolve({ id: '1234' }) });

    expect(mockFetch).toHaveBeenCalledWith(
      new URL('https://api.test.io/api/files/1234/preview'),
      expect.objectContaining({
        headers: { Authorization: 'Bearer tok' },
        redirect: 'manual',
      })
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe(location);
    expect(res.headers.get('Content-Length')).toBeNull();
  });

  it('TS-14: propaga el 404 conservando el code file_not_available', async () => {
    mockAuth.mockResolvedValueOnce({ accessToken: 'tok' });
    mockFetch.mockResolvedValueOnce(
      apiResponse(
        404,
        { 'Content-Type': 'application/json' },
        {
          code: 'file_not_available',
          message: 'El archivo no está disponible',
        }
      )
    );

    const res = await GET(makeRequest(), { params: Promise.resolve({ id: '1234' }) });

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ code: 'file_not_available' });
  });

  it('TS-15: normaliza API_URL sin barra final', async () => {
    process.env.API_URL = 'https://api.test';
    mockAuth.mockResolvedValueOnce({ accessToken: 'tok' });
    mockFetch.mockResolvedValueOnce(apiResponse(302, { Location: 'https://bucket.test/x' }));

    await GET(makeRequest(), { params: Promise.resolve({ id: '1234' }) });

    const [target] = mockFetch.mock.calls[0];
    expect(String(target)).toBe('https://api.test/api/files/1234/preview');
  });

  it('con API_URL vacío responde 500 server_misconfigured', async () => {
    process.env.API_URL = '';
    mockAuth.mockResolvedValueOnce({ accessToken: 'tok' });

    const res = await GET(makeRequest(), { params: Promise.resolve({ id: '1234' }) });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      code: 'server_misconfigured',
      message: 'API_URL is not set',
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('soporta HEAD y propaga Content-Length, que solo viaja en el HEAD', async () => {
    mockAuth.mockResolvedValueOnce({ accessToken: 'tok' });
    mockFetch.mockResolvedValueOnce(
      apiResponse(302, {
        Location: 'https://bucket.test/f/abc.pdf?sig',
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="informe.pdf"',
        'Content-Length': '4194304',
      })
    );

    const res = await HEAD(makeRequest(), { params: Promise.resolve({ id: '1234' }) });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: 'HEAD', redirect: 'manual' })
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('Content-Length')).toBe('4194304');
    expect(res.headers.get('Content-Disposition')).toBe('inline; filename="informe.pdf"');
  });
});
