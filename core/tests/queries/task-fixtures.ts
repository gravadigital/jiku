import {
  Objective,
  ObjectiveActivity,
  ObjectiveSubscriptor,
  Person,
  PersonObjective,
  Project,
  Requirement,
  User,
} from '@jiku/models';
import { sequelize } from '../../src/models';

/**
 * Fixtures del recurso `tasks` para los tests del motor de consultas.
 *
 * LA ESCRITURA DE FIXTURES VA POR LA CONEXIÓN DE ESCRITURA y con los modelos de `@jiku/models`;
 * la LECTURA bajo test va por `readDb` con SQL explícito. Es la asimetría normal de este suite, y
 * es justamente lo que hace que el test valga: si el motor usara el ORM, no habría dos caminos.
 *
 * Vive en un módulo aparte y no en cada archivo porque cuatro copias del mismo alta divergen; los
 * `before` de cada archivo siguen siendo los que la invocan y los `after` los que limpian.
 */

export const CREATOR = 'u-creator-queries';
export const PROJECT_MAIN = 12;
export const PROJECT_OTHER = 13;
export const REQUIREMENT = 300;
export const PERSON_ACTIVE = 77;
export const PERSON_INACTIVE = 78;

export interface TaskSeed {
  id: number;
  title: string;
  description?: string;
  state?: string;
  area?: string;
  priority?: number;
  visibilityLevel?: string;
  projectId?: number;
  requirementId?: number | null;
  createdAt?: string;
  finishedAt?: string | null;
  estimatedFinishDate?: string | null;
}

/** El mundo mínimo del que cuelgan las tareas: usuario, proyectos, requisito y personas. */
export async function createWorld(projects: number[] = [PROJECT_MAIN, PROJECT_OTHER]): Promise<void> {
  await User.create({
    id: CREATOR,
    name: 'Creador',
    username: 'creador-queries',
    email: 'creador-queries@test.local',
    roles: ['admin'],
  });

  for (const id of projects) {
    await Project.create({
      id,
      // `PJK` para el proyecto principal, que es el código que el plan de la story usa en sus
      // escenarios; el resto se derivan del id para no chocar entre archivos.
      code: id === PROJECT_MAIN ? 'PJK' : `PJ${id}`,
      name: id === PROJECT_MAIN ? 'Portal Jiku' : `Proyecto ${id}`,
      type: 'comercial',
      status: 'activo',
      description: 'Proyecto de fixture',
      initDate: new Date('2026-01-01T00:00:00.000Z'),
      createdBy: CREATOR,
    });
  }

  await Requirement.create({
    id: REQUIREMENT,
    title: 'Requisito A',
    description: 'Detalle del requisito',
    state: 'analisis',
    priority: 'sin_prioridad',
    // Cuelga del PRIMER proyecto de la lista, no de una constante: los archivos que solo crean su
    // propio proyecto no tienen por qué crear también el principal.
    projectId: projects[0],
    createdBy: CREATOR,
  });

  await Person.bulkCreate([
    {
      id: PERSON_ACTIVE,
      firstName: 'Ana',
      lastName: 'Pérez',
      initDate: new Date('2026-01-01T00:00:00.000Z'),
    },
    {
      id: PERSON_INACTIVE,
      firstName: 'Beto',
      lastName: 'Gómez',
      initDate: new Date('2026-01-01T00:00:00.000Z'),
    },
  ]);
}

/**
 * Alta de tareas con `createdAt` CONTROLADO.
 *
 * El `created_at` se fija con un UPDATE por SQL y no en el alta: Sequelize pisa las columnas de
 * timestamp al guardar, y el orden por defecto de `tasks` es justamente `-createdAt`. Sin control
 * sobre esa columna, la mitad de los tests de orden no probarían nada.
 */
export async function createTasks(seeds: TaskSeed[]): Promise<void> {
  await Objective.bulkCreate(
    seeds.map((seed) => ({
      id: seed.id,
      title: seed.title,
      description: seed.description ?? null,
      state: seed.state ?? 'backlog',
      area: seed.area ?? 'desarrollo',
      priority: seed.priority ?? 0,
      visibilityLevel: seed.visibilityLevel ?? 'public',
      projectId: seed.projectId ?? PROJECT_MAIN,
      requirementId: seed.requirementId ?? null,
      createdBy: CREATOR,
      finishedAt: seed.finishedAt ? new Date(seed.finishedAt) : null,
      estimatedFinishDate: seed.estimatedFinishDate ?? null,
    })) as any
  );

  for (const seed of seeds) {
    if (seed.createdAt) {
      await sequelize.query('UPDATE objectives SET created_at = :createdAt WHERE id = :id', {
        replacements: { createdAt: seed.createdAt, id: seed.id },
      });
    }
  }
}

/** Comentarios de una tarea, en `objective_activity` con `type_of_activity = 'comment'`. */
export async function createComments(objectiveId: number, count: number): Promise<void> {
  await ObjectiveActivity.bulkCreate(
    Array.from({ length: count }, (_, index) => ({
      typeOfActivity: 'comment',
      previousValue: '',
      newValue: `Comentario ${index + 1}`,
      visibilityLevel: 'public',
      objectiveId,
      changedBy: CREATOR,
    })) as any
  );
}

export async function assignPerson(
  objectiveId: number,
  personId: number,
  options: { isLeader: boolean; active: boolean }
): Promise<void> {
  await PersonObjective.create({ objectiveId, personId, ...options } as any);
}

export async function subscribe(objectiveId: number, userId = CREATOR): Promise<void> {
  await ObjectiveSubscriptor.create({ objectiveId, userId } as any);
}

/** Borra todo lo que crea este módulo. En orden inverso a las FK. */
export async function destroyWorld(): Promise<void> {
  await ObjectiveActivity.destroy({ where: {} });
  await ObjectiveSubscriptor.destroy({ where: {} });
  await PersonObjective.destroy({ where: {} });
  await Objective.destroy({ where: {} });
  await Requirement.destroy({ where: {} });
  await Person.destroy({ where: {} });
  await Project.destroy({ where: {} });
  await User.destroy({ where: { id: CREATOR } });
}
