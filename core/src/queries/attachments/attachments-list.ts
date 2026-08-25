import { Query } from '../types';
import { runList } from '../engine/run';
import { ValidatedListQuery } from '../engine/types';
import { validateList } from '../engine/validate-query';
import { attachmentsSpec } from './attachments-spec';

/**
 * Colección paginada de vínculos entidad ↔ archivo, con los datos del archivo APLANADOS.
 *
 * `filter.entityType` es OPCIONAL y no es un discriminador: la tabla es siempre la misma. Lo que sí
 * hace es TRADUCIR, EN LAS DOS DIRECCIONES — `task_comment` se consulta con el nombre que la base
 * usa y vuelve como `task_comment` (CA-3). Toda la traducción vive en la ficha y en
 * `entity-type.ts` (ADR-004), no acá y no en `@jiku/models`.
 *
 * NO DEVUELVE NINGUNA URL (CA-8). Para bajar el byte, el comando `files.{fileId}.request-download`.
 *
 * ESTE ARCHIVO ES DELIBERADAMENTE DECLARATIVO: la ficha dice QUÉ se puede pedir y el motor sabe
 * CÓMO servirlo. Si alguna vez hace falta armar SQL acá, el arreglo va en el motor o en la ficha.
 */
/** El payload de `attachments.list` DESPUÉS de validar. Alias del tipo del motor, como en `comments`. */
export type AttachmentsListPayload = ValidatedListQuery;

export const attachmentsList: Query<AttachmentsListPayload> = {
  pattern: 'attachments.list',

  validate: (payload: unknown) => validateList(attachmentsSpec, payload),

  execute: (payload, ctx) => runList(attachmentsSpec, payload, ctx),
};

export default attachmentsList;
