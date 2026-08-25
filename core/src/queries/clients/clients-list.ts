import { Query } from '../types';
import { runList } from '../engine/run';
import { ValidatedListQuery } from '../engine/types';
import { validateList } from '../engine/validate-query';
import { clientsSpec } from './clients-spec';

/**
 * Colección paginada de actores.
 *
 * ESTE ARCHIVO ES DELIBERADAMENTE DECLARATIVO: la ficha dice QUÉ se puede pedir y el motor sabe
 * CÓMO servirlo. Si alguna vez hiciera falta armar SQL acá, el arreglo va en la ficha o en el
 * motor, nunca en el archivo del recurso.
 *
 * El orden por defecto es ASCENDENTE POR NOMBRE, no `-createdAt`: lo declara la ficha.
 */
/**
 * El payload de `clients.list` DESPUÉS de validar. Alias del tipo genérico del motor: la gramática
 * de `list` es LA MISMA para los 18 recursos, y una copia por recurso sería la divergencia que la
 * ficha-como-dato existe para evitar.
 */
export type ClientsListPayload = ValidatedListQuery;

export const clientsList: Query<ClientsListPayload> = {
  pattern: 'clients.list',

  validate: (payload: unknown) => validateList(clientsSpec, payload),

  execute: (payload, ctx) => runList(clientsSpec, payload, ctx),
};

export default clientsList;
