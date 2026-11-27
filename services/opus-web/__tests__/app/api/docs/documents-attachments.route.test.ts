// @vitest-environment node
import { NextRequest } from 'next/server';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { vi } from 'vitest';
import { GET } from '@/app/api/docs/documents/[documentId]/attachments/[id]/route';

const mockAuth = vi.fn<() => Promise<{ accessToken?: string } | null>>();
vi.mock('@/features/auth/config/nextauth.config', () => ({
  auth: () => mockAuth(),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const DOC_ID = '01JC7Z4X9QH2M5N8R3T6V0W1YA';
const ATT_ID = '01JC7Z5B2K8D4F6G0H1J3K5M7N';
const LOCATION = 'https://bucket.test/att/diagrama.png?X-Amz-Signature=get';

function makeRequest(): NextRequest {
  return {} as unknown as NextRequest;
}

function call(documentId: string, id: string) {
  return GET(makeRequest(), { params: Promise.resolve({ documentId, id }) });
}

function apiResponse(status: number, headers: Record<string, string> = {}, body: unknown = null) {
  return {
    status,
    headers: { get: (name: string) => headers[name] ?? null },
    json: () => (body === null ? Promise.reject(new Error('no json')) : Promise.resolve(body)),
  };
}

describe('GET /api/docs/documents/[documentId]/attachments/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.API_URL = 'https://api.test.io/';
  });

  it('TS-1: sin sesión responde 401 sin llamar a fetch', async () => {
    mockAuth.mockResolvedValueOnce(null);
    const res = await call(DOC_ID, ATT_ID);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ code: 'unauthorized', message: 'Unauthorized' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('TS-2: propaga el 302 sin seguirlo y sin cuerpo', async () => {
    mockAuth.mockResolvedValueOnce({ accessToken: 'tok' });
    mockFetch.mockResolvedValueOnce(apiResponse(302, { Location: LOCATION }));
    const res = await call(DOC_ID, ATT_ID);
    expect(mockFetch).toHaveBeenCalledWith(
      new URL(`https://api.test.io/api/opus/docs/documents/${DOC_ID}/attachments/${ATT_ID}`),
      { headers: { Authorization: 'Bearer tok' }, redirect: 'manual' }
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe(LOCATION);
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(await res.text()).toBe('');
  });

  it('TS-3: API_URL sin barra final', async () => {
    process.env.API_URL = 'https://api.test.io';
    mockAuth.mockResolvedValueOnce({ accessToken: 'tok' });
    mockFetch.mockResolvedValueOnce(apiResponse(302, { Location: LOCATION }));
    await call(DOC_ID, ATT_ID);
    expect(mockFetch).toHaveBeenCalledWith(
      new URL(`https://api.test.io/api/opus/docs/documents/${DOC_ID}/attachments/${ATT_ID}`),
      expect.anything()
    );
  });

  it('TS-4: documento interno o inexistente conserva el code', async () => {
    mockAuth.mockResolvedValueOnce({ accessToken: 'tok' });
    const body = { code: 'document_not_found', message: 'Documento no encontrado' };
    mockFetch.mockResolvedValueOnce(apiResponse(404, {}, body));
    const res = await call(DOC_ID, ATT_ID);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual(body);
    expect(res.headers.get('Location')).toBeNull();
  });

  it('TS-5: adjunto de otro documento conserva el code', async () => {
    mockAuth.mockResolvedValueOnce({ accessToken: 'tok' });
    const body = { code: 'attachment_not_found', message: 'Adjunto no encontrado' };
    mockFetch.mockResolvedValueOnce(apiResponse(404, {}, body));
    const res = await call(DOC_ID, ATT_ID);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual(body);
  });

  it('TS-6: módulo caído propaga el 503', async () => {
    mockAuth.mockResolvedValueOnce({ accessToken: 'tok' });
    const body = {
      code: 'module_unavailable',
      message: 'El módulo docs no está disponible en este momento',
    };
    mockFetch.mockResolvedValueOnce(apiResponse(503, {}, body));
    const res = await call(DOC_ID, ATT_ID);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual(body);
  });

  it('TS-7: upstream sin JSON devuelve el status sin cuerpo', async () => {
    mockAuth.mockResolvedValueOnce({ accessToken: 'tok' });
    mockFetch.mockResolvedValueOnce(apiResponse(500));
    const res = await call(DOC_ID, ATT_ID);
    expect(res.status).toBe(500);
    expect(await res.text()).toBe('');
  });

  it('TS-8: un documentId que no es ULID responde 404 sin fetch', async () => {
    for (const documentId of ['..%2F..%2Fopus%2Fprojects', '123']) {
      mockAuth.mockResolvedValueOnce({ accessToken: 'tok' });
      const res = await call(documentId, ATT_ID);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        code: 'document_not_found',
        message: 'Documento no encontrado',
      });
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('TS-9: un id que no es ULID responde 404 sin fetch', async () => {
    for (const id of ['..%2F..%2Fopus%2Fprojects', '123']) {
      mockAuth.mockResolvedValueOnce({ accessToken: 'tok' });
      const res = await call(DOC_ID, id);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        code: 'attachment_not_found',
        message: 'Adjunto no encontrado',
      });
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('TS-10: con los dos ids inválidos gana el documento', async () => {
    mockAuth.mockResolvedValueOnce({ accessToken: 'tok' });
    const res = await call('123', '456');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      code: 'document_not_found',
      message: 'Documento no encontrado',
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('TS-11: sin API_URL responde 500', async () => {
    process.env.API_URL = '';
    mockAuth.mockResolvedValueOnce({ accessToken: 'tok' });
    const res = await call(DOC_ID, ATT_ID);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      code: 'server_misconfigured',
      message: 'API_URL is not set',
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('TS-12: la ruta vieja ya no existe', () => {
    expect(existsSync(path.join(process.cwd(), 'src/app/api/docs/attachments/[id]/route.ts'))).toBe(
      false
    );
  });
});
