import { apiClient, type ApiError } from '@/lib/axios';
import { DOCS_PAGE_SIZE } from '../constants/docs.constants';
import type { DocsDocument, DocsDocumentPage, DocsListScope } from '../types/docs.types';

function contentUnavailable(): ApiError {
  return { code: 'content_unavailable', message: 'No se pudo descargar el contenido', status: 502 };
}

/**
 * Descarga el texto de un documento > 256 KiB desde la URL prefirmada. Es otro origen:
 * se usa `fetch` nativo, sin credenciales ni interceptor. Nunca se loguea la URL.
 */
async function downloadContent(contentUrl: string): Promise<string> {
  try {
    const response = await fetch(contentUrl);
    if (!response.ok) throw contentUnavailable();
    return await response.text();
  } catch {
    throw contentUnavailable();
  }
}

export const docsApi = {
  list: async (scope: DocsListScope, cursor?: string): Promise<DocsDocumentPage> => {
    const params = { ...scope, limit: DOCS_PAGE_SIZE, ...(cursor ? { cursor } : {}) };
    const { data } = await apiClient.get<DocsDocumentPage>('/api/opus/docs/documents', { params });
    return data;
  },

  getById: async (id: string): Promise<DocsDocument> => {
    const { data } = await apiClient.get<DocsDocument>(
      `/api/opus/docs/documents/${encodeURIComponent(id)}`
    );
    if (data.contentUrl && data.content === undefined) {
      const content = await downloadContent(data.contentUrl);
      return { ...data, content };
    }
    return data;
  },
};
