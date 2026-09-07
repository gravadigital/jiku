import type { AuthorUser } from '@/features/auth/types';

export type ActivityType = 'comment' | 'state_change' | 'assignment' | 'update';

export type ActivityVisibilityLevel = 'public' | 'internal';

/**
 * Las fechas que vienen de la api son `string` ISO, no `Date`: el contrato las declara
 * `{type: string, format: date-time}` y viajan serializadas en JSON. Tiparlas `Date` era una
 * mentira que el compilador no podía detectar —los tipos de este servicio no derivan de
 * `@jiku/models`— y que se manifestaba en runtime como "getTime is not a function".
 * Los helpers de `@/shared/utils` aceptan las dos formas; para operar con la fecha, envolver
 * en `new Date()` explícitamente.
 */
export interface ObjectiveActivity {
  id?: number;
  typeOfActivity: string;
  previousValue: string;
  newValue: string;
  objectiveId: number;
  createdAt: string;
  updatedAt: string;
  projectId: number;
  user: AuthorUser;
  visibilityLevel: ActivityVisibilityLevel;
  /** ISO string de la ultima edicion del comentario. `null` si nunca fue editado. */
  editedAt: string | null;
  /** Id del usuario que hizo la ultima edicion. `null` si nunca fue editado. */
  editedBy: string | null;
}

export interface CreateCommentPayload {
  comment: string;
  visibilityLevel?: ActivityVisibilityLevel;
  /** Ids de `files` a vincular al comentario. Reemplaza a `attachmentIds`. */
  fileIds?: number[];
}

/**
 * Payload del PATCH de edicion de un comentario ya publicado. Deliberadamente sin
 * `visibilityLevel`: la api rechaza cualquier campo no declarado en su requestBody, y la
 * visibilidad es inmutable despues de creado (RF-8).
 */
export interface UpdateCommentPayload {
  comment: string;
  /** Conjunto COMPLETO de `fileIds` que debe quedar vinculado al comentario. */
  fileIds?: number[];
}
