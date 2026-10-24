'use server';
import { apiClient } from '@/lib/axios';
import { toResult } from '../utils/docsResult';
import { SHARE_EXPIRY_DAYS, expiresAtFrom } from '../utils/shares';
import type {
  CreateShareInput,
  DocsResult,
  DocsShareCreated,
  DocsSharePage,
  DocsShareRevoked,
} from '../types/docs.types';

// Igual que `docsApi`: ninguna Server Action lanza (P-2 de S-081). Nada de lo que pasa por acá
// se loguea: la `url` y el `token` del alta no deben quedar en ningún log (CA-31).

/** P-7: una sola página de 200, sin filtro de estado ni cursor. */
export const listShares = async (documentId: string): Promise<DocsResult<DocsSharePage>> =>
  toResult(async () => {
    const response = await apiClient.get(`/docs/documents/${documentId}/shares`, {
      params: { limit: 200 },
    });
    return response.data;
  });

/** P-1 y P-2: `expiresAt` se calcula acá; no se manda `id` ni `version`; claves vacías, tampoco. */
export const createShare = async (
  documentId: string,
  input: CreateShareInput
): Promise<DocsResult<DocsShareCreated>> =>
  toResult(async () => {
    if (!SHARE_EXPIRY_DAYS.includes(input.expiresInDays)) {
      throw { code: 'share_expiry_invalid', message: 'El vencimiento no es válido', status: 400 };
    }
    const note = input.note?.trim();
    const body = {
      mode: 'latest',
      expiresAt: expiresAtFrom(input.expiresInDays, new Date()),
      includeAttachments: input.includeAttachments,
      ...(note ? { note } : {}),
      ...(input.acknowledgeSecretWarning === true ? { acknowledgeSecretWarning: true } : {}),
    };
    const response = await apiClient.post(`/docs/documents/${documentId}/shares`, body);
    return response.data;
  });

/** `shareId` es el id del link, no el del documento. */
export const revokeShare = async (shareId: string): Promise<DocsResult<DocsShareRevoked>> =>
  toResult(async () => {
    const response = await apiClient.delete(`/docs/shares/${shareId}`);
    return response.data;
  });
