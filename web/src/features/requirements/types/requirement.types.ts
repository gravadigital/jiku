import type { IdentityType } from '@/features/auth/types';
import type { Objective } from '@/features/objectives/types/objective.types';

export type RequirementType = 'funcionalidad' | 'mejora' | 'incidencia' | 'otro' | null;

export type RequirementPriority = 'sin_prioridad' | 'baja' | 'media' | 'alta' | 'urgente';

export type RequirementState =
  'analisis' | 'planificacion' | 'en_cola' | 'desarrollo' | 'revision' | 'resuelto' | 'cancelado';

export type VisibilityLevel = 'public' | 'internal';

export type ActivityType =
  | 'state'
  | 'comment'
  | 'type'
  | 'priority'
  | 'estimatedFinishDate'
  | 'project'
  | 'tag'
  | 'resolution'
  | 'title'
  | 'description';

export type RequirementResolutionType =
  'error_interno' | 'fuera_de_alcance' | 'error_externo' | 'discutible' | 'otro';

export interface RequirementTag {
  key: string;
  value: string;
}

export interface RequirementProject {
  id: number;
  name: string;
}

export interface ProjectPerson {
  id: number;
  firstName: string;
  lastName: string;
}

export interface RequirementResponsiblePerson {
  id: number;
  firstName: string;
  lastName: string;
  isLeader: boolean | null;
}

export interface RequirementActivityUser {
  id: string;
  name: string;
  /**
   * `null` para una identidad de servicio: un machine user de Zitadel no tiene direccion de
   * correo. Es exactamente la misma superficie que `identityType: 'service'` marca.
   * Ningun componente lo renderiza; se declara para que el tipo no mienta.
   */
  email: string | null;
  /** Marca de identidad automatica. Ausente contra una api vieja: no marca nada. */
  identityType?: IdentityType;
}

export interface RequirementCreator {
  id: string;
  name: string;
  /** `null` para una identidad de servicio. Ver `RequirementActivityUser.email`. */
  email: string | null;
  /** Marca de identidad automatica. Ausente contra una api vieja: no marca nada. */
  identityType?: IdentityType;
}

export interface RequirementActivity {
  id: number;
  typeOfActivity: ActivityType;
  previousValue: string | null;
  newValue: string;
  visibilityLevel: VisibilityLevel;
  changedBy: string;
  changedByUser: RequirementActivityUser;
  createdAt: string;
}

export interface Requirement {
  id: number;
  title: string;
  description: string;
  type: RequirementType;
  priority: RequirementPriority;
  state: RequirementState;
  visibilityLevel: VisibilityLevel;
  estimatedFinishDate: string | null;
  projectId: number;
  project?: RequirementProject | null;
  responsiblePeople: RequirementResponsiblePerson[];
  createdBy: string;
  creator: RequirementCreator;
  tags: RequirementTag[];
  createdAt: string;
  updatedAt: string;
  activity?: RequirementActivity[];
  resolutionType?: RequirementResolutionType | null;
  resolutionConclusion?: string | null;
  resolutionComment?: string | null;
  scope: string | null;
  technicalSolution: string | null;
  acceptanceCriteria: string | null;
}

export interface RequirementDetail extends Requirement {
  requirementActivity?: RequirementActivity[];
  linkedObjectives: Objective[];
}

export interface RequirementFilters {
  projectId?: number | string | null;
  state?: RequirementState | string | null;
  type?: RequirementType | string | null;
  priority?: RequirementPriority | string | null;
  createdBy?: string | null;
  estimatedFinishDate?: string | null;
  tag?: string | null;
  search?: string | null;
  page?: number | string;
  limit?: number | string;
  sort?: string | null;
  count?: boolean;
}

export interface CreateRequirementPayload {
  title: string;
  description: string;
  type: RequirementType;
  priority?: RequirementPriority;
  state?: RequirementState;
  visibilityLevel?: VisibilityLevel;
  estimatedFinishDate?: string | null;
  projectId: number;
  responsiblePersonIds?: number[];
  tags?: RequirementTag[];
  /**
   * Ids de `files` (no de vínculos). Reemplaza a `attachmentIds`: el requisito
   * y sus vínculos se crean juntos, o no se crea ninguno.
   */
  fileIds?: number[];
}

export type UpdateRequirementPayload = Partial<{
  title: string;
  description: string;
  type: RequirementType;
  priority: RequirementPriority;
  estimatedFinishDate: string;
  tags: RequirementTag[];
  state: RequirementState;
  visibilityLevel: VisibilityLevel;
  resolutionType: RequirementResolutionType | null;
  resolutionConclusion: string | null;
  resolutionComment: string;
  responsiblePersonIds: number[] | null;
  scope: string | null;
  technicalSolution: string | null;
  acceptanceCriteria: string | null;
  /**
   * Conjunto COMPLETO de `files` que deben quedar vinculados al requisito: el
   * backend deduce qué confirmar y qué desvincular a partir de él.
   */
  fileIds: number[];
}>;

export interface AddActivityPayload {
  comment: string;
  visibilityLevel?: VisibilityLevel;
  /** Ids de `files` embebidos en el comentario. */
  fileIds?: number[];
}

export interface TagSuggestion {
  key: string;
  values: string[];
}

export interface RequirementReportItem {
  id: number;
  title: string;
  type: RequirementType;
  state: RequirementState;
  createdBy: string;
  createdAt: string;
  inProgressAt: string | null;
  finishedAt: string | null;
  totalMinutes: number;
  resolutionType: RequirementResolutionType | null;
  resolutionConclusion: string | null;
  resolutionComment: string | null;
  project: RequirementProject | null;
}

export interface RequirementReportFilters {
  search?: string;
  createdFrom?: string;
  createdTo?: string;
  projectId?: number | string;
}
