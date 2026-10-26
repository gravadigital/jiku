// Proyección del portal de DocsDocument (docs/apis/api.yaml, jiku-docs 1.3.0) que devuelven
// GET /api/opus/docs/documents y .../{id}: la api pide fields id, title, version, visibility,
// createdAt, updatedAt; el detalle suma content/contentUrl y attachments. Sin ruta (path,
// folderId, fileName): REQ-021 decisión 12. Las fechas viajan como string ISO. La UI usa solo
// id, title, updatedAt, content/contentUrl y attachments[].id/fileName; el resto no se muestra.

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
  version?: number;
  visibility?: 'internal' | 'public' | 'restricted';
  createdAt?: string;
  updatedAt: string;
  content?: string;
  contentUrl?: string;
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
