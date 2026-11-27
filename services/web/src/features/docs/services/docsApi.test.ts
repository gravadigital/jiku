import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient } from '@/lib/axios';
import {
  createDocument,
  getDocsSuggestions,
  getDocument,
  getSuggestedRelations,
  listDocuments,
  listTopics,
  listVersions,
  lockDocument,
  restoreVersion,
  searchDocuments,
  unlockDocument,
  updateDocument,
  updateRelations,
} from './docsApi';

vi.mock('@/lib/axios', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

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
      projectId: [12],
      limit: 10,
      cursor: undefined,
      requirementId: undefined,
    });

    expect(apiClient.get).toHaveBeenCalledWith('/docs/documents', {
      params: { projectId: [12], limit: 10 },
      paramsSerializer: { indexes: null },
    });
    const params = vi.mocked(apiClient.get).mock.calls[0][1]?.params;
    expect(Object.keys(params as object)).toEqual(['projectId', 'limit']);
    expect(result).toEqual({ ok: true, data: page });
  });

  it('TS-3: con cursor', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { items: [], page: {} } });
    await listDocuments({ requirementId: 45, limit: 10, cursor: 'c2' });
    expect(apiClient.get).toHaveBeenCalledWith('/docs/documents', {
      params: { requirementId: 45, limit: 10, cursor: 'c2' },
      paramsSerializer: { indexes: null },
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

    await expect(getDocument(ID)).resolves.toEqual({ ok: true, data });
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

    expect(result.ok && result.data.content).toBe('# Grande');
    expect(result.ok && result.data.contentUrl).toBe(url);
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

    await expect(getDocument(ID)).resolves.toEqual({
      ok: false,
      error: {
        code: 'content_unavailable',
        message: 'No se pudo descargar el contenido del documento',
        status: 502,
      },
    });
  });
});

describe('lecturas no lanzan (P-2, S-081)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getDocument devuelve document_not_found como dato', async () => {
    const error = { code: 'document_not_found', message: 'Documento no encontrado', status: 404 };
    vi.mocked(apiClient.get).mockRejectedValue(error);
    await expect(getDocument(ID)).resolves.toEqual({ ok: false, error });
  });

  it('listDocuments devuelve module_unavailable como dato', async () => {
    const error = { code: 'module_unavailable', message: 'x', status: 503 };
    vi.mocked(apiClient.get).mockRejectedValue(error);
    await expect(listDocuments({ projectId: [1] })).resolves.toEqual({ ok: false, error });
  });
});

const SESSION = '01J9Z3K8M2Q4R6T8V0W2Y4A6E2';

describe('escrituras (S-082)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('TS-2: createDocument no manda message y devuelve ok', async () => {
    const data = { id: ID, version: 1, path: '/clientes/acme/guia-de-despliegue.md' };
    vi.mocked(apiClient.post).mockResolvedValue({ data });
    const payload = {
      id: ID,
      content: '---\ntitle: X\nvisibility: internal\n---\n\n# X\n',
    };
    await expect(createDocument(payload)).resolves.toEqual({ ok: true, data });
    expect(apiClient.post).toHaveBeenCalledWith('/docs/documents', payload);
  });

  it('createDocument conserva content vacío', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { id: ID, version: 1 } });
    await createDocument({ content: '' });
    expect(apiClient.post).toHaveBeenCalledWith('/docs/documents', { content: '' });
  });

  it('TS-3: una escritura que falla no lanza', async () => {
    const error = { code: 'already_exists', message: 'Ya existe', status: 409 };
    vi.mocked(apiClient.post).mockRejectedValue(error);
    await expect(
      createDocument({ content: 'x' })
    ).resolves.toEqual({ ok: false, error });
  });

  it('TS-4: updateDocument arma el body exacto sin message vacío', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: { id: ID, version: 7 } });
    const result = await updateDocument(ID, {
      baseVersion: 6,
      content: '# Nuevo',
      sessionId: SESSION,
      message: '   ',
    });
    expect(apiClient.put).toHaveBeenCalledWith(`/docs/documents/${ID}`, {
      baseVersion: 6,
      content: '# Nuevo',
      sessionId: SESSION,
    });
    expect(result).toEqual({ ok: true, data: { id: ID, version: 7 } });
  });

  it('TS-5: updateDocument con conflicto devuelve details', async () => {
    const error = {
      code: 'version_conflict',
      message: 'El documento cambió',
      status: 409,
      details: { currentVersion: 7 },
    };
    vi.mocked(apiClient.put).mockRejectedValue(error);
    await expect(updateDocument(ID, { baseVersion: 6, content: 'x' })).resolves.toEqual({
      ok: false,
      error,
    });
  });

  it('TS-6: lock y unlock mandan solo sessionId', async () => {
    const grant = { id: ID, sessionId: SESSION, expiresAt: '2026-10-24T14:02:00.000Z' };
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: grant });
    await expect(lockDocument(ID, SESSION)).resolves.toEqual({ ok: true, data: grant });
    expect(apiClient.post).toHaveBeenLastCalledWith(`/docs/documents/${ID}/lock`, {
      sessionId: SESSION,
    });

    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { id: ID } });
    await expect(unlockDocument(ID, SESSION)).resolves.toEqual({ ok: true, data: { id: ID } });
    expect(apiClient.post).toHaveBeenLastCalledWith(`/docs/documents/${ID}/unlock`, {
      sessionId: SESSION,
    });
  });

  it('TS-7: lock bloqueado devuelve holder, via y expiresAt', async () => {
    const error = {
      code: 'document_locked',
      message: 'Otra sesión tiene el lock',
      status: 409,
      details: { holder: 'sub-ana', via: 'human', expiresAt: '2026-10-24T14:32:00.000Z' },
    };
    vi.mocked(apiClient.post).mockRejectedValue(error);
    await expect(lockDocument(ID, SESSION)).resolves.toEqual({ ok: false, error });
  });
});

describe('searchDocuments (TS-8)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('pide limit 50 y devuelve el data sin transformar', async () => {
    const data = { items: [{ documentId: ID, title: 'Guía', snippet: 'x <b>y</b>' }] };
    vi.mocked(apiClient.get).mockResolvedValue({ data });
    await expect(searchDocuments({ q: 'despliegue' })).resolves.toEqual({ ok: true, data });
    expect(apiClient.get).toHaveBeenCalledWith('/docs/search', {
      params: { q: 'despliegue', limit: 50 },
      paramsSerializer: { indexes: null },
    });
  });
});

const ID_B = '01J9Z3K8M2Q4R6T8V0W2Y4A6D0';

describe('S-095: listas, sugerencias y relaciones', () => {
  beforeEach(() => vi.clearAllMocks());

  it('TS-1: listDocuments manda listas como parámetro repetido', async () => {
    const page = { items: [], page: { limit: 20, returned: 0 } };
    vi.mocked(apiClient.get).mockResolvedValue({ data: page });
    const result = await listDocuments({
      clientId: [4],
      projectId: [12, 31],
      sort: '-updatedAt',
      limit: 20,
      count: true,
    });
    expect(apiClient.get).toHaveBeenCalledWith('/docs/documents', {
      params: { clientId: [4], projectId: [12, 31], sort: '-updatedAt', limit: 20, count: true },
      paramsSerializer: { indexes: null },
    });
    expect(result).toEqual({ ok: true, data: page });
  });

  it('TS-2: listDocuments descarta vacíos y conserva false', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { items: [], page: {} } });
    await listDocuments({
      hasProject: false,
      projectId: [],
      topic: undefined,
      person: [],
      limit: 20,
      count: true,
    });
    expect(apiClient.get).toHaveBeenCalledWith('/docs/documents', {
      params: { hasProject: false, limit: 20, count: true },
      paramsSerializer: { indexes: null },
    });
  });

  it('TS-3: searchDocuments con filtros', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { items: [] } });
    await searchDocuments({ q: 'arquitectura', clientId: [4], visibility: 'public', limit: 50 });
    expect(apiClient.get).toHaveBeenCalledWith('/docs/search', {
      params: { q: 'arquitectura', clientId: [4], visibility: 'public', limit: 50 },
      paramsSerializer: { indexes: null },
    });
  });

  it('TS-4: getDocsSuggestions', async () => {
    const data = { projects: [], clients: [], persons: [], topics: [] };
    vi.mocked(apiClient.get).mockResolvedValue({ data });
    await expect(getDocsSuggestions({ q: 'vid', clientId: 4 })).resolves.toEqual({
      ok: true,
      data,
    });
    expect(apiClient.get).toHaveBeenCalledWith('/docs/suggestions', {
      params: { q: 'vid', clientId: 4, limit: 5 },
    });
  });

  it('TS-5: getSuggestedRelations', async () => {
    const data = { items: [{ projectId: 12, clientId: 4, score: 0.82, reason: 'x' }] };
    vi.mocked(apiClient.get).mockResolvedValue({ data });
    await expect(getSuggestedRelations(ID_B)).resolves.toEqual({ ok: true, data });
    expect(apiClient.get).toHaveBeenCalledWith(`/docs/documents/${ID_B}/suggested-relations`);
  });

  it('TS-6: updateRelations éxito', async () => {
    const data = {
      id: ID_B,
      version: 4,
      relations: { clients: [4], projects: [12], requirements: [], tasks: [] },
    };
    vi.mocked(apiClient.post).mockResolvedValue({ data });
    const payload = { baseVersion: 3, add: { projects: [12] } };
    await expect(updateRelations(ID_B, payload)).resolves.toEqual({ ok: true, data });
    expect(apiClient.post).toHaveBeenCalledWith(`/docs/documents/${ID_B}/relations`, payload);
  });

  it('TS-7: updateRelations conserva details del conflicto', async () => {
    const error = {
      code: 'version_conflict',
      message: 'Version conflict',
      status: 409,
      details: { currentVersion: 5 },
    };
    vi.mocked(apiClient.post).mockRejectedValue(error);
    await expect(
      updateRelations(ID_B, { baseVersion: 3, add: { projects: [12] } })
    ).resolves.toEqual({ ok: false, error });
  });
});

describe('getDocument con versión y versiones (S-096)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('TS-1: vigente con un solo argumento y versionado con params', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: DOC_A });
    const current = await getDocument(ID);
    expect(apiClient.get).toHaveBeenNthCalledWith(1, `/docs/documents/${ID}`);
    expect(current).toEqual({ ok: true, data: DOC_A });
    const old = await getDocument(ID, 4);
    expect(apiClient.get).toHaveBeenNthCalledWith(2, `/docs/documents/${ID}`, {
      params: { version: 4 },
    });
    expect(old.ok).toBe(true);
  });

  it('TS-2: conserva version_pruned con sus details sin lanzar', async () => {
    const error = {
      code: 'version_pruned',
      message: 'Version pruned',
      status: 404,
      details: { requestedVersion: 7, previousAvailable: 5, nextAvailable: 9 },
    };
    vi.mocked(apiClient.get).mockRejectedValue(error);
    expect(await getDocument(ID, 7)).toEqual({ ok: false, error });
  });

  it('TS-3: listVersions pide 50 y pasa el cursor', async () => {
    const page = { items: [], page: { limit: 50, returned: 0 } };
    vi.mocked(apiClient.get).mockResolvedValue({ data: page });
    expect(await listVersions(ID, {})).toEqual({ ok: true, data: page });
    expect(apiClient.get).toHaveBeenNthCalledWith(1, `/docs/documents/${ID}/versions`, {
      params: { limit: 50 },
    });
    await listVersions(ID, { cursor: 'c1' });
    expect(apiClient.get).toHaveBeenNthCalledWith(2, `/docs/documents/${ID}/versions`, {
      params: { limit: 50, cursor: 'c1' },
    });
  });

  it('TS-4: restoreVersion manda fromVersion y baseVersion', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { id: ID, version: 7 } });
    const result = await restoreVersion(ID, { fromVersion: 5, baseVersion: 6 });
    expect(apiClient.post).toHaveBeenCalledWith(`/docs/documents/${ID}/restore`, {
      fromVersion: 5,
      baseVersion: 6,
    });
    expect(result).toEqual({ ok: true, data: { id: ID, version: 7 } });
  });

  it('TS-5: restoreVersion devuelve el error sin lanzar', async () => {
    const error = {
      code: 'version_conflict',
      message: 'Version conflict',
      status: 409,
      details: { currentVersion: 8 },
    };
    vi.mocked(apiClient.post).mockRejectedValue(error);
    expect(await restoreVersion(ID, { fromVersion: 5, baseVersion: 6 })).toEqual({
      ok: false,
      error,
    });
  });
});

describe('listTopics (TS-11)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('pide por prefijo con tope 10 y no lanza', async () => {
    const data = {
      items: [{ topic: 'videoconferencia', documents: 12 }],
      page: { limit: 10, returned: 1 },
    };
    vi.mocked(apiClient.get).mockResolvedValue({ data });
    await expect(listTopics({ prefix: 'vid' })).resolves.toEqual({ ok: true, data });
    expect(apiClient.get).toHaveBeenCalledWith('/docs/topics', {
      params: { prefix: 'vid', limit: 10 },
    });

    const error = { code: 'module_unavailable', status: 503, message: 'Unavailable' };
    vi.mocked(apiClient.get).mockRejectedValue(error);
    await expect(listTopics({ prefix: 'vid' })).resolves.toEqual({ ok: false, error });
  });
});
