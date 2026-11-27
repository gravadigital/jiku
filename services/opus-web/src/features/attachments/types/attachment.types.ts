export interface Attachment {
  id: number;
  entityType: string;
  entityId: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageKey: string;
  retentionStatus: string;
  createdAt: string;
  updatedAt: string;
}

/** Lo que se declara al pedir el ticket de subida. El byte no viaja en este paso. */
export interface UploadTicketInput {
  fileName: string;
  mimeType: string;
  fileSize: number;
  /**
   * sha256 declarado por el cliente. El servidor lo acepta pero no lo verifica, así que
   * se manda `null`: calcularlo obligaría a un pase completo sobre el archivo para un
   * campo que nadie mira.
   */
  checksum?: string | null;
}

/** Respuesta de `POST /api/opus/attachments`. `fileId` es el id de `files`, no el del vínculo. */
export interface UploadTicket {
  fileId: number;
  uploadUrl: string;
  expiresIn: number;
}

/**
 * Resultado de una subida completa. Los tres metadatos salen del `File` del navegador:
 * la api ya no los devuelve porque no ve el byte.
 */
export interface UploadedFile {
  fileId: number;
  fileName: string;
  mimeType: string;
  fileSize: number;
}
