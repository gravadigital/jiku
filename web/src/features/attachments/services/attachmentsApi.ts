'use server';
import { apiClient } from '@/lib/axios';
import type { Attachment, EntityType } from '../types/attachment.types';

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
