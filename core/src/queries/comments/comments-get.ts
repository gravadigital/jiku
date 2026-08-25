import { Query } from '../types';
import { runGet } from '../engine/run';
import { ValidatedGetQuery } from '../engine/types';
import { validateGet } from '../engine/validate-query';
import { commentsSpec } from './comments-spec';

/**
 * Un comentario.
 *
 * NECESITA `id` **Y** `entityType`, y esa es la razón de existir de la story: el id 1234 existe en
 * `objective_activity` y en `requirement_activity`, y son DOS FILAS DISTINTAS. Un `get` sin
 * `entityType` devolvería "algún" comentario con ese id y el bug sería SILENCIOSO E INTERMITENTE
 * —funciona hasta que las dos tablas crecen lo suficiente—, así que su ausencia es
 * `invalid_fields` y no un default.
 *
 * Un id inexistente **o no visible** responde `comment_not_found`, con la MISMA respuesta en los
 * dos casos (CA-13): distinguirlos le confirmaría a un caller externo que el comentario existe.
 */
/** El payload de `comments.get` DESPUÉS de validar. Alias del tipo del motor. */
export type CommentsGetPayload = ValidatedGetQuery;

export const commentsGet: Query<CommentsGetPayload> = {
  pattern: 'comments.get',

  validate: (payload: unknown) => validateGet(commentsSpec, payload),

  execute: (payload, ctx) => runGet(commentsSpec, payload, ctx),
};

export default commentsGet;
