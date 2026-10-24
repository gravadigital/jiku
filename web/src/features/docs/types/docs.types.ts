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

export interface DocumentsFilters {
  projectId?: number;
  requirementId?: number;
  taskId?: number;
  limit?: number;
  cursor?: string;
}
