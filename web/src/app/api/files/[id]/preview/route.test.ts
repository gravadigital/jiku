import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { decodedToken } from '@/shared/utils/decoded-token';
import { GET, HEAD } from './route';

vi.mock('@/shared/utils/decoded-token', () => ({
  decodedToken: vi.fn(),
}));

function request() {
  return new NextRequest('http://localhost/api/files/252/preview');
}

function params() {
  return { params: Promise.resolve({ id: '252' }) };
}

function redirectResponse() {
  return {
    ok: false,
    status: 302,
    headers: new Headers({
      Location: 'https://bucket.test/jiku-local/f/abc.png?sig',
      'Content-Type': 'image/png',
      'Content-Disposition': 'inline; filename="messi.png"',
      'Content-Length': '1446248',
    }),
    body: null,
  } as unknown as Response;
}

describe('GET /api/files/[id]/preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(decodedToken).mockResolvedValue({ accessToken: 'token-123' } as never);
    global.fetch = vi.fn();
  });

  it('propaga el 302 con el Location de la prefirmada, sin proxear el binario', async () => {
    vi.mocked(global.fetch).mockResolvedValue(redirectResponse());

    const response = await GET(request(), params());

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('https://bucket.test/jiku-local/f/abc.png?sig');
    // En un GET no se promete cuerpo: un `Content-Length` en un 302 deja al cliente
    // esperando bytes que no llegan.
    expect(response.headers.get('Content-Length')).toBeNull();
  });

  it('pega contra el endpoint de FILES, no contra el de attachments', async () => {
    vi.mocked(global.fetch).mockResolvedValue(redirectResponse());

    await GET(request(), params());

    const [url] = vi.mocked(global.fetch).mock.calls[0];
    expect(String(url)).toContain('api/files/252/preview');
    expect(String(url)).not.toContain('attachments');
  });

  it('hace el fetch con redirect manual para no seguir la redirección', async () => {
    vi.mocked(global.fetch).mockResolvedValue(redirectResponse());

    await GET(request(), params());

    const [, init] = vi.mocked(global.fetch).mock.calls[0];
    expect((init as RequestInit).redirect).toBe('manual');
  });

  it('manda el Bearer del token de sesión', async () => {
    vi.mocked(global.fetch).mockResolvedValue(redirectResponse());

    await GET(request(), params());

    const [, init] = vi.mocked(global.fetch).mock.calls[0];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer token-123');
  });

  it('responde 401 sin sesión, sin llamar a la api', async () => {
    vi.mocked(decodedToken).mockResolvedValue(null as never);

    const response = await GET(request(), params());

    expect(response.status).toBe(401);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  /**
   * El caso que motivó esta ruta: sin handler, Next respondía un 404 SIN CUERPO y
   * `useAttachmentMeta` lo interpretaba como `file_not_available` — el usuario veía "El archivo
   * no está disponible" para un archivo que estaba perfectamente subido. El `code` del body
   * tiene que sobrevivir para que la interfaz distinga los dos casos.
   */
  it('propaga el body de error tal cual para que el `code` sobreviva', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers(),
      json: () =>
        Promise.resolve({ code: 'file_not_available', message: 'El archivo no está disponible' }),
    } as unknown as Response);

    const response = await GET(request(), params());

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: 'file_not_available',
      message: 'El archivo no está disponible',
    });
  });
});

describe('HEAD /api/files/[id]/preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(decodedToken).mockResolvedValue({ accessToken: 'token-123' } as never);
    global.fetch = vi.fn();
  });

  /** Es el método que usa `useAttachmentMeta` para resolver nombre, tamaño y mime. */
  it('propaga los metadatos en headers y responde 200', async () => {
    vi.mocked(global.fetch).mockResolvedValue(redirectResponse());

    const response = await HEAD(request(), params());

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    expect(response.headers.get('Content-Disposition')).toBe('inline; filename="messi.png"');
    // En un HEAD sí va: no promete ningún cuerpo.
    expect(response.headers.get('Content-Length')).toBe('1446248');
  });

  it('usa el método HEAD contra la api', async () => {
    vi.mocked(global.fetch).mockResolvedValue(redirectResponse());

    await HEAD(request(), params());

    const [, init] = vi.mocked(global.fetch).mock.calls[0];
    expect((init as RequestInit).method).toBe('HEAD');
  });

  it('propaga el status de error sin cuerpo', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers(),
    } as unknown as Response);

    const response = await HEAD(request(), params());

    expect(response.status).toBe(404);
  });

  it('responde 401 sin sesión', async () => {
    vi.mocked(decodedToken).mockResolvedValue(null as never);

    const response = await HEAD(request(), params());

    expect(response.status).toBe(401);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
