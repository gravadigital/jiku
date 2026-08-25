import { Query } from '../types';
import { runList } from '../engine/run';
import { ValidatedListQuery } from '../engine/types';
import { validateList } from '../engine/validate-query';
import { settingsSpec } from './settings-spec';

/**
 * `settings.list` — LA LISTA BLANCA DE CLAVES DE CONFIGURACIÓN.
 *
 * ENTRA ENTERO EN EL MOLDE DEL MOTOR: la lista blanca es el `where` de la ficha, la traducción de
 * `hours-per-day` son el `transform` de `base.key` y el `values` de `filterable.key`, y el corte del
 * modo externo es `externalScope: { kind: 'none' }`. Nada de eso vive acá, y esa es la prueba de que
 * la ficha alcanzó: si la traducción se resolviera en este archivo —reescribiendo el payload antes
 * de `validateList`— quedaría fuera de lo que `meta.describe` proyecta, y CA-12 dejaría de ser
 * verificable para este recurso.
 *
 * NO HAY `settings.get`: el patrón no se registra (CA-20). Seis filas se listan.
 */
/** El payload de `settings.list` DESPUÉS de validar. Alias del tipo del motor. */
export type SettingsListPayload = ValidatedListQuery;

export const settingsList: Query<SettingsListPayload> = {
  pattern: 'settings.list',

  validate: (payload: unknown) => validateList(settingsSpec, payload),

  execute: (payload, ctx) => runList(settingsSpec, payload, ctx),
};

export default settingsList;
