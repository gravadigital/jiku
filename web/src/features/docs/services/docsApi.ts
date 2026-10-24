'use server';
import { apiClient } from '@/lib/axios';
import { toResult } from '../utils/docsResult';
import type {
  CreateDocumentPayload,
  DocsDocumentDetail,
  DocsDocumentPage,
  DocsIdResult,
  DocsLockGrant,
  DocsResult,
  DocsSearchResponse,
  DocsWriteResult,
  DocumentsFilters,
  UpdateDocumentPayload,
} from '../types/docs.types';

// Convención de errores (P-2): ninguna Server Action de docs lanza. Un error lanzado desde un
// Server Action cruza al navegador y, en el build de producción, Next lo reemplaza por uno
// genérico con `digest`: `code` y `details` se perderían justo en los flujos que dependen de
// ellos (`document_not_found`, `module_unavailable`, `document_locked`, `version_conflict`).
// Por eso devuelven `DocsResult<T>` y el hook re-lanza del lado del cliente (`unwrap`).

// La api responde 400 `invalid_fields` a las claves no declaradas: se descartan las vacías.
const definedOnly = (filters: object): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== '')
  );

// En el cuerpo de una escritura `content` puede ser '' (documento vacío): solo se descartan
// las claves `undefined` y el `message` en blanco.
const bodyOf = (payload: object): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(payload).filter(([key, value]) => {
      if (value === undefined) return false;
      if (key === 'message' && typeof value === 'string') return value.trim() !== '';
      return true;
    })
  );

export const listDocuments = async (
  filters: DocumentsFilters
): Promise<DocsResult<DocsDocumentPage>> =>
  toResult(async () => {
    const response = await apiClient.get('/docs/documents', { params: definedOnly(filters) });
    return response.data;
  });

export const getDocument = async (id: string): Promise<DocsResult<DocsDocumentDetail>> =>
  toResult(async () => {
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
  });

export const searchDocuments = async ({
  q,
  limit = 50,
}: {
  q: string;
  limit?: number;
}): Promise<DocsResult<DocsSearchResponse>> =>
  toResult(async () => {
    const response = await apiClient.get('/docs/search', { params: { q, limit } });
    return response.data;
  });

export const createDocument = async (
  payload: CreateDocumentPayload
): Promise<DocsResult<DocsWriteResult>> =>
  toResult(async () => {
    const response = await apiClient.post('/docs/documents', bodyOf(payload));
    return response.data;
  });

export const updateDocument = async (
  id: string,
  payload: UpdateDocumentPayload
): Promise<DocsResult<DocsWriteResult>> =>
  toResult(async () => {
    const response = await apiClient.put(`/docs/documents/${id}`, bodyOf(payload));
    return response.data;
  });

// La web no manda `ttlSeconds`: usa el default de 120 s y renueva cada 60 s.
export const lockDocument = async (
  id: string,
  sessionId: string
): Promise<DocsResult<DocsLockGrant>> =>
  toResult(async () => {
    const response = await apiClient.post(`/docs/documents/${id}/lock`, { sessionId });
    return response.data;
  });

// `force` no se expone nunca.
export const unlockDocument = async (
  id: string,
  sessionId: string
): Promise<DocsResult<DocsIdResult>> =>
  toResult(async () => {
    const response = await apiClient.post(`/docs/documents/${id}/unlock`, { sessionId });
    return response.data;
  });
