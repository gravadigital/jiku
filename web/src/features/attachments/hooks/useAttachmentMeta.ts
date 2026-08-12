'use client';
import { useQuery } from '@tanstack/react-query';
import { getPreviewUrl } from '../services/attachmentsClientApi';

export interface AttachmentMeta {
  readonly id: number;
  readonly fileName: string;
  readonly fileSize?: number;
  readonly mimeType: string;
}

export interface AttachmentMetaError extends Error {
  status?: number;
}

function extractFileNameFromDisposition(disposition: string | null): string {
  if (!disposition) {
    return '';
  }
  const match =
    disposition.match(/filename\*=UTF-8''([^;]+)/) ??
    disposition.match(/filename="([^"]+)"/) ??
    disposition.match(/filename=([^;]+)/);
  if (!match) {
    return '';
  }
  try {
    return decodeURIComponent(match[1].trim());
  } catch {
    return match[1].trim();
  }
}

async function fetchAttachmentMeta(attachmentId: number): Promise<AttachmentMeta> {
  const res = await fetch(getPreviewUrl(attachmentId), { method: 'HEAD' });
  if (!res.ok) {
    const error = new Error(`Attachment fetch failed (${res.status})`) as AttachmentMetaError;
    error.status = res.status;
    throw error;
  }
  const contentType = res.headers.get('Content-Type') ?? 'application/octet-stream';
  const contentLength = res.headers.get('Content-Length');
  const extractedName = extractFileNameFromDisposition(res.headers.get('Content-Disposition'));
  return {
    id: attachmentId,
    fileName: extractedName || `Adjunto ${attachmentId}`,
    fileSize: contentLength ? parseInt(contentLength, 10) : undefined,
    mimeType: contentType,
  };
}

/**
 * Obtiene metadata (nombre, tamaño, mime) de un adjunto haciendo HEAD al endpoint
 * de preview. Cacheado indefinidamente por ID, sin refetch on focus / remount —
 * la metadata de un adjunto no cambia durante la sesión.
 */
export function useAttachmentMeta(attachmentId: number) {
  return useQuery<AttachmentMeta, AttachmentMetaError>({
    queryKey: ['attachment-meta', attachmentId],
    queryFn: () => fetchAttachmentMeta(attachmentId),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
