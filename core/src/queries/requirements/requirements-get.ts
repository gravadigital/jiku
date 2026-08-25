import { Query } from '../types';
import { runGet } from '../engine/run';
import { ValidatedGetQuery } from '../engine/types';
import { validateGet } from '../engine/validate-query';
import { requirementsSpec } from './requirements-spec';

/**
 * Un requisito.
 *
 * El id viaja EN EL PAYLOAD y no en el subject: el patrón no lleva `{id}` y no puede llevarlo.
 *
 * Un id inexistente, uno de un proyecto sin permiso y uno con `visibilityLevel: internal`
 * responden LOS TRES `requirement_not_found`, con el MISMO mensaje: distinguirlos le confirmaría a
 * un caller externo que el requisito existe, y ese oráculo de existencia es la fuga que RF-31
 * existe para no tener.
 */
/** El payload de `requirements.get` DESPUÉS de validar. Alias del tipo del motor. */
export type RequirementsGetPayload = ValidatedGetQuery;

export const requirementsGet: Query<RequirementsGetPayload> = {
  pattern: 'requirements.get',

  validate: (payload: unknown) => validateGet(requirementsSpec, payload),

  execute: (payload, ctx) => runGet(requirementsSpec, payload, ctx),
};

export default requirementsGet;
