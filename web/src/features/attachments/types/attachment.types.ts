/**
 * Espacio de identificadores de un recurso de archivo. `attachment` es un
 * vínculo ya guardado (`attachments.id`); `file` es un archivo que existe sin
 * vínculo (`files.id`), típicamente uno recién subido. Resolver uno contra la
 * ruta del otro daría un 404 o el preview de OTRO adjunto que casualmente
 * tenga ese id, así que la distinción no es opcional.
 */
export type AttachmentResource = 'attachment' | 'file';

/**
 * Los cinco tipos de entidad que un vínculo puede apuntar después de REQ-001.
 * Los cinco que se fueron (`*_draft`, `comment`, `stage`) los resolvió el
 * backfill de la migración: no hay draft, el archivo existe por sí solo.
 */
export type EntityType =
  | 'project'
  | 'requirement'
  | 'objective'
  | 'requirement_comment'
  | 'objective_comment';

export interface Attachment {
  /** Id del **vínculo**, no del archivo. */
  readonly id: number;
  /** FK a `files`. Es lo que viaja en `fileIds` al guardar la entidad. */
  readonly fileId: number;
  readonly entityType: EntityType;
  readonly entityId: number;
  readonly fileName: string;
  readonly fileSize: number;
  readonly mimeType: string;
  readonly storageKey: string;
  readonly uploadedBy: string;
  readonly description: string | null;
  readonly createdAt: string;
  readonly uploader: {
    readonly id: string;
    readonly name: string;
    /**
     * `null` cuando quien subió es una identidad de servicio: un machine user de Zitadel no
     * tiene dirección de correo. Es una posición alcanzable de verdad — el publicador externo
     * sube archivos por el bus desde REQ-001.
     *
     * Ningún componente lo renderiza; se declara para que el tipo no mienta.
     */
    readonly email: string | null;
  };
}

/**
 * Lo que el cliente declara para pedir permiso de subida. No menciona la
 * entidad: subir y vincular son dos operaciones distintas desde REQ-001.
 */
export interface UploadTicketRequest {
  readonly fileName: string;
  readonly mimeType: string;
  readonly fileSize: number;
  /**
   * sha256 declarado por el cliente. Nadie lo verifica (D-25), por eso esta
   * story lo manda siempre en `null` en lugar de leer el archivo entero.
   */
  readonly checksum?: string | null;
}

/**
 * Permiso de subida de un solo objeto. `uploadUrl` es la excepcion declarada a
 * ADR-009: viaja al navegador porque el PUT lo hace el navegador, y llega por
 * la respuesta de la api, nunca por una variable NEXT_PUBLIC_*.
 */
export interface UploadTicket {
  readonly fileId: number;
  readonly uploadUrl: string;
  readonly expiresIn: number;
}
