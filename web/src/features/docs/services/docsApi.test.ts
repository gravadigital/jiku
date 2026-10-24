import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient } from '@/lib/axios';
import { getDocument, listDocuments } from './docsApi';

vi.mock('@/lib/axios', () => ({ apiClient: { get: vi.fn() } }));

const ID = '01J9Z3K8M2Q4R6T8V0W2Y4A6C8';
const DOC_A = {
  id: ID,
  title: 'Arquitectura',
  path: '/clientes/acme/arquitectura.md',
  folderId: '01J9Z3K8M2Q4R6T8V0W2Y4A6F0',
  fileName: 'arquitectura.md',
  version: 6,
  visibility: 'internal',
  updatedAt: '2026-10-24T14:30:00.000Z',
  updatedBy: 'sub-ana',
  lock: null,
};
const FOLDER = {
  id: '01J9Z3K8M2Q4R6T8V0W2Y4A6F0',
  path: '/clientes/acme/',
  effectivePermission: 'read',
  sharingBlocked: false,
};

describe('listDocuments', () => {
  beforeEach(() => vi.clearAllMocks());

  it('TS-2: arma los params sin claves vacías', async () => {
    const page = { items: [DOC_A], page: { limit: 10, returned: 1 } };
    vi.mocked(apiClient.get).mockResolvedValue({ data: page });

    const result = await listDocuments({
      projectId: 12,
      limit: 10,
      cursor: undefined,
      requirementId: undefined,
    });

    expect(apiClient.get).toHaveBeenCalledWith('/docs/documents', {
      params: { projectId: 12, limit: 10 },
    });
    const params = vi.mocked(apiClient.get).mock.calls[0][1]?.params;
    expect(Object.keys(params as object)).toEqual(['projectId', 'limit']);
    expect(result).toEqual(page);
  });

  it('TS-3: con cursor', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { items: [], page: {} } });
    await listDocuments({ requirementId: 45, limit: 10, cursor: 'c2' });
    expect(apiClient.get).toHaveBeenCalledWith('/docs/documents', {
      params: { requirementId: 45, limit: 10, cursor: 'c2' },
    });
  });
});

describe('getDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });
  afterEach(() => vi.restoreAllMocks());

  it('TS-4: devuelve el detalle compuesto sin transformar', async () => {
    const data = {
      ...DOC_A,
      content: '# Hola',
      relations: { projects: [12] },
      topics: ['infra'],
      attachments: [],
      folder: FOLDER,
    };
    vi.mocked(apiClient.get).mockResolvedValue({ data });

    await expect(getDocument(ID)).resolves.toEqual(data);
    expect(apiClient.get).toHaveBeenCalledWith(`/docs/documents/${ID}`);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('TS-5: con contentUrl descarga el contenido del lado del servidor sin loguear la URL', async () => {
    const url = 'https://s3.example.com/docs/x?X-Amz-Signature=abc';
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { ...DOC_A, contentUrl: url, folder: FOLDER },
    });
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '# Grande',
    } as unknown as Response);
    const spies = (['log', 'warn', 'error', 'info'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {})
    );

    const result = await getDocument(ID);

    expect(result.content).toBe('# Grande');
    expect(result.contentUrl).toBe(url);
    expect(vi.mocked(global.fetch).mock.calls[0][0]).toBe(url);
    for (const spy of spies) {
      expect(JSON.stringify(spy.mock.calls)).not.toContain(url);
    }
  });

  it('TS-6: con contentUrl que falla rechaza con content_unavailable', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { ...DOC_A, contentUrl: 'https://s3.example.com/x', folder: FOLDER },
    });
    vi.mocked(global.fetch).mockResolvedValue({ ok: false, status: 403 } as unknown as Response);

    await expect(getDocument(ID)).rejects.toEqual({
      code: 'content_unavailable',
      message: 'No se pudo descargar el contenido del documento',
      status: 502,
    });
  });
});
