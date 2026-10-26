'use server';
import { apiClient } from '@/lib/axios';
import { toResult } from '../utils/docsResult';
import type {
  CreateDocumentPayload,
  DocsDocumentDetail,
  DocsDocumentPage,
  DocsIdResult,
  DocsLockGrant,
  DocsRelationSuggestions,
  DocsRelationsResult,
  DocsResult,
  DocsSearchResponse,
  DocsSearchSuggestions,
  DocsVersionPage,
  DocsWriteResult,
  DocumentsFilters,
  RestoreVersionPayload,
  SearchDocumentsParams,
  UpdateDocumentPayload,
  UpdateRelationsPayload,
} from '../types/docs.types';

// Convención de errores (P-2): ninguna Server Action de docs lanza. Un error lanzado desde un
// Server Action cruza al navegador y, en el build de producción, Next lo reemplaza por uno
// genérico con `digest`: `code` y `details` se perderían justo en los flujos que dependen de
// ellos (`document_not_found`, `module_unavailable`, `document_locked`, `version_conflict`).
// Por eso devuelven `DocsResult<T>` y el hook re-lanza del lado del cliente (`unwrap`).

// La api responde 400 `invalid_fields` a las claves no declaradas: se descartan las vacías
// (también las listas vacías) y se conserva `false` (`hasProject: false` es un filtro).
const definedOnly = (filters: object): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(filters).filter(
      ([, value]) =>
        value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0)
    )
  );

// La api espera la lista como parámetro repetido (`style: form, explode: true`); axios por
// defecto manda `projectId[]=12`.
const LIST_PARAMS = { indexes: null } as const;

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
    const response = await apiClient.get('/docs/documents', {
      params: definedOnly(filters),
      paramsSerializer: LIST_PARAMS,
    });
    return response.data;
  });

export const getDocument = async (
  id: string,
  version?: number
): Promise<DocsResult<DocsDocumentDetail>> =>
  toResult(async () => {
    const url = `/docs/documents/${id}`;
    const response =
      version === undefined
        ? await apiClient.get(url)
        : await apiClient.get(url, { params: { version } });
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
  limit = 50,
  ...rest
}: SearchDocumentsParams): Promise<DocsResult<DocsSearchResponse>> =>
  toResult(async () => {
    const response = await apiClient.get('/docs/search', {
      params: definedOnly({ ...rest, limit }),
      paramsSerializer: LIST_PARAMS,
    });
    return response.data;
  });

export const getDocsSuggestions = async ({
  q,
  clientId,
  limit = 5,
}: {
  q: string;
  clientId?: number;
  limit?: number;
}): Promise<DocsResult<DocsSearchSuggestions>> =>
  toResult(async () => {
    const response = await apiClient.get('/docs/suggestions', {
      params: definedOnly({ q, clientId, limit }),
    });
    return response.data;
  });

export const getSuggestedRelations = async (
  id: string
): Promise<DocsResult<DocsRelationSuggestions>> =>
  toResult(async () => {
    const response = await apiClient.get(`/docs/documents/${id}/suggested-relations`);
    return response.data;
  });

export const updateRelations = async (
  id: string,
  payload: UpdateRelationsPayload
): Promise<DocsResult<DocsRelationsResult>> =>
  toResult(async () => {
    const response = await apiClient.post(`/docs/documents/${id}/relations`, bodyOf(payload));
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

export const listVersions = async (
  id: string,
  { limit = 50, cursor }: { limit?: number; cursor?: string }
): Promise<DocsResult<DocsVersionPage>> =>
  toResult(async () => {
    const response = await apiClient.get(`/docs/documents/${id}/versions`, {
      params: definedOnly({ limit, cursor }),
    });
    return response.data;
  });

export const restoreVersion = async (
  id: string,
  payload: RestoreVersionPayload
): Promise<DocsResult<DocsWriteResult>> =>
  toResult(async () => {
    const response = await apiClient.post(`/docs/documents/${id}/restore`, bodyOf(payload));
    return response.data;
  });
