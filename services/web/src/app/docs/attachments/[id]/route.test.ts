import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { decodedToken } from '@/shared/utils/decoded-token';
import { GET, HEAD } from './route';

vi.mock('@/shared/utils/decoded-token', () => ({ decodedToken: vi.fn() }));

const ID = '01J9Z3K8M2Q4R6T8V0W2Y4A6D1';
const S3 = 'https://s3.example.com/b/k?X-Amz-Signature=abc';
const request = () => new NextRequest(`http://localhost/docs/attachments/${ID}`);
const params = () => ({ params: Promise.resolve({ id: ID }) });

describe('GET /docs/attachments/[id]', () => {
  const originalApiUrl = process.env.API_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.API_URL = 'http://api:3000/';
    vi.mocked(decodedToken).mockResolvedValue({ accessToken: 'tok' } as never);
    global.fetch = vi.fn();
  });
  afterEach(() => {
    process.env.API_URL = originalApiUrl;
  });

  it('TS-40: sin sesión responde 401 sin llamar a la api', async () => {
    vi.mocked(decodedToken).mockResolvedValue(null as never);
    const response = await GET(request(), params());
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('TS-41: propaga el 302 sin cuerpo', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      status: 302,
      headers: new Headers({ Location: S3 }),
    } as unknown as Response);

    const response = await GET(request(), params());

    expect(global.fetch).toHaveBeenCalledWith(`http://api:3000/api/docs/attachments/${ID}`, {
      redirect: 'manual',
      headers: { Authorization: 'Bearer tok' },
    });
    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe(S3);
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.body).toBeNull();
  });

  it('TS-42: error de la api con JSON', async () => {
    const body = { code: 'attachment_not_found', message: 'Adjunto no encontrado' };
    vi.mocked(global.fetch).mockResolvedValue(new Response(JSON.stringify(body), { status: 404 }));
    const response = await GET(request(), params());
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual(body);
  });

  it('TS-43: error sin JSON', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response('<html>Bad gateway</html>', { status: 503 })
    );
    const response = await GET(request(), params());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ message: 'Download failed' });
  });

  it('TS-44: sin API_URL responde 500 y loguea', async () => {
    delete process.env.API_URL;
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await GET(request(), params());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Server configuration error' });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalled();
  });

  it('TS-45: HEAD se comporta igual que GET', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      status: 302,
      headers: new Headers({ Location: S3 }),
    } as unknown as Response);
    const response = await HEAD(request(), params());
    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe(S3);
  });
});
