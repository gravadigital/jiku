// Verbatim de docs/apis/api.yaml (DocsDocument, jiku-docs-queries.yaml 1.1.0) — R-8 de REQ-016.
// Las fechas viajan como string ISO. La UI del portal usa solo id, title, updatedAt,
// content/contentUrl y attachments[].id/fileName; el resto se declara opcional por fidelidad.

export type ModuleStatus = 'not_installed' | 'unavailable' | 'available';

export interface ModuleEntry {
  module: string;
  status: ModuleStatus;
  features?: { sharing?: boolean };
}

export interface DocsAttachment {
  id: string;
  documentId?: string;
  fileName: string;
  mimeType?: string;
  sizeBytes?: number;
  link?: string;
  uploadedBy?: string;
  createdAt?: string;
}

export interface DocsDocument {
  id: string;
  title: string;
  path?: string;
  folderId?: string;
  fileName?: string;
  version?: number;
  checksum?: string;
  sizeBytes?: number;
  visibility?: 'internal' | 'public';
  createdAt?: string;
  createdBy?: string;
  updatedAt: string;
  updatedBy?: string;
  deletedAt?: string | null;
  content?: string;
  contentUrl?: string;
  relations?: {
    clients?: number[];
    projects?: number[];
    requirements?: number[];
    tasks?: number[];
  };
  topics?: string[];
  lock?: {
    sessionId: string;
    holder: string;
    via: 'human' | 'agent';
    expiresAt: string;
  } | null;
  attachments?: DocsAttachment[];
}

export interface DocsPageInfo {
  limit: number;
  returned: number;
  cursor?: string;
  total?: number;
}

export interface DocsDocumentPage {
  items: DocsDocument[];
  page: DocsPageInfo;
}

/** Exactamente una de las dos claves: la api rechaza (400) tener ambas o ninguna. */
export type DocsListScope =
  { projectId: number; requirementId?: never } | { requirementId: number; projectId?: never };
