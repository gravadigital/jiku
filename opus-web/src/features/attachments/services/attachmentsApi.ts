import type { Attachment } from '../types/attachment.types';

export const attachmentsApi = {
  uploadFile: async (
    entityType: 'comment_draft' | 'requirement_comment_draft' | 'requirement' | 'requirement_draft',
    entityId: number,
    file: File
  ): Promise<Attachment[]> => {
    const formData = new FormData();
    formData.append('entityType', entityType);
    formData.append('entityId', String(entityId));
    formData.append('files', file);
    // Mismo origen: lo atiende el proxy de /api/opus, que agrega el token en el servidor.
    const response = await fetch('/api/opus/attachments', {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw {
        code: err.code ?? 'upload_error',
        message: err.message ?? 'Error al subir',
        status: response.status,
      };
    }
    return response.json();
  },

  getPreviewUrl: (id: number): string => `/api/attachments/${id}/preview`,
};
