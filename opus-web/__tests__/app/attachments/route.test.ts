/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from '@/app/attachments/[id]/[fileName]/route';
import { vi } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

function makeRequest(): NextRequest {
  return {} as unknown as NextRequest;
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

  it('llama al endpoint publico del backend y retorna stream cuando backend retorna 200', async () => {
    const fakeBody = new ReadableStream();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: fakeBody,
      headers: {
        get: (name: string) => {
          if (name === 'Content-Type') return 'image/png';
          if (name === 'Content-Disposition') return 'inline';
          return null;
        },
      },
    });

    const res = await GET(makeRequest(), {
      params: Promise.resolve({ id: '123', fileName: 'imagen.png' }),
    });

    expect(mockFetch).toHaveBeenCalledWith('https://api.test.io/api/opus/attachments/123/public');
    expect(res.status).toBe(200);
  });

  it('retorna 403 cuando el backend retorna 403', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });

    const res = await GET(makeRequest(), {
      params: Promise.resolve({ id: '999', fileName: 'privado.pdf' }),
    });

    expect(res.status).toBe(403);
  });
});
