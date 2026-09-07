import type { User } from '@/features/auth/types';
import type { Project } from '@/features/projects/types/project.types';

/**
 * Las fechas que vienen de la api son `string` ISO, no `Date`: el contrato las declara
 * `{type: string, format: date-time}` y viajan serializadas en JSON. Tiparlas `Date` era una
 * mentira que el compilador no podía detectar —los tipos de este servicio no derivan de
 * `@jiku/models`— y que se manifestaba en runtime como "getTime is not a function".
 * Los helpers de `@/shared/utils` aceptan las dos formas; para operar con la fecha, envolver
 * en `new Date()` explícitamente.
 */
export interface Client {
  id?: number;
  name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: User;
  projects?: Project[];
}

export type ClientStatus = 'activo' | 'inactivo';

export interface ClientFilters {
  search?: string;
  status?: ClientStatus;
  sort?: string;
}

export interface CreateClientPayload {
  name: string;
  description?: string;
}

export type UpdateClientPayload = Partial<CreateClientPayload>;
