import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { decodedToken } from '@/shared/utils/decoded-token';
import { GET } from './route';

vi.mock('@/shared/utils/decoded-token', () => ({
  decodedToken: vi.fn(),
}));

describe('GET /api/attachments/[id]/preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(decodedToken).mockResolvedValue({ accessToken: 'token-123' } as any);
    global.fetch = vi.fn();
  });

  it('propaga Content-Length y Content-Disposition del backend en la respuesta', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      body: new ReadableStream(),
      headers: new Headers({
        'Content-Type': 'image/png',
        'Content-Length': '204800',
        'Content-Disposition': 'inline; filename="foto.png"',
      }),
    } as unknown as Response);

    const response = await GET(new NextRequest('http://localhost/api/attachments/7/preview'), {
      params: Promise.resolve({ id: '7' }),
    });

    expect(response.headers.get('Content-Length')).toBe('204800');
    expect(response.headers.get('Content-Disposition')).toBe('inline; filename="foto.png"');
    expect(response.headers.get('Content-Type')).toBe('image/png');
  });

  it('no incluye Content-Length si el backend no lo provee', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      body: new ReadableStream(),
      headers: new Headers({ 'Content-Type': 'image/png' }),
    } as unknown as Response);

    const response = await GET(new NextRequest('http://localhost/api/attachments/7/preview'), {
      params: Promise.resolve({ id: '7' }),
    });

    expect(response.headers.get('Content-Length')).toBeNull();
  });

  it('retorna 401 sin token de acceso', async () => {
    vi.mocked(decodedToken).mockResolvedValue(null);

    const response = await GET(new NextRequest('http://localhost/api/attachments/7/preview'), {
      params: Promise.resolve({ id: '7' }),
    });

    expect(response.status).toBe(401);
  });
});
