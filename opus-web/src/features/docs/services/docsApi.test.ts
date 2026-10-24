import { vi, type Mock } from 'vitest';
import { apiClient } from '@/lib/axios';
import { modulesApi } from './modulesApi';
import { docsApi } from './docsApi';

// Excepción justificada a "no mockear axios/fetch": es el test del propio servicio.
vi.mock('@/lib/axios', () => ({ apiClient: { get: vi.fn() } }));

const mockGet = apiClient.get as Mock;
const mockFetch = vi.fn();
global.fetch = mockFetch;

const DOC_ID = '01JC7Z4X9QH2M5N8R3T6V0W1YA';
const DOC_ITEM = {
  id: DOC_ID,
  title: 'Guía de despliegue',
  updatedAt: '2026-10-20T14:30:00.000Z',
};

describe('modulesApi / docsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TS-1: modulesApi.getAll pide el estado por el proxy', async () => {
    const data = [{ module: 'docs', status: 'available', features: { sharing: true } }];
    mockGet.mockResolvedValueOnce({ data });
    expect(await modulesApi.getAll()).toEqual(data);
    expect(mockGet).toHaveBeenCalledWith('/api/opus/modules');
  });

  it('TS-2: list por proyecto no manda cursor ni requirementId', async () => {
    const page = { items: [], page: { limit: 5, returned: 0 } };
    mockGet.mockResolvedValueOnce({ data: page });
    expect(await docsApi.list({ projectId: 12 })).toEqual(page);
    expect(mockGet).toHaveBeenCalledWith('/api/opus/docs/documents', {
      params: { projectId: 12, limit: 5 },
    });
  });

  it('TS-3: list por requisito con cursor', async () => {
    mockGet.mockResolvedValueOnce({ data: { items: [], page: { limit: 5, returned: 0 } } });
    await docsApi.list({ requirementId: 345 }, 'c2');
    expect(mockGet).toHaveBeenCalledWith('/api/opus/docs/documents', {
      params: { requirementId: 345, limit: 5, cursor: 'c2' },
    });
  });

  it('TS-4: getById con content no descarga nada', async () => {
    const doc = { ...DOC_ITEM, content: '# Hola' };
    mockGet.mockResolvedValueOnce({ data: doc });
    expect(await docsApi.getById(DOC_ID)).toEqual(doc);
    expect(mockGet).toHaveBeenCalledWith(`/api/opus/docs/documents/${DOC_ID}`);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('TS-5: getById con contentUrl descarga el texto', async () => {
    const url = 'https://bucket.test/docs/big.md?X-Amz-Signature=abc';
    mockGet.mockResolvedValueOnce({ data: { ...DOC_ITEM, contentUrl: url, attachments: [] } });
    mockFetch.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('# Grande\n') });
    const result = await docsApi.getById(DOC_ID);
    expect(mockFetch).toHaveBeenCalledWith(url);
    expect(result.content).toBe('# Grande\n');
  });

  it('TS-6: contentUrl no descargable rechaza con content_unavailable', async () => {
    const data = { ...DOC_ITEM, contentUrl: 'https://bucket.test/x' };
    const expected = {
      code: 'content_unavailable',
      message: 'No se pudo descargar el contenido',
      status: 502,
    };
    mockGet.mockResolvedValueOnce({ data });
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });
    await expect(docsApi.getById(DOC_ID)).rejects.toEqual(expected);

    mockGet.mockResolvedValueOnce({ data });
    mockFetch.mockRejectedValueOnce(new TypeError('network'));
    await expect(docsApi.getById(DOC_ID)).rejects.toEqual(expected);
  });
});
