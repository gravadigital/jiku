import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { decodedToken } from '@/shared/utils/decoded-token';
import { POST } from './route';

vi.mock('@/shared/utils/decoded-token', () => ({ decodedToken: vi.fn() }));

const ID = '01J9Z3K8M2Q4R6T8V0W2Y4A6C8';
const SESSION = '01J9Z3K8M2Q4R6T8V0W2Y4A6E2';

const call = (id: string, rawBody: string) =>
  POST(
    new NextRequest(`http://localhost/api/docs/documents/${id}/unlock`, {
      method: 'POST',
      body: rawBody,
    }),
    { params: Promise.resolve({ id }) }
  );

describe('POST /api/docs/documents/[id]/unlock', () => {
  const originalApiUrl = process.env.API_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.API_URL = 'http://api:3000/';
    global.fetch = vi.fn();
    vi.mocked(decodedToken).mockResolvedValue({ accessToken: 'tok' } as never);
  });
  afterEach(() => {
    process.env.API_URL = originalApiUrl;
    vi.restoreAllMocks();
  });

  it('TS-25: sin sesión responde 401 y no llama a la api', async () => {
    vi.mocked(decodedToken).mockResolvedValue(null as never);
    const res = await call(ID, JSON.stringify({ sessionId: SESSION }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('TS-26: reenvía solo sessionId (nunca force)', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ id: ID }), { status: 200 })
    );
    const res = await call(ID, JSON.stringify({ sessionId: SESSION, force: true }));
    expect(global.fetch).toHaveBeenCalledWith(`http://api:3000/api/docs/documents/${ID}/unlock`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: `{"sessionId":"${SESSION}"}`,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: ID });
  });

  it.each([
    ['id inválido', 'no-ulid', JSON.stringify({ sessionId: SESSION }), 404, 'document_not_found'],
    ['body vacío', ID, '{}', 400, 'invalid_fields'],
    ['body no JSON', ID, 'xx', 400, 'invalid_fields'],
    ['sessionId inválido', ID, JSON.stringify({ sessionId: 'abc' }), 400, 'invalid_fields'],
  ])('TS-27: %s', async (_name, id, body, status, code) => {
    const res = await call(id, body);
    expect(res.status).toBe(status);
    expect((await res.json()).code).toBe(code);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('TS-28a: propaga el error de la api', async () => {
    const error = { code: 'lock_not_held', message: 'La sesión no tiene el lock' };
    vi.mocked(global.fetch).mockResolvedValue(new Response(JSON.stringify(error), { status: 409 }));
    const res = await call(ID, JSON.stringify({ sessionId: SESSION }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual(error);
  });

  it('TS-28b: un cuerpo no JSON del upstream cae al mensaje por defecto', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response('<html>', { status: 502 }));
    const res = await call(ID, JSON.stringify({ sessionId: SESSION }));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ message: 'Unlock failed' });
  });

  it('TS-28d: un fallo de red hacia la api responde 502', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new TypeError('fetch failed'));
    const res = await call(ID, JSON.stringify({ sessionId: SESSION }));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ message: 'Unlock failed' });
  });

  it('TS-29: el BFF existe y no hay route.ts bajo (loggedin)/docs', () => {
    const root = path.resolve(__dirname, '../../../../../../..');
    expect(fs.existsSync(path.join(root, 'src/app/api/docs/documents/[id]/unlock/route.ts'))).toBe(
      true
    );
    expect(fs.existsSync(path.join(root, 'src/app/(loggedin)/docs/route.ts'))).toBe(false);
  });

  it('TS-28c: sin API_URL responde 500 y loguea', async () => {
    delete process.env.API_URL;
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await call(ID, JSON.stringify({ sessionId: SESSION }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Server configuration error' });
    expect(spy).toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
