import { apiClient, type ApiError } from '@/lib/axios';
import type { UploadTicket, UploadTicketInput, UploadedFile } from '../types/attachment.types';

function uploadError(code: string, message: string, status: number): ApiError {
  return { code, message, status };
}

export const attachmentsApi = {
  /**
   * Pide el permiso de subida. Va por el proxy del mismo origen para que el route
   * handler agregue el Bearer: el access token no sale del servidor.
   */
  requestUploadTicket: async (input: UploadTicketInput): Promise<UploadTicket> => {
    const { data } = await apiClient.post<UploadTicket>('/api/opus/attachments', {
      fileName: input.fileName,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      checksum: input.checksum ?? null,
    });
    return data;
  },

  /**
   * Manda el byte directo al storage con la URL ya firmada.
   *
   * Se usa `XMLHttpRequest` y no `fetch` porque es la única API del navegador que expone
   * `upload.onprogress` con `loaded`/`total`, que es de donde sale el porcentaje real.
   *
   * La URL ya trae la firma en el query string: no se manda `Authorization` ni cookies.
   * `withCredentials` queda en `false` a propósito — ponerlo en `true` rompería el
   * preflight contra un bucket con `AllowedOrigin` explícito, y el síntoma sería un error
   * de red opaco.
   *
   * Los errores se arman a mano con la forma de `ApiError`: este camino no pasa por el
   * interceptor de axios.
   */
  putFileToStorage: (
    uploadUrl: string,
    file: File,
    onProgress: (percent: number) => void,
    contentType?: string
  ): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      if (contentType) {
        xhr.setRequestHeader('Content-Type', contentType);
      }

      // Registrar el progreso antes de `send()`, o se pierden los primeros eventos.
      xhr.upload.onprogress = (event: ProgressEvent) => {
        if (!event.lengthComputable || !event.total) return;
        onProgress(Math.round((event.loaded / event.total) * 100));
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
          return;
        }
        // S3 responde XML, no JSON: no se intenta parsear el cuerpo. Alcanza con
        // distinguir la URL vencida del resto.
        if (xhr.status === 403) {
          reject(
            uploadError('upload_url_expired', 'La URL de subida venció. Intentá de nuevo.', 403)
          );
          return;
        }
        reject(uploadError('upload_error', 'Error al subir el archivo', xhr.status));
      };

      xhr.onerror = () => {
        // `status: 0` sin cuerpo: es indistinguible un CORS faltante de una caída de red.
        reject(uploadError('upload_network_error', 'Error al subir el archivo', 0));
      };

      xhr.onabort = () => {
        reject(uploadError('upload_aborted', 'Subida cancelada', 0));
      };

      xhr.send(file);
    }),

  /**
   * Sube un archivo: ticket + `PUT` directo. Resuelve con el `fileId` — el id de `files`,
   * que es lo que después viaja en `fileIds` al guardar la entidad.
   *
   * Los metadatos salen del `File` del navegador y no de la api: la api ya no ve el byte.
   * No hay reintento automático en ningún paso.
   */
  uploadFile: async (file: File, onProgress: (percent: number) => void): Promise<UploadedFile> => {
    const ticket = await attachmentsApi.requestUploadTicket({
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
    });

    await attachmentsApi.putFileToStorage(ticket.uploadUrl, file, onProgress, file.type);

    return {
      fileId: ticket.fileId,
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
    };
  },

  /** Preview de un adjunto YA vinculado: entra por `attachments.id`. */
  getPreviewUrl: (id: number): string => `/api/attachments/${id}/preview`,

  /**
   * Preview de un archivo SIN vínculo: entra por `files.id`. Es el camino del editor,
   * donde el vínculo todavía no existe.
   */
  getFilePreviewUrl: (fileId: number): string => `/api/files/${fileId}/preview`,
};
