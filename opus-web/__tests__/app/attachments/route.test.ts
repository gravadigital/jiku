// @vitest-environment node
import { NextRequest } from 'next/server';
import { GET } from '@/app/attachments/[id]/[fileName]/route';
import { vi } from 'vitest';

const mockAuth = vi.fn();
vi.mock('@/features/auth/config/nextauth.config', () => ({
  auth: () => mockAuth(),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

function makeRequest(): NextRequest {
  return {} as unknown as NextRequest;
}

function apiResponse(status: number, headers: Record<string, string> = {}) {
  return {
    status,
    headers: { get: (name: string) => headers[name] ?? null },
  };
}

describe('GET /attachments/[id]/[fileName]', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      API_URL: 'https://api.test.io/',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('TS-18: devuelve el 302 sin llamar a auth() y sin Content-Length', async () => {
    const location = 'https://bucket.test/f/x.pdf?sig';
    mockFetch.mockResolvedValueOnce(
      apiResponse(302, {
        Location: location,
        'Content-Type': 'application/pdf',
        'Content-Length': '9000',
      })
    );

    const res = await GET(makeRequest(), {
      params: Promise.resolve({ id: '77', fileName: 'informe.pdf' }),
    });

    expect(mockFetch).toHaveBeenCalledWith(
      new URL('https://api.test.io/api/opus/attachments/77/public'),
      expect.objectContaining({ redirect: 'manual' })
    );
    expect(mockAuth).not.toHaveBeenCalled();
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe(location);
    expect(res.headers.get('Content-Length')).toBeNull();
  });

  it('TS-19: propaga el 403 de adjunto no público sin cuerpo binario', async () => {
    mockFetch.mockResolvedValueOnce(apiResponse(403));

    const res = await GET(makeRequest(), {
      params: Promise.resolve({ id: '999', fileName: 'privado.pdf' }),
    });

    expect(res.status).toBe(403);
    expect(res.body).toBeNull();
  });

  it('normaliza API_URL sin barra final', async () => {
    process.env.API_URL = 'https://api.test';
    mockFetch.mockResolvedValueOnce(apiResponse(302, { Location: 'https://bucket.test/x' }));

    await GET(makeRequest(), {
      params: Promise.resolve({ id: '77', fileName: 'a.pdf' }),
    });

    expect(String(mockFetch.mock.calls[0][0])).toBe(
      'https://api.test/api/opus/attachments/77/public'
    );
  });
});
