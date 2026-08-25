import { Query } from '../types';
import { runList } from '../engine/run';
import { ValidatedListQuery } from '../engine/types';
import { validateList } from '../engine/validate-query';
import { commentsSpec } from './comments-spec';

/**
 * Colección paginada de comentarios.
 *
 * `filter.entityType` es OBLIGATORIO y no es un filtro más: un comentario es una fila de
 * `objective_activity` o de `requirement_activity`, y LOS IDS DE LAS DOS SE PISAN. Sin él, el
 * motor no tiene forma de saber contra qué tabla resolver, y un default devolvería "algún"
 * comentario. Toda la traducción vive en la ficha (ADR-004), no acá y no en `@jiku/models`.
 *
 * ESTE ARCHIVO ES DELIBERADAMENTE DECLARATIVO: la ficha dice QUÉ se puede pedir y el motor sabe
 * CÓMO servirlo. Si alguna vez hace falta armar SQL acá, el arreglo va en el motor o en la ficha.
 */
/** El payload de `comments.list` DESPUÉS de validar. Alias del tipo del motor, como en `tasks`. */
export type CommentsListPayload = ValidatedListQuery;

export const commentsList: Query<CommentsListPayload> = {
  pattern: 'comments.list',

  validate: (payload: unknown) => validateList(commentsSpec, payload),

  execute: (payload, ctx) => runList(commentsSpec, payload, ctx),
};

export default commentsList;
