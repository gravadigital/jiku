import { Query } from '../types';
import { runGet } from '../engine/run';
import { ValidatedGetQuery } from '../engine/types';
import { validateGet } from '../engine/validate-query';
import { clientsSpec } from './clients-spec';

/**
 * Un actor.
 *
 * El id viaja EN EL PAYLOAD y no en el subject: el patrón no lleva `{id}` y no puede llevarlo —el
 * cache de subjects de 1024 entradas del server es la razón—.
 *
 * `data` ES EL RECURSO, sin envoltorio de colección. Un id inexistente O NO VISIBLE responde
 * `client_not_found`, y las dos respuestas son IDÉNTICAS: distinguirlas le confirmaría a un caller
 * externo que el actor existe.
 */
/** El payload de `clients.get` DESPUÉS de validar. Alias del tipo del motor. */
export type ClientsGetPayload = ValidatedGetQuery;

export const clientsGet: Query<ClientsGetPayload> = {
  pattern: 'clients.get',

  validate: (payload: unknown) => validateGet(clientsSpec, payload),

  execute: (payload, ctx) => runGet(clientsSpec, payload, ctx),
};

export default clientsGet;
