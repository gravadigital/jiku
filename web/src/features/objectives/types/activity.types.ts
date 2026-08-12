import type { User } from '@/features/auth/types';

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
  user: User;
  externalReferenceUrl?: string | null;
  externalUserName?: string | null;
  externalUserId?: string | null;
  visibilityLevel: ActivityVisibilityLevel;
}

export interface CreateCommentPayload {
  comment: string;
  visibilityLevel?: ActivityVisibilityLevel;
  attachmentIds?: number[];
}
