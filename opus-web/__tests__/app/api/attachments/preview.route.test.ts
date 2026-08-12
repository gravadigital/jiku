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

describe('GET /api/attachments/[id]/preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.API_URL = 'https://api.test.io/';
  });

  it('retorna 401 cuando no hay sesion activa', async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await GET(makeRequest(), { params: Promise.resolve({ id: '123' }) });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: 'Unauthorized' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('hace pipe del stream cuando el backend retorna 200', async () => {
    mockAuth.mockResolvedValueOnce({ accessToken: 'token-xyz' });

    const fakeBody = new ReadableStream();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: fakeBody,
      headers: {
        get: (name: string) => {
          if (name === 'Content-Type') return 'image/png';
          if (name === 'Content-Disposition') return 'inline';
          if (name === 'Content-Length') return null;
          return null;
        },
      },
    });

    const res = await GET(makeRequest(), { params: Promise.resolve({ id: '123' }) });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.test.io/api/opus/attachments/123/preview',
      expect.objectContaining({
        headers: { Authorization: 'Bearer token-xyz' },
      })
    );
    expect(res.status).toBe(200);
  });

  it('retorna el status del backend cuando no es ok', async () => {
    mockAuth.mockResolvedValueOnce({ accessToken: 'token-xyz' });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
    });

    const res = await GET(makeRequest(), { params: Promise.resolve({ id: '999' }) });

    expect(res.status).toBe(403);
  });
});
