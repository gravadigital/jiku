// Verbatim de jiku-docs-queries.yaml 1.1.0 (components.schemas) vía docs/apis/api.yaml (Docs*). R-8 de REQ-016.
// Las fechas son strings ISO (no Date).

export interface DocsPageInfo {
  limit: number;
  returned: number;
  /** Su ausencia es la única señal de fin. */
  cursor?: string;
  /** Solo con `count`. */
  total?: number;
}

export interface DocsAttachment {
  id: string;
  documentId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** `{JIKU_WEB_URL}/docs/attachments/{id}` */
  link: string;
  uploadedBy: string;
  createdAt: string;
}

export interface DocsLock {
  sessionId: string;
  /** sub de Zitadel */
  holder: string;
  via: 'human' | 'agent';
  expiresAt: string;
}

export interface DocsRelations {
  clients?: number[];
  projects?: number[];
  requirements?: number[];
  tasks?: number[];
}

export interface DocsDocument {
  id: string;
  title: string;
  /** Ruta de la carpeta + nombre de archivo: "/clientes/acme/spec.md". */
  path: string;
  folderId: string;
  fileName: string;
  version: number;
  checksum: string;
  sizeBytes: number;
  visibility: 'internal' | 'public';
  createdAt: string;
  /** sub de Zitadel */
  createdBy: string;
  updatedAt: string;
  /** sub de Zitadel */
  updatedBy: string;
  deletedAt?: string | null;
  /** Solo con include content y <= 256 KiB. */
  content?: string;
  /** En lugar de `content` si supera 256 KiB; vence a los 300 s. */
  contentUrl?: string;
  relations?: DocsRelations;
  topics?: string[];
  lock?: DocsLock | null;
  attachments?: DocsAttachment[];
}

export interface DocsDocumentDetail extends DocsDocument {
  folder: {
    id: string;
    /** "/" la raíz; "/clientes/acme/" */
    path: string;
    effectivePermission: 'read' | 'write' | 'manage' | null;
    sharingBlocked: boolean;
  };
}

export interface DocsDocumentPage {
  items: DocsDocument[];
  page: DocsPageInfo;
}

export type DocsDocumentSort =
  'updatedAt' | '-updatedAt' | 'createdAt' | '-createdAt' | 'title' | '-title' | 'path' | '-path';

export interface DocumentsFilters {
  projectId?: number;
  requirementId?: number;
  taskId?: number;
  folderId?: string;
  sort?: DocsDocumentSort;
  limit?: number;
  cursor?: string;
}

// --- S-082: carpetas, búsqueda y escritura (verbatim de docs/apis/api.yaml, Docs*) ---

export interface DocsFolder {
  id: string;
  name: string;
  /** "/" la raíz; "/clientes/acme/" */
  path: string;
  parentId: string | null;
  inheritAcl: boolean;
  externalBlocked: boolean;
  /** Efectivo */
  sharingBlocked: boolean;
  createdAt: string;
  createdBy: string;
  effectivePermission: 'read' | 'write' | 'manage' | null;
}

export interface DocsFolderPage {
  items: DocsFolder[];
  page: DocsPageInfo;
}

export interface DocsSearchHit {
  documentId: string;
  version: number;
  title: string;
  path: string;
  headingPath: string[];
  /** Máximo 500 caracteres; se trata siempre como texto. */
  snippet: string;
  score: number;
  updatedAt: string;
  /** sub de Zitadel */
  updatedBy: string;
}

/** Sin `page`: devuelve los mejores `limit` resultados. */
export interface DocsSearchResponse {
  items: DocsSearchHit[];
}

export interface DocsWriteResult {
  id: string;
  version: number;
  path?: string;
  /** Por ejemplo `possible_secret_detected` (no bloquea). */
  warnings?: string[];
}

export interface DocsIdResult {
  id: string;
}

/** Respuesta de `POST …/lock` (schema `DocsLock` de la api; acá se renombra porque `DocsLock` es el `lock` del documento). */
export interface DocsLockGrant {
  id: string;
  sessionId: string;
  expiresAt: string;
}

export interface DocsAttachmentUpload {
  id: string;
  /** URL prefirmada para el PUT del binario. No se loguea. */
  uploadUrl: string;
  /** Segundos */
  expiresIn: number;
  /** `{JIKU_WEB_URL}/docs/attachments/{id}` */
  link: string;
}

export interface DocsAttachmentConfirm {
  id: string;
  status: 'ready';
}

// --- Contrato de errores (DD-7) y resultado de las Server Actions (P-2) ---

/** Cuerpo de error de las rutas de docs: `code` sin traducir y `details` verbatim. */
export interface DocsError {
  code: string;
  message: string;
  status: number;
  details?: Record<string, unknown>;
}

/**
 * Las Server Actions de docs no lanzan: en producción Next reemplaza el error lanzado por
 * uno genérico y se perderían `code` y `details`. Devuelven un resultado como dato (P-2).
 */
export type DocsResult<T> = { ok: true; data: T } | { ok: false; error: DocsError };

export interface CreateDocumentPayload {
  id?: string;
  folderId: string;
  fileName: string;
  content: string;
  message?: string;
}

export interface UpdateDocumentPayload {
  baseVersion: number;
  content: string;
  sessionId?: string;
  message?: string;
}

export interface RequestAttachmentUploadPayload {
  id?: string;
  documentId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  checksum: string;
}

export interface FolderTrailItem {
  /** `null` si el ancestro no es legible: se muestra como texto. */
  id: string | null;
  name: string;
}

export interface FolderTrail {
  folder: DocsFolder;
  trail: FolderTrailItem[];
}

export interface RootFolders {
  root: DocsFolder | null;
  tops: DocsFolder[];
}

export interface UploadedDocAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  link: string;
}

// Links compartidos (S-083). Verbatim de `docs/apis/api.yaml` (DocsShare, DocsSharePage,
// DocsShareCreated, DocsShareRevoked). Las fechas son `string` ISO.
export interface DocsShare {
  id: string;
  documentId: string;
  mode: 'latest' | 'pinned';
  version?: number | null;
  includeAttachments?: boolean;
  note?: string | null;
  status: 'active' | 'revoked' | 'expired';
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string | null;
  revokedBy?: string | null;
  revokeReason?: 'manual' | 'document_deleted' | null;
  accessCount?: number;
  lastAccessAt?: string | null;
}

export interface DocsSharePage {
  items: DocsShare[];
  page: DocsPageInfo;
}

/** El único lugar donde aparecen `token` y `url`: la web solo usa `url` y no la guarda. */
export interface DocsShareCreated {
  id: string;
  token: string;
  url: string;
  expiresAt: string;
}

export interface DocsShareRevoked {
  id: string;
  revokedAt: string;
}

export type ShareExpiryDays = 7 | 15 | 30 | 90 | 180;

export interface CreateShareInput {
  expiresInDays: ShareExpiryDays;
  includeAttachments: boolean;
  note?: string;
  acknowledgeSecretWarning?: boolean;
}
