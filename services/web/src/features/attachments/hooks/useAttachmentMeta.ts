'use client';
import { useQuery } from '@tanstack/react-query';
import { getFilePreviewUrl, getPreviewUrl } from '../services/attachmentsClientApi';
import type { AttachmentResource } from '../types/attachment.types';

export type { AttachmentResource };

export interface AttachmentMeta {
  readonly id: number;
  readonly fileName: string;
  readonly fileSize?: number;
  readonly mimeType: string;
}

export interface AttachmentMetaError extends Error {
  status?: number;
  /** Código de dominio del body de error, cuando la api lo manda. */
  code?: string;
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

async function fetchAttachmentMeta(
  id: number,
  resource: AttachmentResource
): Promise<AttachmentMeta> {
  const url = resource === 'file' ? getFilePreviewUrl(id) : getPreviewUrl(id);
  const res = await fetch(url, { method: 'HEAD' });
  if (!res.ok) {
    const error = new Error(`Attachment fetch failed (${res.status})`) as AttachmentMetaError;
    error.status = res.status;
    // Un HEAD no trae body, así que el código de dominio solo puede venir por
    // header. Cuando no viene, un 404 se interpreta como archivo no
    // disponible: es el caso probable y el único con una acción útil asociada
    // (borrar el adjunto).
    const headerCode = res.headers.get('X-Error-Code');
    if (headerCode) {
      error.code = headerCode;
    } else if (res.status === 404) {
      error.code = 'file_not_available';
    }
    throw error;
  }
  const contentType = res.headers.get('Content-Type') ?? 'application/octet-stream';
  const contentLength = res.headers.get('Content-Length');
  const extractedName = extractFileNameFromDisposition(res.headers.get('Content-Disposition'));
  return {
    id,
    fileName: extractedName || `Adjunto ${id}`,
    fileSize: contentLength ? parseInt(contentLength, 10) : undefined,
    mimeType: contentType,
  };
}

/**
 * Obtiene metadata (nombre, tamaño, mime) haciendo HEAD al endpoint de preview
 * que corresponda al espacio de ids. Cacheado indefinidamente por ID, sin
 * refetch on focus / remount — la metadata no cambia durante la sesión, y cada
 * lectura cuesta un comando por el bus.
 */
export function useAttachmentMeta(id: number, resource: AttachmentResource = 'attachment') {
  return useQuery<AttachmentMeta, AttachmentMetaError>({
    queryKey: ['attachment-meta', resource, id],
    queryFn: () => fetchAttachmentMeta(id, resource),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
