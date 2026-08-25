import { Query } from '../types';
import { runList } from '../engine/run';
import { ValidatedListQuery } from '../engine/types';
import { validateList } from '../engine/validate-query';
import { projectPermissionsSpec } from './project-permissions-spec';

/**
 * Colección paginada de permisos de proyecto: qué usuario ve qué proyecto.
 *
 * EN MODO EXTERNO DEVUELVE SOLO LAS FILAS DE PROYECTOS PERMITIDOS (CA-12, CA-13), o sea QUIÉN MÁS
 * accede a lo que el caller ve — NO "solo las mías", que sería otro recurso, y NO el mapa completo
 * de accesos del producto.
 *
 * NO HAY `project-permissions.get`: el patrón no se registra (CA-15).
 */
/** El payload de `project-permissions.list` DESPUÉS de validar. Alias del tipo del motor. */
export type ProjectPermissionsListPayload = ValidatedListQuery;

export const projectPermissionsList: Query<ProjectPermissionsListPayload> = {
  pattern: 'project-permissions.list',

  validate: (payload: unknown) => validateList(projectPermissionsSpec, payload),

  execute: (payload, ctx) => runList(projectPermissionsSpec, payload, ctx),
};

export default projectPermissionsList;
