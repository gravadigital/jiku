import type { AuthorUser } from '@/features/auth/types';

export type ActivityType = 'comment' | 'state_change' | 'assignment' | 'update';

export type ActivityVisibilityLevel = 'public' | 'internal';

export interface ObjectiveActivity {
  id?: number;
  typeOfActivity: string;
  previousValue: string;
  newValue: string;
  objectiveId: number;
  createdAt: Date;
  updatedAt: Date;
  projectId: number;
  user: AuthorUser;
  visibilityLevel: ActivityVisibilityLevel;
}

export interface CreateCommentPayload {
  comment: string;
  visibilityLevel?: ActivityVisibilityLevel;
  /** Ids de `files` a vincular al comentario. Reemplaza a `attachmentIds`. */
  fileIds?: number[];
}
