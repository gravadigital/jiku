/**
 * Marca del fallo por URL prefirmada vencida. El 403 de S3 no trae un body JSON
 * util, asi que se distingue por status y se etiqueta acá para que la UI pueda
 * ofrecer un reintento que pida un ticket nuevo (CA-11).
 */
const EXPIRED_UPLOAD_URL = 'expired_upload_url';

interface ExpiredUploadUrlError extends Error {
  code: typeof EXPIRED_UPLOAD_URL;
}

export function isExpiredUploadUrlError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error as Partial<ExpiredUploadUrlError>).code === EXPIRED_UPLOAD_URL
  );
}

export interface PutFileToStorageParams {
  readonly uploadUrl: string;
  readonly file: File;
  readonly onProgress?: (progress: number) => void;
}

/**
 * Manda el byte directo a la URL prefirmada de S3. No pasa por la api, ni por
 * el BFF, ni por el bus.
 *
 * Usa XMLHttpRequest y no `fetch` porque `fetch` no expone progreso de subida:
 * es la unica razon por la que este transporte sigue siendo XHR.
 *
 * No setea `Authorization`: la autorizacion va firmada en la query string de la
 * propia URL.
 */
export function putFileToStorage({
  uploadUrl,
  file,
  onProgress,
}: PutFileToStorageParams): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded * 100) / event.total));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      if (xhr.status === 403) {
        const expired = new Error(
          'La URL de subida venció. Volvé a intentarlo.'
        ) as ExpiredUploadUrlError;
        expired.code = EXPIRED_UPLOAD_URL;
        reject(expired);
        return;
      }
      reject(new Error('Hubo un error al subir el archivo'));
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Error de red al subir el archivo'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('La subida del archivo se canceló'));
    });

    xhr.open('PUT', uploadUrl);
    xhr.send(file);
  });
}

export interface UploadFileOptions {
  readonly onProgress?: (progress: number) => void;
}

/**
 * Sube un archivo completo y resuelve con su `fileId`.
 *
 * El ticket va por Server Action (necesita el token, que vive en el servidor);
 * el byte va por XHR crudo contra S3 (no necesita token: la firma va en la URL).
 * Esa mezcla es deliberada.
 */
export async function uploadFile(
  file: File,
  options?: UploadFileOptions
): Promise<number> {
  // Import dinámico a propósito: `attachmentsApi` lleva `'use server'` y
  // arrastra `apiClient` (y con él `auth()`). Este módulo corre en el navegador
  // y no debe tener esa cadena en su grafo estático.
  const { requestUploadTicket } = await import('./attachmentsApi');

  const ticket = await requestUploadTicket({
    fileName: file.name,
    mimeType: file.type,
    fileSize: file.size,
    checksum: null,
  });

  await putFileToStorage({
    uploadUrl: ticket.uploadUrl,
    file,
    onProgress: options?.onProgress,
  });

  return ticket.fileId;
}

/** Preview de un adjunto ya vinculado. `attachmentId` es id de vínculo. */
export function getPreviewUrl(attachmentId: number): string {
  return `/api/attachments/${attachmentId}/preview`;
}

/** Descarga de un adjunto ya vinculado. `attachmentId` es id de vínculo. */
export function getDownloadUrl(attachmentId: number): string {
  return `/api/attachments/${attachmentId}/download`;
}

/**
 * Preview de un archivo SIN vínculo. Recibe un `fileId` (id de `files`), que es
 * un espacio de identificadores distinto del de los vínculos: resolverlo contra
 * `/api/attachments/{id}/preview` daría un 404 o el preview de otro adjunto.
 */
export function getFilePreviewUrl(fileId: number): string {
  return `/api/files/${fileId}/preview`;
}
