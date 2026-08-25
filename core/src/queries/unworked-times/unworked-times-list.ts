import { Query } from '../types';
import { runList } from '../engine/run';
import { ValidatedListQuery } from '../engine/types';
import { validateList } from '../engine/validate-query';
import { unworkedTimesSpec } from './unworked-times-spec';

/**
 * Colección paginada de ausencias.
 *
 * EN MODO EXTERNO DEVUELVE `items: []` SIN EJECUTAR UNA SOLA CONSULTA (CA-9): además de que el
 * portal de clientes no tiene por qué saber quién faltó, `reason` incluye `medico` y `enfermedad`,
 * que son dato de salud.
 *
 * ORDENA ASCENDENTE por default (`['date']`), a diferencia de `worked-times`: una ausencia se lee
 * de la más vieja a la más nueva.
 *
 * NO HAY `unworked-times.get`: el patrón no se registra (CA-15).
 */
/** El payload de `unworked-times.list` DESPUÉS de validar. Alias del tipo del motor. */
export type UnworkedTimesListPayload = ValidatedListQuery;

export const unworkedTimesList: Query<UnworkedTimesListPayload> = {
  pattern: 'unworked-times.list',

  validate: (payload: unknown) => validateList(unworkedTimesSpec, payload),

  execute: (payload, ctx) => runList(unworkedTimesSpec, payload, ctx),
};

export default unworkedTimesList;
