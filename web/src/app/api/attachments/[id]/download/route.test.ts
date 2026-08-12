import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { decodedToken } from '@/shared/utils/decoded-token';
import { GET } from './route';

vi.mock('@/shared/utils/decoded-token', () => ({
  decodedToken: vi.fn(),
}));

describe('GET /api/attachments/[id]/download', () => {
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
        'Content-Type': 'application/pdf',
        'Content-Length': '102400',
        'Content-Disposition': 'attachment; filename="reporte.pdf"',
      }),
    } as unknown as Response);

    const response = await GET(new NextRequest('http://localhost/api/attachments/3/download'), {
      params: Promise.resolve({ id: '3' }),
    });

    expect(response.headers.get('Content-Length')).toBe('102400');
    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="reporte.pdf"');
  });

  it('retorna 401 sin token de acceso', async () => {
    vi.mocked(decodedToken).mockResolvedValue(null);

    const response = await GET(new NextRequest('http://localhost/api/attachments/3/download'), {
      params: Promise.resolve({ id: '3' }),
    });

    expect(response.status).toBe(401);
  });
});
