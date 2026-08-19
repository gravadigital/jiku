'use server';
import { apiClient } from '@/lib/axios';
import type {
  Attachment,
  EntityType,
  UploadTicket,
  UploadTicketRequest,
} from '../types/attachment.types';

export async function listAttachments(
  entityType: EntityType,
  entityId: number
): Promise<Attachment[]> {
  const { data } = await apiClient.get('/attachments', {
    params: { entityType, entityId },
  });
  return data;
}

export async function deleteAttachment(attachmentId: number): Promise<void> {
  await apiClient.delete(`/attachments/${attachmentId}`);
}

export async function getAttachmentById(attachmentId: number): Promise<Attachment> {
  const { data } = await apiClient.get(`/attachments/${attachmentId}`);
  return data;
}

/**
 * Pide permiso de subida a la api. Devuelve el `fileId` y la URL prefirmada
 * contra la que el navegador hace el PUT del byte.
 */
export async function requestUploadTicket(
  payload: UploadTicketRequest
): Promise<UploadTicket> {
  const { data } = await apiClient.post('/attachments', {
    fileName: payload.fileName,
    mimeType: payload.mimeType,
    fileSize: payload.fileSize,
    checksum: payload.checksum ?? null,
  });
  return data;
}
