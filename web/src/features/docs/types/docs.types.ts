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
  /** Nombre de quien tiene el lock; `null` si el servicio no lo resuelve. */
  holderName?: string | null;
  via: 'human' | 'agent';
  expiresAt: string;
}

export interface DocsRelations {
  clients?: number[];
  projects?: number[];
  requirements?: number[];
  tasks?: number[];
}

export type DocsVisibility = 'internal' | 'public' | 'restricted';

/** Un id desconocido llega con `name: null`: la web muestra `#id`. */
export interface DocsClientRef {
  id: number;
  name: string | null;
}

export interface DocsProjectRef {
  id: number;
  name: string | null;
  code: string | null;
  clientId: number | null;
}

export interface DocsTitleRef {
  id: number;
  title: string | null;
  projectId: number | null;
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
  visibility: DocsVisibility;
  createdAt: string;
  /** sub de Zitadel */
  createdBy: string;
  createdByName?: string | null;
  updatedAt: string;
  /** sub de Zitadel */
  updatedBy: string;
  updatedByName?: string | null;
  /** Ids de cliente / proyecto (contrato 1.3.0). */
  clients?: number[];
  projects?: number[];
  /** Solo con `projectId` en el filtro. */
  projectMatch?: 'direct' | 'indirect';
  prunedVersionsCount?: number;
  clientRefs?: DocsClientRef[];
  projectRefs?: DocsProjectRef[];
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

/** Detalle 1.3.0: sin `folder`; los nombres de los vínculos llegan resueltos en `*Refs`. */
export interface DocsDocumentDetail extends DocsDocument {
  clientRefs: DocsClientRef[];
  projectRefs: DocsProjectRef[];
  requirementRefs: DocsTitleRef[];
  taskRefs: DocsTitleRef[];
}

export interface DocsDocumentPage {
  items: DocsDocument[];
  page: DocsPageInfo;
}

export type DocsDocumentSort =
  'updatedAt' | '-updatedAt' | 'createdAt' | '-createdAt' | 'title' | '-title' | 'path' | '-path';

export interface DocumentsFilters {
  projectId?: number[];
  clientId?: number[];
  topic?: string[];
  person?: string[];
  requirementId?: number;
  taskId?: number;
  hasProject?: boolean;
  hasClient?: boolean;
  hasTopic?: boolean;
  visibility?: DocsVisibility;
  myActiveProjects?: boolean;
  count?: boolean;
  folderId?: string;
  sort?: DocsDocumentSort;
  limit?: number;
  cursor?: string;
}

export type SearchDocumentsParams = Omit<
  DocumentsFilters,
  'myActiveProjects' | 'count' | 'sort' | 'cursor' | 'folderId'
> & {
  q: string;
  limit?: number;
};

// --- S-082: búsqueda y escritura (verbatim de docs/apis/api.yaml, Docs*) ---

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
  updatedByName?: string | null;
  createdBy?: string;
  createdByName?: string | null;
  visibility?: DocsVisibility;
  clients?: number[];
  projects?: number[];
  projectMatch?: 'direct' | 'indirect';
  clientRefs?: DocsClientRef[];
  projectRefs?: DocsProjectRef[];
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
  /** Sin `folderId` el módulo ubica el documento (REQ-021). */
  folderId?: string;
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
  revokeReason?: 'manual' | 'document_deleted' | 'restricted' | null;
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

// --- Contrato 1.3.0: sugerencias del buscador y relaciones (verbatim de docs/apis/api.yaml) ---

export interface DocsSuggestedProject {
  id: number;
  name: string;
  code: string | null;
  clientId: number | null;
  clientName: string | null;
  /** El proyecto es de la persona que consulta. */
  mine: boolean;
}

export interface DocsSuggestedClient {
  id: number;
  name: string;
}

export interface DocsSuggestedPerson {
  userId: string;
  name: string;
}

export interface DocsTopic {
  topic: string;
  documents: number;
}

export interface DocsSearchSuggestions {
  projects: DocsSuggestedProject[];
  clients: DocsSuggestedClient[];
  persons: DocsSuggestedPerson[];
  topics: DocsTopic[];
}

export interface DocsRelationSet {
  clients?: number[];
  projects?: number[];
  requirements?: number[];
  tasks?: number[];
}

export interface DocsRelationsResult {
  id: string;
  version: number;
  relations: {
    clients: number[];
    projects: number[];
    requirements: number[];
    tasks: number[];
  };
  warnings?: string[];
}

export interface DocsRelationSuggestion {
  /** `null`: candidato solo de cliente. */
  projectId: number | null;
  clientId: number | null;
  score: number;
  reason: string;
  projectName?: string | null;
  projectCode?: string | null;
  clientName?: string | null;
}

export interface DocsRelationSuggestions {
  items: DocsRelationSuggestion[];
}

export interface UpdateRelationsPayload {
  baseVersion: number;
  add?: DocsRelationSet;
  remove?: DocsRelationSet;
}

// --- S-096: historial de versiones y restauración (verbatim de docs/apis/api.yaml) ---

export interface DocsVersion {
  version: number;
  checksum: string;
  sizeBytes: number;
  /** sub de Zitadel */
  author: string;
  authorName: string | null;
  kind: 'create' | 'update' | 'restore';
  protected: boolean;
  via: 'human' | 'agent' | 'service';
  sessionId: string | null;
  message: string | null;
  createdAt: string;
}

export interface DocsVersionPage {
  items: DocsVersion[];
  page: DocsPageInfo;
}

export interface RestoreVersionPayload {
  fromVersion: number;
  baseVersion: number;
}

/** `details` de `404 version_pruned`. */
export interface DocsVersionPrunedDetails {
  requestedVersion: number;
  previousAvailable?: number | null;
  nextAvailable?: number | null;
}
