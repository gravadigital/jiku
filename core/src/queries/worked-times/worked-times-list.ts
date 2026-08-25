import { Query } from '../types';
import { runList } from '../engine/run';
import { ValidatedListQuery } from '../engine/types';
import { validateList } from '../engine/validate-query';
import { workedTimesSpec } from './worked-times-spec';

/**
 * Colección paginada de horas trabajadas.
 *
 * EN MODO EXTERNO DEVUELVE `items: []` SIN EJECUTAR UNA SOLA CONSULTA (CA-9): la ficha declara
 * "sin acceso" y el motor corta antes de armar el SQL. No es un error: un `caller_not_authorized`
 * le diría al portal de clientes que el recurso existe y le está vedado.
 *
 * NO HAY `worked-times.get`: el patrón no se registra (CA-15). No hay pantalla de detalle de una
 * hora cargada.
 */
/** El payload de `worked-times.list` DESPUÉS de validar. Alias del tipo del motor. */
export type WorkedTimesListPayload = ValidatedListQuery;

export const workedTimesList: Query<WorkedTimesListPayload> = {
  pattern: 'worked-times.list',

  validate: (payload: unknown) => validateList(workedTimesSpec, payload),

  execute: (payload, ctx) => runList(workedTimesSpec, payload, ctx),
};

export default workedTimesList;
