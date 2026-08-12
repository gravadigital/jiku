export type EntityType =
  | 'objective'
  | 'project'
  | 'stage'
  | 'requirement_draft'
  | 'comment_draft'
  | 'objective_comment'
  | 'requirement_comment'
  | 'objective_comment_draft'
  | 'requirement_comment_draft';

export interface Attachment {
  readonly id: number;
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
    readonly email: string;
  };
}
