import type { Attachment, EntityType } from '../types/attachment.types';

export function uploadAttachments(
  entityType: EntityType,
  entityId: number | null,
  files: File[],
  onUploadProgress?: (progress: number) => void
): Promise<Attachment[]> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('entityType', entityType);
    // requirement_draft puede subirse sin entidad: se ancla al usuario en el
    // backend. Para el resto de tipos entityId es obligatorio.
    if (entityId != null) {
      formData.append('entityId', entityId.toString());
    }
    files.forEach((file) => formData.append('files', file));

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onUploadProgress) {
        onUploadProgress(Math.round((event.loaded * 100) / event.total));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as Attachment[];
          resolve(data);
        } catch {
          reject(new Error('Invalid response format'));
        }
      } else {
        try {
          const errorData = JSON.parse(xhr.responseText) as { message?: string };
          reject(new Error(errorData.message ?? `Upload failed with status ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload aborted'));
    });

    xhr.open('POST', '/api/attachments');
    xhr.send(formData);
  });
}

export function getPreviewUrl(attachmentId: number): string {
  return `/api/attachments/${attachmentId}/preview`;
}

export function getDownloadUrl(attachmentId: number): string {
  return `/api/attachments/${attachmentId}/download`;
}
