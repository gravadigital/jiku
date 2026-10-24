import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient } from '@/lib/axios';
import { createShare, listShares, revokeShare } from './sharesApi';

vi.mock('@/lib/axios', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

const DOC = '01J9Z3K8M2Q4R6T8V0W2Y4A6C8';
const SHARE_ID = '01J9Z3K8M2Q4R6T8V0W2Y4A6S1';
const SHARE_ACTIVE = {
  id: SHARE_ID,
  documentId: DOC,
  mode: 'latest',
  version: null,
  includeAttachments: true,
  note: 'para soporte ACME',
  status: 'active',
  createdBy: 'sub-ana',
  createdAt: '2026-10-24T12:00:00.000Z',
  expiresAt: '2026-11-08T12:00:00.000Z',
  revokedAt: null,
  revokedBy: null,
  revokeReason: null,
  accessCount: 3,
  lastAccessAt: '2026-10-25T09:30:00.000Z',
};
const CREATED = {
  id: SHARE_ID,
  token: 'jds_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCde',
  url: 'https://docs-publico.ejemplo.com/p/docs/jds_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCde',
  expiresAt: '2026-11-08T12:00:00.000Z',
};

describe('sharesApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-24T12:00:00.000Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('TS-1: listShares pide una página de 200', async () => {
    const page = { items: [SHARE_ACTIVE], page: { limit: 200, returned: 1 } };
    vi.mocked(apiClient.get).mockResolvedValue({ data: page });
    const result = await listShares(DOC);
    expect(apiClient.get).toHaveBeenCalledWith(`/docs/documents/${DOC}/shares`, {
      params: { limit: 200 },
    });
    expect(result).toEqual({ ok: true, data: page });
  });

  it('TS-2: listShares con error no lanza', async () => {
    const error = {
      code: 'module_unavailable',
      message: 'El módulo docs no está disponible en este momento',
      status: 503,
    };
    vi.mocked(apiClient.get).mockRejectedValue(error);
    expect(await listShares(DOC)).toEqual({ ok: false, error });
  });

  it('TS-3: createShare 15 días, con nota y adjuntos', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: CREATED });
    const result = await createShare(DOC, {
      expiresInDays: 15,
      includeAttachments: true,
      note: '  para soporte ACME  ',
    });
    expect(apiClient.post).toHaveBeenCalledWith(`/docs/documents/${DOC}/shares`, {
      mode: 'latest',
      expiresAt: '2026-11-08T12:00:00.000Z',
      includeAttachments: true,
      note: 'para soporte ACME',
    });
    expect(result).toEqual({ ok: true, data: CREATED });
  });

  it('TS-4: createShare sin nota, solo el texto, 180 días', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: CREATED });
    await createShare(DOC, { expiresInDays: 180, includeAttachments: false, note: '   ' });
    expect(apiClient.post).toHaveBeenCalledWith(`/docs/documents/${DOC}/shares`, {
      mode: 'latest',
      expiresAt: '2027-04-22T12:00:00.000Z',
      includeAttachments: false,
    });
  });

  it('TS-5: createShare reconociendo el aviso', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: CREATED });
    await createShare(DOC, {
      expiresInDays: 30,
      includeAttachments: true,
      acknowledgeSecretWarning: true,
    });
    expect(apiClient.post).toHaveBeenLastCalledWith(`/docs/documents/${DOC}/shares`, {
      mode: 'latest',
      expiresAt: '2026-11-23T12:00:00.000Z',
      includeAttachments: true,
      acknowledgeSecretWarning: true,
    });
    await createShare(DOC, {
      expiresInDays: 30,
      includeAttachments: true,
      acknowledgeSecretWarning: false,
    });
    const body = vi.mocked(apiClient.post).mock.calls[1][1] as Record<string, unknown>;
    expect('acknowledgeSecretWarning' in body).toBe(false);
  });

  it('TS-6: días fuera de la lista no llama a la api', async () => {
    const result = await createShare(DOC, {
      expiresInDays: 365 as never,
      includeAttachments: true,
    });
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      error: { code: 'share_expiry_invalid', message: 'El vencimiento no es válido', status: 400 },
    });
  });

  it('TS-7: createShare con aviso de secreto devuelve el code', async () => {
    const error = {
      code: 'secret_warning_not_acknowledged',
      message: 'El documento tiene una posible credencial',
      status: 400,
    };
    vi.mocked(apiClient.post).mockRejectedValue(error);
    expect(await createShare(DOC, { expiresInDays: 30, includeAttachments: true })).toEqual({
      ok: false,
      error,
    });
  });

  it('TS-8: revokeShare usa el id del link', async () => {
    const data = { id: SHARE_ID, revokedAt: '2026-10-24T12:05:00.000Z' };
    vi.mocked(apiClient.delete).mockResolvedValue({ data });
    const result = await revokeShare(SHARE_ID);
    expect(apiClient.delete).toHaveBeenCalledWith(`/docs/shares/${SHARE_ID}`);
    expect(result).toEqual({ ok: true, data });
  });

  it('TS-9: no loguea la URL ni el token', async () => {
    const spies = (['warn', 'error', 'log'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => undefined)
    );
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: CREATED });
    await createShare(DOC, { expiresInDays: 15, includeAttachments: true });
    vi.mocked(apiClient.post).mockRejectedValueOnce({
      code: 'secret_warning_not_acknowledged',
      message: 'x',
      status: 400,
    });
    await createShare(DOC, { expiresInDays: 15, includeAttachments: true });
    const logged = JSON.stringify(spies.flatMap((s) => s.mock.calls));
    expect(logged).not.toContain('jds_');
    expect(logged).not.toContain('docs-publico.ejemplo.com');
    spies.forEach((s) => s.mockRestore());
  });
});
