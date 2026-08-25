import { Query } from '../types';
import { runList } from '../engine/run';
import { ValidatedListQuery } from '../engine/types';
import { validateList } from '../engine/validate-query';
import { weekAssignedTimesSpec } from './week-assigned-times-spec';

/**
 * Colección paginada de asignaciones semanales.
 *
 * EN MODO EXTERNO DEVUELVE `items: []` SIN EJECUTAR UNA SOLA CONSULTA (CA-9).
 *
 * NO DECLARA `filter.id`, y la ausencia es del contrato (CA-8): una asignación semanal se busca por
 * PERSONA y por SEMANA, no por id.
 *
 * NO HAY `week-assigned-times.get`: el patrón no se registra (CA-15).
 */
/** El payload de `week-assigned-times.list` DESPUÉS de validar. Alias del tipo del motor. */
export type WeekAssignedTimesListPayload = ValidatedListQuery;

export const weekAssignedTimesList: Query<WeekAssignedTimesListPayload> = {
  pattern: 'week-assigned-times.list',

  validate: (payload: unknown) => validateList(weekAssignedTimesSpec, payload),

  execute: (payload, ctx) => runList(weekAssignedTimesSpec, payload, ctx),
};

export default weekAssignedTimesList;
