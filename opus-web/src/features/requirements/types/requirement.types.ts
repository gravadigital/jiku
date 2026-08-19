import type { Subscriber } from '@/features/subscriptions';

export type RequirementState =
  'analisis' | 'planificacion' | 'en_cola' | 'desarrollo' | 'revision' | 'resuelto' | 'cancelado';

export type RequirementPriority = 'sin_prioridad' | 'baja' | 'media' | 'alta' | 'urgente';

export type RequirementActivityType =
  'state' | 'comment' | 'type' | 'priority' | 'title' | 'description';

export interface RequirementActivity {
  id: number;
  typeOfActivity: RequirementActivityType;
  previousValue?: string;
  newValue?: string;
  visibilityLevel: 'public' | 'internal';
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
}

export interface Requirement {
  id: number;
  title: string;
  description: string;
  type: string;
  priority: RequirementPriority;
  state: RequirementState;
  estimatedFinishDate: string | null;
  tags: string[];
  projectId: number;
  project?: { id: number; name: string };
  scheduledAt: string | null;
  inProgressAt: string | null;
  inReviewAt: string | null;
  finishedAt: string | null;
  resolutionComment: string | null;
  creator: { id: string; name: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface RequirementDetail extends Requirement {
  requirementActivity: RequirementActivity[];
  subscriptors: Subscriber[];
}

export interface UpdateOpusRequirementPayload {
  state?: RequirementState;
  priority?: RequirementPriority;
}

export interface CreateRequirementPayload {
  title: string;
  description: string;
  type: string;
  estimatedFinishDate?: string;
  projectId: number;
  priority?: RequirementPriority;
  tags?: string[];
  subscriberUserIds?: string[];
  /** Ids de `files` ya subidos por quien publica. Reemplaza a `attachmentIds` (REQ-001). */
  fileIds?: number[];
}

export interface CreateRequirementResponse {
  id: number;
  title: string;
  description: string;
  state: RequirementState;
  priority: RequirementPriority;
  projectId: number;
  creator: { id: string; name: string; email: string } | null;
}
