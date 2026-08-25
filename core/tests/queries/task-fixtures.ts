import {
  Objective,
  ObjectiveActivity,
  ObjectiveSubscriptor,
  Person,
  PersonObjective,
  Project,
  Requirement,
  User,
  UserProjectPermission,
} from '@jiku/models';
import { getTrustedPublisherId } from '../../src/config';
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

/**
 * LOS CALLERS DE CONSULTA, uno por clase (S-023).
 *
 * Los ids son los del SUBJECT, o sea `users.id`, o sea el `sub` de Zitadel: no hay traducción de
 * nombre ni de tipo entre el segundo token del subject y la PK de la tabla.
 *
 * `Q_NO_ROW` NO SE CREA NUNCA: es el caso de "sin fila en `users`".
 */
export const Q_INTERNAL = 'sub-q-user';
export const Q_ADMIN = 'sub-q-admin';
export const Q_EXTERNAL = 'sub-q-external';
export const Q_MIXED = 'sub-q-mixed';
export const Q_CONNECTOR = 'sub-q-connector';
export const Q_EMPTY = 'sub-q-empty';
export const Q_NO_ROW = 'sub-q-sin-fila';

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

  // EL PUBLICADOR CONFIABLE NECESITA FILA DESDE S-023, y es un cambio de fixtures y no de
  // aserciones. `dispatchQuery()` usa su id como caller por defecto, y la segunda compuerta —la
  // de la CLASE— no exime a nadie: sin fila, los ~75 despachos de estos archivos responderían
  // `unknown_caller`. Con `internal-app` entra en clase CONECTOR, o sea SIN recorte, que es el
  // comportamiento que estos tests ya asumían y el que la api tiene en producción.
  //
  // Sale de `getTrustedPublisherId()` y no de un literal para que `core/.env.test` siga siendo la
  // única fuente del valor. Precedente exacto: S-017 cambió por esto mismo el caller por defecto
  // de `dispatch()`.
  await User.create({
    id: getTrustedPublisherId(),
    name: 'Api',
    username: 'api-queries',
    email: 'api-queries@test.local',
    roles: ['internal-app'],
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

/**
 * Los callers de consulta con sus roles EXACTOS (S-023). `Q_NO_ROW` queda fuera a propósito.
 *
 * Van en un helper aparte de `createWorld()` porque solo los necesitan los archivos que ejercitan
 * las compuertas y el recorte: el resto del suite despacha con el publicador confiable.
 */
export async function createQueryCallers(): Promise<void> {
  await User.bulkCreate([
    { id: Q_INTERNAL, name: 'Interna', username: 'q-user', email: 'q-user@test.local', roles: ['user'] },
    { id: Q_ADMIN, name: 'Admin', username: 'q-admin', email: 'q-admin@test.local', roles: ['admin'] },
    {
      id: Q_EXTERNAL,
      name: 'Externa',
      username: 'q-external',
      email: 'q-external@test.local',
      roles: ['external-user'],
    },
    // GANA EL MÁS RESTRICTIVO: con estos dos roles la clase es EXTERNA, no interna (CA-3).
    {
      id: Q_MIXED,
      name: 'Mixta',
      username: 'q-mixed',
      email: 'q-mixed@test.local',
      roles: ['user', 'external-user'],
    },
    // `internal-app` SIN ser el publicador confiable: `ROLE_METHODS` le da `queries: []`, así que
    // la compuerta 1 lo corta y NUNCA llega a la clase conector (CA-18).
    {
      id: Q_CONNECTOR,
      name: 'Conector',
      username: 'q-connector',
      email: 'q-connector@test.local',
      roles: ['internal-app'],
    },
    { id: Q_EMPTY, name: 'Sin Roles', username: 'q-empty', email: 'q-empty@test.local', roles: [] },
  ] as any);
}

export async function destroyQueryCallers(): Promise<void> {
  const ids = [Q_INTERNAL, Q_ADMIN, Q_EXTERNAL, Q_MIXED, Q_CONNECTOR, Q_EMPTY];
  // Los permisos PRIMERO: `user_project_permissions.user_id` referencia `users.id`, y borrar al
  // caller con sus permisos vivos falla por la FK.
  await UserProjectPermission.destroy({ where: { userId: ids } });
  await User.destroy({ where: { id: ids } });
}

/**
 * Permisos de proyecto de un caller: las filas que sostienen el aislamiento del portal.
 *
 * `user_id` es `varchar(100)` = el `sub` de Zitadel = exactamente el `caller` del subject, así que
 * la fila se siembra con el mismo string que viaja en el segundo token.
 *
 * NO TIENE UN `revoke` PROPIO a propósito: quien las borra es `destroyQueryCallers()`, que TIENE
 * que hacerlo igual antes de borrar a los callers —la FK apunta a `users.id`—. Un segundo helper
 * que borrara lo mismo sería una forma de olvidarse del orden.
 */
export async function grantProjects(userId: string, projectIds: number[]): Promise<void> {
  await UserProjectPermission.bulkCreate(
    projectIds.map((projectId) => ({ userId, projectId })) as any
  );
}

/** Borra todo lo que crea este módulo. En orden inverso a las FK. */
export async function destroyWorld(): Promise<void> {
  await ObjectiveActivity.destroy({ where: {} });
  await ObjectiveSubscriptor.destroy({ where: {} });
  await PersonObjective.destroy({ where: {} });
  await Objective.destroy({ where: {} });
  await Requirement.destroy({ where: {} });
  await Person.destroy({ where: {} });
  await UserProjectPermission.destroy({ where: {} });
  await Project.destroy({ where: {} });
  await User.destroy({ where: { id: [CREATOR, getTrustedPublisherId()] } });
}
