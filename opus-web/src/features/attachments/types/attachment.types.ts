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
