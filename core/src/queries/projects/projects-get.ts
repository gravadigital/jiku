import { Query } from '../types';
import { runGet } from '../engine/run';
import { ValidatedGetQuery } from '../engine/types';
import { validateGet } from '../engine/validate-query';
import { projectsSpec } from './projects-spec';

/**
 * Un proyecto.
 *
 * DEJÓ DE SER UN STUB EN S-024. El id viaja EN EL PAYLOAD y no en el subject: el patrón no lleva
 * `{id}` y no puede llevarlo —el cache de subjects de 1024 entradas del server es la razón—.
 *
 * Un id inexistente O NO VISIBLE responde `project_not_found`, y las dos respuestas son
 * IDÉNTICAS: distinguirlas le confirmaría a un caller externo que el proyecto existe.
 */
/** El payload de `projects.get` DESPUÉS de validar. Alias del tipo del motor. */
export type ProjectsGetPayload = ValidatedGetQuery;

export const projectsGet: Query<ProjectsGetPayload> = {
  pattern: 'projects.get',

  validate: (payload: unknown) => validateGet(projectsSpec, payload),

  execute: (payload, ctx) => runGet(projectsSpec, payload, ctx),
};

export default projectsGet;
