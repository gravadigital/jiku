import { Query } from '../types';
import { runGet } from '../engine/run';
import { ValidatedGetQuery } from '../engine/types';
import { validateGet } from '../engine/validate-query';
import { filesSpec } from './files-spec';

/**
 * Los metadatos de un archivo. NO MINTEA NINGUNA URL (CA-8).
 *
 * Un id inexistente, uno con `retentionStatus` distinto de `active` y uno que el caller no puede
 * ver responden LOS TRES `file_not_found`, con el MISMO mensaje: distinguirlos le confirmaría a un
 * externo que el archivo existe.
 *
 * Para obtener los bytes: el comando `files.{fileId}.request-download`, que es donde vive el efecto
 * de firmar, con su vencimiento y su auditoría.
 *
 * ESTE ARCHIVO ES DELIBERADAMENTE DECLARATIVO: la ficha dice QUÉ se puede pedir y el motor sabe
 * CÓMO servirlo.
 */
/** El payload de `files.get` DESPUÉS de validar. Alias del tipo del motor. */
export type FilesGetPayload = ValidatedGetQuery;

export const filesGet: Query<FilesGetPayload> = {
  pattern: 'files.get',

  validate: (payload: unknown) => validateGet(filesSpec, payload),

  execute: (payload, ctx) => runGet(filesSpec, payload, ctx),
};

export default filesGet;
