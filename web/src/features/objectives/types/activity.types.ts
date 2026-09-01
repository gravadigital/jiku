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
  /**
   * ISO string de la ultima edicion del comentario. `null` si nunca fue editado.
   * Declarado como `string`, no `Date`, pese a que el resto de las fechas de esta interfaz
   * son `Date`: el valor llega serializado en JSON en ambos modulos, y `createdAt: Date`
   * aca es una imprecision preexistente que esta story no propaga.
   */
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
