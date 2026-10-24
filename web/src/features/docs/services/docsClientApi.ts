import {
  isExpiredUploadUrlError,
  putFileToStorage,
} from '@/features/attachments/services/attachmentsClientApi';
import { sha256Checksum } from '../utils/checksum';
import { unwrap } from '../utils/docsResult';
import type { DocsError, UploadedDocAttachment } from '../types/docs.types';

/**
 * Libera la reserva en `pagehide`/desmontaje. Va por el BFF porque un Server Action no corre
 * mientras la página se descarga; `keepalive` deja que el pedido sobreviva a la página.
 * Mismo origen: la cookie de sesión viaja sola.
 */
export function releaseLockKeepalive(id: string, sessionId: string): void {
  void fetch(`/api/docs/documents/${id}/unlock`, {
    method: 'POST',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  }).catch(() => {
    // Si el pedido no llega, el lock vence solo a los 120 s (R-7): nunca peor que esa espera.
  });
}

const EXPIRED_URL_ERROR: DocsError = {
  code: 'expired_upload_url',
  message: 'La URL de subida venció. Volvé a intentarlo.',
  status: 403,
};

/**
 * Sube un adjunto en cuatro pasos: checksum en el navegador → pedido (Server Action) → PUT
 * directo a S3 → confirmación. Lanza el `DocsError` del paso que falle. El byte nunca pasa por
 * Next ni por la api, y la `uploadUrl` no se loguea.
 */
export async function uploadDocAttachment(
  documentId: string,
  file: File,
  options?: { onProgress?: (progress: number) => void }
): Promise<UploadedDocAttachment> {
  // Import dinámico a propósito (igual que `uploadFile`): la Server Action arrastra `apiClient`
  // y este módulo corre en el navegador.
  const { requestAttachmentUpload, confirmAttachment } = await import('./docsAttachmentsApi');

  const mimeType = file.type || 'application/octet-stream';
  const checksum = await sha256Checksum(file);

  const upload = unwrap(
    await requestAttachmentUpload({
      documentId,
      fileName: file.name,
      mimeType,
      fileSize: file.size,
      checksum,
    })
  );

  try {
    await putFileToStorage({
      uploadUrl: upload.uploadUrl,
      file,
      onProgress: options?.onProgress,
    });
  } catch (error) {
    if (isExpiredUploadUrlError(error)) throw EXPIRED_URL_ERROR;
    throw {
      code: 'upload_failed',
      message: error instanceof Error ? error.message : 'Hubo un error al subir el archivo',
      status: 502,
    } satisfies DocsError;
  }

  unwrap(await confirmAttachment(upload.id));

  return { id: upload.id, fileName: file.name, mimeType, link: upload.link };
}
