import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '@/lib/axios';
import { getFolderTrail, listAllFolders, listFolders } from './foldersApi';

vi.mock('@/lib/axios', () => ({ apiClient: { get: vi.fn() } }));

const F0 = '01J9Z3K8M2Q4R6T8V0W2Y4A6F0';
const F1 = '01J9Z3K8M2Q4R6T8V0W2Y4A6F1';
const F9 = '01J9Z3K8M2Q4R6T8V0W2Y4A6F9';

const folder = (id: string, name: string, path: string, parentId: string | null) => ({
  id,
  name,
  path,
  parentId,
  inheritAcl: true,
  externalBlocked: false,
  sharingBlocked: false,
  createdAt: '2026-10-01T10:00:00.000Z',
  createdBy: 'sub-ana',
  effectivePermission: 'write',
});
const ACME = folder(F0, 'acme', '/clientes/acme/', F1);
const CLIENTES = folder(F1, 'clientes', '/clientes/', F9);
const ROOT = folder(F9, '', '/', null);

const byId = (map: Record<string, unknown>) => (url: string) => {
  const entry = map[url.split('/').pop() as string];
  return entry instanceof Error || (entry as { code?: string })?.code
    ? Promise.reject(entry)
    : Promise.resolve({ data: entry });
};

describe('listFolders (TS-9)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('no manda claves vacías', async () => {
    const page = { items: [], page: { limit: 50, returned: 0 } };
    vi.mocked(apiClient.get).mockResolvedValue({ data: page });
    await expect(listFolders({ parentId: F0, limit: 50, cursor: undefined })).resolves.toEqual({
      ok: true,
      data: page,
    });
    expect(apiClient.get).toHaveBeenCalledWith('/docs/folders', {
      params: { parentId: F0, limit: 50 },
    });
  });
});

describe('listAllFolders (TS-10)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sigue el cursor', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({
        data: { items: [ACME], page: { limit: 200, returned: 200, cursor: 'c2' } },
      })
      .mockResolvedValueOnce({ data: { items: [CLIENTES], page: { limit: 200, returned: 1 } } });
    await expect(listAllFolders()).resolves.toEqual({ ok: true, data: [ACME, CLIENTES] });
    expect(apiClient.get).toHaveBeenNthCalledWith(1, '/docs/folders', { params: { limit: 200 } });
    expect(apiClient.get).toHaveBeenNthCalledWith(2, '/docs/folders', {
      params: { limit: 200, cursor: 'c2' },
    });
  });

  it('corta en 10 páginas', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { items: [ACME], page: { limit: 200, returned: 200, cursor: 'x' } },
    });
    await listAllFolders();
    expect(apiClient.get).toHaveBeenCalledTimes(10);
  });
});

describe('getFolderTrail', () => {
  beforeEach(() => vi.clearAllMocks());

  it('TS-13: sube por parentId sin la raíz', async () => {
    vi.mocked(apiClient.get).mockImplementation(byId({ [F0]: ACME, [F1]: CLIENTES, [F9]: ROOT }));
    await expect(getFolderTrail(F0)).resolves.toEqual({
      ok: true,
      data: {
        folder: ACME,
        trail: [
          { id: F1, name: 'clientes' },
          { id: F0, name: 'acme' },
        ],
      },
    });
  });

  it('TS-14: un ancestro ilegible corta y queda como texto', async () => {
    vi.mocked(apiClient.get).mockImplementation(
      byId({ [F0]: ACME, [F1]: { code: 'folder_not_found', status: 404 } })
    );
    await expect(getFolderTrail(F0)).resolves.toEqual({
      ok: true,
      data: {
        folder: ACME,
        trail: [
          { id: null, name: 'clientes' },
          { id: F0, name: 'acme' },
        ],
      },
    });
  });

  it('un ancestro con otro error falla entero', async () => {
    vi.mocked(apiClient.get).mockImplementation(
      byId({ [F0]: ACME, [F1]: { code: 'upstream_unavailable', message: 'x', status: 503 } })
    );
    const result = await getFolderTrail(F0);
    expect(result.ok).toBe(false);
  });

  it('TS-15: la carpeta pedida inexistente devuelve su error', async () => {
    const error = { code: 'folder_not_found', message: 'Carpeta no encontrada', status: 404 };
    vi.mocked(apiClient.get).mockRejectedValue(error);
    await expect(getFolderTrail(F0)).resolves.toEqual({ ok: false, error });
  });
});
