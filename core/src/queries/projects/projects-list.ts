import { Query } from '../types';
import { runList } from '../engine/run';
import { ValidatedListQuery } from '../engine/types';
import { validateList } from '../engine/validate-query';
import { projectsSpec } from './projects-spec';

/**
 * Colección paginada de proyectos.
 *
 * DEJÓ DE SER UN STUB EN S-024: hasta acá respondía `unknown_command` con el mensaje de
 * `pendingContract`. Ahora sirve el contrato sobre el motor de consulta, y el archivo es
 * declarativo — la ficha dice QUÉ se puede pedir, el motor sabe CÓMO servirlo.
 *
 * `properties` del contrato es `key_value_pairs` en la base (ADR-004): la traducción vive en
 * `commands/projects/properties.ts` y la ficha la referencia, no la copia.
 */
/** El payload de `projects.list` DESPUÉS de validar. Alias del tipo genérico del motor. */
export type ProjectsListPayload = ValidatedListQuery;

export const projectsList: Query<ProjectsListPayload> = {
  pattern: 'projects.list',

  validate: (payload: unknown) => validateList(projectsSpec, payload),

  execute: (payload, ctx) => runList(projectsSpec, payload, ctx),
};

export default projectsList;
