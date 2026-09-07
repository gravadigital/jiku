import type { AuthorUser } from '@/features/auth/types';

export interface Client {
  id?: number;
  name: string;
}

export type ProjectStatus = 'analisis' | 'activo' | 'inactivo' | 'finalizado' | 'cancelado';

export type ProjectType = 'interno' | 'comercial' | 'investigacion' | 'propuesta';

/**
 * Las fechas que vienen de la api son `string` ISO, no `Date`: el contrato las declara
 * `{type: string, format: date-time}` y viajan serializadas en JSON. Tiparlas `Date` era una
 * mentira que el compilador no podía detectar —los tipos de este servicio no derivan de
 * `@jiku/models`— y que se manifestaba en runtime como "getTime is not a function".
 * Los helpers de `@/shared/utils` aceptan las dos formas; para operar con la fecha, envolver
 * en `new Date()` explícitamente.
 *
 * `CreateProjectPayload` sí conserva `Date`: es lo que el formulario ENVÍA, y ahí el valor
 * es un `Date` real construido por el date picker.
 */
export interface Project {
  id?: number;
  code: string;
  name: string;
  description: string;
  status: ProjectStatus;
  type: ProjectType;
  priority: number;
  initDate: string;
  endDate: string;
  creator: AuthorUser;
  client?: Client;
  keyValuePairs?: Record<string, string>;
}

export interface ProjectFilters {
  search?: string;
  state?: string;
  type?: string;
  sort?: string;
}

export interface CreateProjectPayload {
  code: string;
  name: string;
  description: string;
  status?: ProjectStatus | string;
  type: ProjectType | string;
  priority?: number;
  initDate: Date;
  endDate?: Date | null;
  clientId?: number | null;
  keyValuePairs?: Record<string, string | null> | null;
}

export type UpdateProjectPayload = Partial<CreateProjectPayload>;
