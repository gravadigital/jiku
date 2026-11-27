import type { ObjectiveActivity } from './activity.types';
import type { AuthorUser, Person } from '@/features/auth/types';
import type { Project } from '@/features/projects/types/project.types';

export type ObjectiveState = 'activo' | 'backlog' | 'en_revision' | 'cancelado' | 'finalizado';

export type ObjectiveArea = 'desarrollo' | 'diseño' | 'gestion' | 'investigacion';

export type VisibilityLevel = 'public' | 'internal' | 'private';

/**
 * Las fechas que vienen de la api son `string` ISO, no `Date`: el contrato las declara
 * `{type: string, format: date-time}` y viajan serializadas en JSON. Tiparlas `Date` era una
 * mentira que el compilador no podía detectar —los tipos de este servicio no derivan de
 * `@jiku/models`— y que se manifestaba en runtime como "getTime is not a function".
 * Los helpers de `@/shared/utils` aceptan las dos formas; para operar con la fecha, envolver
 * en `new Date()` explícitamente.
 */
export interface WorkedTime {
  id: number;
  minutes: number;
  personId: number;
  person?: Person;
  createdAt: string;
  date: string;
}

export interface Objective {
  id?: number;
  area: string;
  title: string;
  description?: string | null;
  estimatedFinishDate: string | null;
  estimatedHours?: number | null;
  finishedAt: string | null;
  state: string;
  priority: number;
  createdAt: string;
  updatedAt: string;
  projectId: number;
  project: Project;
  ObjectiveActivity?: ObjectiveActivity[];
  persons: Person[];
  creator: AuthorUser;
  showProject?: boolean;
  workedTime?: WorkedTime[];
  workedTimeDetailed?: WorkedTime[];
  workedMinutes: number;
  portalContainer?: HTMLDivElement | null;
  visibilityLevel: string;
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
