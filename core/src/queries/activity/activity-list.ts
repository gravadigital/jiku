import { Query } from '../types';
import { runList } from '../engine/run';
import { ValidatedListQuery } from '../engine/types';
import { validateList } from '../engine/validate-query';
import { activitySpec } from './activity-spec';

/**
 * Historial de cambios **y** comentarios de una entidad.
 *
 * ES `comments.list` SIN EL PREDICADO `type_of_activity = 'comment'`: la misma tabla y toda la
 * diferencia en una línea que la ficha NO declara. `filter.entityType` es obligatorio por la misma
 * razón que allá — los ids de las dos tablas de actividad se pisan.
 *
 * NO HAY `activity.get`: no existe la pantalla de detalle de una entrada de historial, y el patrón
 * no está registrado.
 */
/** El payload de `activity.list` DESPUÉS de validar. Alias del tipo del motor. */
export type ActivityListPayload = ValidatedListQuery;

export const activityList: Query<ActivityListPayload> = {
  pattern: 'activity.list',

  validate: (payload: unknown) => validateList(activitySpec, payload),

  execute: (payload, ctx) => runList(activitySpec, payload, ctx),
};

export default activityList;
