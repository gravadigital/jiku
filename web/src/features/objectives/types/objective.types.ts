import type { ObjectiveActivity } from './activity.types';
import type { Person, User } from '@/features/auth/types';
import type { Project } from '@/features/projects/types/project.types';

export type ObjectiveState = 'activo' | 'backlog' | 'en_revision' | 'cancelado' | 'finalizado';

export type ObjectiveArea = 'desarrollo' | 'diseño' | 'gestion' | 'investigacion';

export type VisibilityLevel = 'public' | 'internal' | 'private';

export interface WorkedTime {
  id: number;
  minutes: number;
  personId: number;
  person?: Person;
  createdAt: Date;
  date: Date;
}

export interface Objective {
  id?: number;
  area: string;
  title: string;
  description?: string | null;
  estimatedFinishDate: Date | null;
  estimatedHours?: number | null;
  finishedAt: Date | null;
  state: string;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
  projectId: number;
  project: Project;
  ObjectiveActivity?: ObjectiveActivity[];
  persons: Person[];
  creator: User;
  showProject?: boolean;
  workedTime?: WorkedTime[];
  workedTimeDetailed?: WorkedTime[];
  workedMinutes: number;
  portalContainer?: HTMLDivElement | null;
  visibilityLevel: string;
  externalProjectId?: number | null;
  externalIssueId?: string | null;
  externalIssueKey?: string | null;
  externalUrl?: string | null;
  requirementId?: number | null;
}

export interface ObjectiveFilters {
  state?: ObjectiveState | 'all' | string | null;
  area?: ObjectiveArea | 'all' | string | null;
  projectId?: number | string | null;
  personId?: number | string | null;
  projectName?: string | null;
  requirementId?: number | string | null;
  search?: string | null;
  sort?: string | null;
  page?: number | string;
  limit?: number | string;
}

export interface CreateObjectivePayload {
  title: string;
  description?: string | null;
  area: string;
  state?: string;
  priority: number;
  estimatedFinishDate?: Date | string | null;
  estimatedHours?: number | null;
  projectId?: number;
  personIds?: (number | string | undefined)[];
  visibilityLevel?: string;
  requirementId?: number | null;
}

export type UpdateObjectivePayload = Partial<CreateObjectivePayload>;
