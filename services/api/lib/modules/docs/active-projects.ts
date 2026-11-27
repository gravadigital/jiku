import { Person, Project } from '@jiku/models';
import { MY_ACTIVE_PROJECTS_MAX } from './query';

/**
 * Ids de los proyectos `activo` (enum de `projects.status`) en los que participa la persona cuyo
 * `people.user_id` es `sub`. Orden ascendente, hasta 200 (`maxItems` de `IntOrList` en
 * jiku-docs). `[]` si no hay persona o proyectos. Solo lectura; un error lo maneja el `catch`
 * de la ruta (no se loguea el `sub`).
 */
export async function activeProjectIdsOf(sub: string): Promise<number[]> {
  const projects = await Project.findAll({
    where: { status: 'activo' } as any,
    attributes: ['id'],
    include: [{ model: Person, as: 'persons', attributes: [], where: { userId: sub }, through: { attributes: [] } }],
    order: [['id', 'ASC']],
    limit: MY_ACTIVE_PROJECTS_MAX,
    subQuery: false,
  });
  return projects.map((project) => project.id);
}
