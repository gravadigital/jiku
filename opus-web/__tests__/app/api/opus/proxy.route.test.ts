// @vitest-environment node
import { NextRequest } from 'next/server';
import { vi } from 'vitest';
import { GET, POST } from '@/app/api/opus/[...path]/route';

// `auth` está sobrecargada en v5, así que se tipa el mock a mano.
const mockAuth = vi.fn<() => Promise<{ accessToken?: string } | null>>();
vi.mock('@/features/auth/config/nextauth.config', () => ({
  auth: () => mockAuth(),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

function makeRequest(url = 'http://localhost:3001/api/opus/projects', init?: RequestInit) {
  return new NextRequest(url, init);
}

const ctx = (path: string[]) => ({ params: Promise.resolve({ path }) });

describe('proxy /api/opus/[...path]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.API_URL = 'https://api.test.io/';
  });

  it('responde 401 sin sesión, sin llamar al backend', async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await GET(makeRequest(), ctx(['projects']));

    expect(res.status).toBe(401);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('agrega el token en el servidor: el navegador nunca lo manda', async () => {
    mockAuth.mockResolvedValueOnce({ accessToken: 'token-de-sesion' });
    mockFetch.mockResolvedValueOnce(new Response('[]', { status: 200 }));

    await GET(makeRequest(), ctx(['projects']));

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.toString()).toBe('https://api.test.io/api/opus/projects');
    expect((opts.headers as Record<string, string>).Authorization).toBe('Bearer token-de-sesion');
  });

  it('preserva el query string y los segmentos anidados', async () => {
    mockAuth.mockResolvedValueOnce({ accessToken: 't' });
    mockFetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

    await GET(
      makeRequest('http://localhost:3001/api/opus/projects/7/requirements?state=en_cola'),
      ctx(['projects', '7', 'requirements'])
    );

    expect(mockFetch.mock.calls[0][0].toString()).toBe(
      'https://api.test.io/api/opus/projects/7/requirements?state=en_cola'
    );
  });

  it('propaga el status del backend en vez de traducirlo', async () => {
    mockAuth.mockResolvedValueOnce({ accessToken: 't' });
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 'access_denied' }), { status: 403 })
    );

    const res = await POST(
      makeRequest(undefined, { method: 'POST', body: '{}' }),
      ctx(['requirements'])
    );

    expect(res.status).toBe(403);
  });

  it('falla con 500 explícito si API_URL no está configurada', async () => {
    delete process.env.API_URL;
    mockAuth.mockResolvedValueOnce({ accessToken: 't' });

    const res = await GET(makeRequest(), ctx(['projects']));

    expect(res.status).toBe(500);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('no construye un cuerpo en un 204', async () => {
    mockAuth.mockResolvedValueOnce({ accessToken: 't' });
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

    const res = await GET(makeRequest(), ctx(['projects']));

    expect(res.status).toBe(204);
  });
});
