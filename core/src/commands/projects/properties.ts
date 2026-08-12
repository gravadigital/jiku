import joi from 'joi';
import { DefaultKeyValuePairs } from '@jiku/models';

/**
 * `properties` (protocolo) <-> `keyValuePairs` (base de datos).
 *
 * El protocolo define una lista de pares:
 *
 *   properties: [{ code: 'documentacion', value: 'https://...' }]
 *
 * pero la columna `key_value_pairs` guarda un objeto plano:
 *
 *   { documentacion: 'https://...' }
 *
 * La traducción vive acá porque la base no se toca: el nombre nuevo es del contrato,
 * no del almacenamiento. Es el mismo criterio que task/objective y taskId/objectiveId.
 */

export interface Property {
  code: string;
  value: string | null;
}

/** Claves admitidas. Las mismas que validaba la api. */
const ALLOWED_CODES = Object.values(DefaultKeyValuePairs) as string[];

/** Las tres primeras son URLs; `mattermost_group_name` es texto libre. */
const URI_CODES = [
  DefaultKeyValuePairs.documentacion,
  DefaultKeyValuePairs.diseño,
  DefaultKeyValuePairs.board_de_tareas,
] as string[];

const uriRule = joi.string().uri().allow(null, '');

export const propertiesSchema = joi
  .array()
  .items(
    joi.object({
      code: joi.string().valid(...ALLOWED_CODES).required(),
      value: joi.alternatives().conditional('code', {
        is: joi.string().valid(...URI_CODES),
        then: uriRule,
        otherwise: joi.string().allow(null, ''),
      }),
    })
  )
  .optional();

/** Convierte la lista del protocolo al objeto que espera la columna. */
export function propertiesToKeyValuePairs(
  properties: Property[] | undefined
): Record<string, string | null> | undefined {
  if (properties === undefined) {
    return undefined;
  }

  const out: Record<string, string | null> = {};
  for (const { code, value } of properties) {
    out[code] = value ?? null;
  }
  return out;
}
