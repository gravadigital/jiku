'use server';
import { apiClient } from '@/lib/axios';
import { toResult } from '../utils/docsResult';
import type {
  DocsAttachmentConfirm,
  DocsAttachmentUpload,
  DocsResult,
  RequestAttachmentUploadPayload,
} from '../types/docs.types';

// La `uploadUrl` prefirmada nunca se loguea (REQ-016 §Seguridad).
export const requestAttachmentUpload = async (
  payload: RequestAttachmentUploadPayload
): Promise<DocsResult<DocsAttachmentUpload>> =>
  toResult(async () => {
    const response = await apiClient.post('/docs/attachments', payload);
    return response.data;
  });

export const confirmAttachment = async (id: string): Promise<DocsResult<DocsAttachmentConfirm>> =>
  toResult(async () => {
    const response = await apiClient.post(`/docs/attachments/${id}/confirm`);
    return response.data;
  });
