// @vitest-environment node
import { NextRequest } from 'next/server';
import { vi } from 'vitest';
import { GET } from '@/app/api/attachments/[id]/preview/route';

// `auth` está sobrecargada en v5 (sirve como wrapper de middleware y como getter de
// sesión), así que se tipa el mock a mano: vi.mocked() resolvería la firma equivocada.
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
  };
}

describe('GET /api/attachments/[id]/preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.API_URL = 'https://api.test.io/';
  });

  it('retorna 401 cuando no hay sesion activa', async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await GET(makeRequest(), { params: Promise.resolve({ id: '123' }) });

    expect(res.status).toBe(401);
    // El formato viejo `{error}` se conserva a propósito: cambiarlo es un cambio de
    // contrato fuera del alcance de S-007, y ADR-009 lo cita literalmente.
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('TS-16: sigue el 302 y no propaga Content-Length', async () => {
    mockAuth.mockResolvedValueOnce({ accessToken: 'token-xyz' });
    const location = 'https://bucket.test/f/x.png?sig';
    mockFetch.mockResolvedValueOnce(
      apiResponse(302, {
        Location: location,
        'Content-Type': 'image/png',
        'Content-Length': '5000',
      })
    );

    const res = await GET(makeRequest(), { params: Promise.resolve({ id: '77' }) });

    expect(mockFetch).toHaveBeenCalledWith(
      new URL('https://api.test.io/api/opus/attachments/77/preview'),
      expect.objectContaining({
        headers: { Authorization: 'Bearer token-xyz' },
        redirect: 'manual',
      })
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe(location);
    expect(res.headers.get('Content-Length')).toBeNull();
  });

  it('TS-17: propaga el 404 conservando el code file_not_available', async () => {
    mockAuth.mockResolvedValueOnce({ accessToken: 'token-xyz' });
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

    const res = await GET(makeRequest(), { params: Promise.resolve({ id: '77' }) });

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ code: 'file_not_available' });
  });

  it('retorna el status del backend cuando no es ok', async () => {
    mockAuth.mockResolvedValueOnce({ accessToken: 'token-xyz' });
    mockFetch.mockResolvedValueOnce(apiResponse(403));

    const res = await GET(makeRequest(), { params: Promise.resolve({ id: '999' }) });

    expect(res.status).toBe(403);
  });

  it('normaliza API_URL sin barra final', async () => {
    process.env.API_URL = 'https://api.test';
    mockAuth.mockResolvedValueOnce({ accessToken: 'token-xyz' });
    mockFetch.mockResolvedValueOnce(apiResponse(302, { Location: 'https://bucket.test/x' }));

    await GET(makeRequest(), { params: Promise.resolve({ id: '77' }) });

    expect(String(mockFetch.mock.calls[0][0])).toBe(
      'https://api.test/api/opus/attachments/77/preview'
    );
  });
});
