'use server';
import { apiClient } from '@/lib/axios';
import type { DocsDocumentDetail, DocsDocumentPage, DocumentsFilters } from '../types/docs.types';

// La api responde 400 `invalid_fields` a las claves no declaradas: se descartan las vacías.
const definedOnly = (filters: object): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== '')
  );

export const listDocuments = async (filters: DocumentsFilters): Promise<DocsDocumentPage> => {
  const response = await apiClient.get('/docs/documents', { params: definedOnly(filters) });
  return response.data;
};

export const getDocument = async (id: string): Promise<DocsDocumentDetail> => {
  const response = await apiClient.get(`/docs/documents/${id}`);
  const data: DocsDocumentDetail = response.data;

  if (data.contentUrl && data.content === undefined) {
    // P-5: el contenido grande se baja del lado del servidor. La URL prefirmada nunca se loguea.
    const download = await fetch(data.contentUrl, { cache: 'no-store' }).catch(() => null);
    if (!download?.ok) {
      throw {
        code: 'content_unavailable',
        message: 'No se pudo descargar el contenido del documento',
        status: 502,
      };
    }
    return { ...data, content: await download.text() };
  }

  return data;
};
