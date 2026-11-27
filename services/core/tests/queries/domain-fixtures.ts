import {
  Attachment,
  Client,
  File,
  Objective,
  Origin,
  PersonRequirement,
  Project,
  Requirement,
  RequirementActivity,
  RequirementSubscriptor,
  WorkedTime,
} from '@jiku/models';
import { getTrustedPublisherId } from '../../src/config';
import { sequelize } from '../../src/models';
import { CREATOR, PERSON_ACTIVE, PERSON_INACTIVE, PROJECT_MAIN, PROJECT_OTHER, REQUIREMENT } from './task-fixtures';

/**
 * Fixtures del NÚCLEO DEL DOMINIO (S-024): actores, orígenes, proyectos y requisitos.
 *
 * REUSA `task-fixtures.ts` en vez de duplicar el mundo: `createWorld()` crea el usuario creador,
 * el publicador confiable, los proyectos, un requisito y las dos personas, y `createQueryCallers()`
 * / `grantProjects()` siembran los callers y sus permisos. Acá se agrega lo que esos helpers no
 * tienen y estos tres recursos necesitan.
 *
 * LA ESCRITURA VA POR LA CONEXIÓN DE ESCRITURA con los modelos de `@jiku/models`; la LECTURA bajo
 * test va por `readDb` con SQL explícito. Esa asimetría es lo que hace que el test valga: si el
 * motor usara el ORM no habría dos caminos.
 *
 * `created_at` SE FIJA CON UN `UPDATE` POR SQL y no en el alta: Sequelize pisa los timestamps al
 * guardar, y el orden por defecto de `projects` y `requirements` es `-createdAt`. Sin control
 * sobre esa columna, la mitad de los tests de orden no prueban nada.
 */

/* --------------------------------------------------------------------------------------------
 * ACTORES Y ORÍGENES
 * ------------------------------------------------------------------------------------------ */

/** Dueño de `PROJECT_MAIN` (12): el único VISIBLE para un caller externo con permiso sobre el 12. */
export const CLIENT_MAIN = 5001;
/** Existe, y no es dueño de ningún proyecto. */
export const CLIENT_OTHER = 5002;
/** SIN NINGÚN PROYECTO: el actor que no puede aparecer en modo externo (TS-49). */
export const CLIENT_ORPHAN = 5003;
/** Dueño SOLO de `PROJECT_OTHER` (13), sobre el que el caller externo NO tiene permiso. */
export const CLIENT_FOREIGN = 5004;

export const ORIGIN_MAIN = 7001;

/* --------------------------------------------------------------------------------------------
 * PROYECTOS
 * ------------------------------------------------------------------------------------------ */

/** Proyecto SIN actor ni origen: el que verifica que el JOIN es LEFT y no INNER (TS-12). */
export const PROJECT_ORPHAN = 14;

/* --------------------------------------------------------------------------------------------
 * REQUISITOS
 * ------------------------------------------------------------------------------------------ */

/** El requisito rico: tags, 25 comentarios, responsables, suscriptores, adjuntos y horas. */
export const REQ_MAIN = 88;
/** Sin horas, con 3 comentarios y 4 actividades que NO son comentarios. */
export const REQ_OTHER = 89;
/** Tiene LOS DOS pares de tags: el que sobrevive al AND. */
export const REQ_TAGGED_BOTH = 90;
/** Tiene SOLO el primer par: el que aparecería si la lista se combinara con OR. */
export const REQ_TAGGED_ONE = 91;
/** Su `title` NO contiene "8140": es lo que hace que TS-30 pruebe el desvío numérico. */
export const REQ_NUMERIC = 8140;

/** Proyecto permitido y `public`: el único visible en modo externo. */
export const REQ_VISIBLE = 9101;
/** Proyecto permitido pero `internal`. */
export const REQ_INTERNAL = 9102;
/** Público, pero en un proyecto SIN permiso. */
export const REQ_FOREIGN = 9103;

/** No existe en ninguno de los tres recursos. */
export const MISSING_ID = 999999;

/** La tarea del requisito principal: sus horas son la SEGUNDA mitad de `totalMinutes`. */
export const TASK_OF_REQ_MAIN = 9100;

/** El nombre del archivo del adjunto vivo de `REQ_MAIN`. */
export const FILE_MAIN = 'informe.pdf';

/**
 * El id del `File` que crea `createRequirementRelations()`, para poder afirmar sobre `fileId`.
 *
 * Es un ACCESOR y no una constante porque la columna es `autoIncrement`: fijarlo a mano obligaría a
 * conocer el estado de la secuencia, que depende de qué otro archivo del suite corrió antes.
 */
let fileMainId = 0;
export function getFileMainId(): number {
  return fileMainId;
}

/* --------------------------------------------------------------------------------------------
 * ALTAS
 * ------------------------------------------------------------------------------------------ */

/** Fija `created_at` de una tabla por SQL. Ver la nota de arriba. */
async function setCreatedAt(table: string, id: number, createdAt: string): Promise<void> {
  await sequelize.query(`UPDATE ${table} SET created_at = :createdAt WHERE id = :id`, {
    replacements: { createdAt, id },
  });
}

/** Los cuatro actores y el origen. `description` es la única columna incluible del recurso. */
export async function createClients(): Promise<void> {
  await Client.bulkCreate([
    { id: CLIENT_MAIN, name: 'Acme', description: 'Actor de fixture' },
    { id: CLIENT_OTHER, name: 'Beta', description: 'Cliente historico' },
    { id: CLIENT_ORPHAN, name: 'Gamma', description: null },
    { id: CLIENT_FOREIGN, name: 'Delta', description: null },
  ] as any);

  await Origin.create({ id: ORIGIN_MAIN, reference: 1, name: 'Referido' } as any);
}

/**
 * Completa los proyectos de `createWorld()` con lo que el recurso `projects` necesita y agrega el
 * proyecto SIN actor.
 *
 * `key_value_pairs` se escribe con una clave de valor NULO a propósito: la traducción tiene que
 * preservarlo, no descartarlo.
 */
export async function createProjects(): Promise<void> {
  await Project.update(
    {
      clientId: CLIENT_MAIN,
      originId: ORIGIN_MAIN,
      priority: 5,
      endDate: new Date('2026-12-01T00:00:00.000Z'),
      keyValuePairs: { documentacion: 'https://d.local', board_de_tareas: null },
    } as any,
    { where: { id: PROJECT_MAIN } }
  );
  await Project.update(
    { clientId: CLIENT_FOREIGN, priority: null } as any,
    { where: { id: PROJECT_OTHER } }
  );

  await Project.create({
    id: PROJECT_ORPHAN,
    code: 'PJ14',
    name: 'Proyecto sin actor',
    type: 'interno',
    status: 'analisis',
    description: 'Proyecto sin actor ni origen',
    initDate: new Date('2026-01-01T00:00:00.000Z'),
    priority: 1,
    createdBy: CREATOR,
  } as any);

  await setCreatedAt('projects', PROJECT_MAIN, '2026-01-01T00:00:00.000Z');
  await setCreatedAt('projects', PROJECT_ORPHAN, '2026-02-01T00:00:00.000Z');
  await setCreatedAt('projects', PROJECT_OTHER, '2026-03-01T00:00:00.000Z');
}

interface RequirementSeed {
  id: number;
  title: string;
  description: string;
  type?: string | null;
  priority?: string;
  state?: string;
  estimatedFinishDate?: string | null;
  tags?: { key: string; value: string }[] | null;
  projectId?: number;
  visibilityLevel?: string;
  finishedAt?: string | null;
  createdAt: string;
}

/**
 * Los ocho requisitos del mundo del dominio.
 *
 * LOS `createdAt` ESTÁN ESCALONADOS Y EL DE `REQUIREMENT` (el de `task-fixtures`) SE EMPUJA AL
 * PASADO: el orden por defecto es `-createdAt`, así que `REQ_MAIN` queda primero y el requisito
 * heredado nunca se cuela en la cabeza de la lista.
 *
 * LOS PARES DE TAGS DE `REQ_TAGGED_*` NO REPITEN EL DE `REQ_MAIN`, y es deliberado: el escenario
 * del par exacto y el del AND de la lista tienen que poder afirmarse por separado. Si los tres
 * requisitos compartieran `{modulo, facturacion}`, el test del par exacto no podría decir "solo
 * el 88" y el del AND no podría distinguirse de un OR.
 */
const REQUIREMENT_SEEDS: RequirementSeed[] = [
  {
    id: REQ_MAIN,
    title: 'Alta de facturación',
    description: 'Detalle de facturación del requisito principal',
    type: 'funcionalidad',
    priority: 'alta',
    state: 'desarrollo',
    estimatedFinishDate: '2026-09-01',
    tags: [{ key: 'modulo', value: 'facturacion' }],
    createdAt: '2026-06-01T00:00:00.000Z',
  },
  {
    id: REQ_OTHER,
    title: 'Revisión de stock',
    description: 'Detalle del control de stock',
    type: 'mejora',
    priority: 'baja',
    state: 'resuelto',
    estimatedFinishDate: '2026-08-01',
    // `tags` en NULL: la proyección tiene que devolver `[]` y no `null` (TS-19).
    tags: null,
    finishedAt: '2026-07-01T00:00:00.000Z',
    createdAt: '2026-05-01T00:00:00.000Z',
  },
  {
    id: REQ_TAGGED_BOTH,
    title: 'Compras con proveedor',
    description: 'Detalle de compras',
    tags: [
      { key: 'modulo', value: 'compras' },
      { key: 'cliente', value: 'acme' },
    ],
    createdAt: '2026-04-01T00:00:00.000Z',
  },
  {
    id: REQ_TAGGED_ONE,
    title: 'Compras sin proveedor',
    description: 'Detalle de compras acotado',
    tags: [{ key: 'modulo', value: 'compras' }],
    createdAt: '2026-03-01T00:00:00.000Z',
  },
  {
    id: REQ_NUMERIC,
    // SIN el número en el texto: es lo que hace que la búsqueda numérica se distinga de una
    // coincidencia de `ILIKE`.
    title: 'Alta de comprobantes',
    description: 'Detalle del alta de comprobantes',
    createdAt: '2026-02-01T00:00:00.000Z',
  },
  {
    id: REQ_VISIBLE,
    title: 'Requisito visible',
    description: 'Público en un proyecto permitido',
    visibilityLevel: 'public',
    createdAt: '2026-01-05T00:00:00.000Z',
  },
  {
    id: REQ_INTERNAL,
    title: 'Requisito interno',
    description: 'Interno en un proyecto permitido',
    visibilityLevel: 'internal',
    createdAt: '2026-01-04T00:00:00.000Z',
  },
  {
    id: REQ_FOREIGN,
    title: 'Requisito ajeno',
    description: 'Público en un proyecto sin permiso',
    projectId: PROJECT_OTHER,
    visibilityLevel: 'public',
    createdAt: '2026-01-03T00:00:00.000Z',
  },
];

export async function createRequirements(): Promise<void> {
  await Requirement.bulkCreate(
    REQUIREMENT_SEEDS.map((seed) => ({
      id: seed.id,
      title: seed.title,
      description: seed.description,
      type: seed.type ?? null,
      priority: seed.priority ?? 'sin_prioridad',
      state: seed.state ?? 'analisis',
      estimatedFinishDate: seed.estimatedFinishDate ?? null,
      tags: seed.tags ?? null,
      projectId: seed.projectId ?? PROJECT_MAIN,
      createdBy: CREATOR,
      visibilityLevel: seed.visibilityLevel ?? 'public',
      finishedAt: seed.finishedAt ? new Date(seed.finishedAt) : null,
    })) as any
  );

  for (const seed of REQUIREMENT_SEEDS) {
    await setCreatedAt('requirements', seed.id, seed.createdAt);
  }
  // El requisito de `task-fixtures` al fondo del orden por defecto.
  await setCreatedAt('requirements', REQUIREMENT, '2025-01-01T00:00:00.000Z');
}

/**
 * Lo que cuelga de `REQ_MAIN` y `REQ_OTHER`: comentarios, responsables, suscriptores, adjuntos y
 * horas.
 *
 * LOS 25 COMENTARIOS NO SON UN CAPRICHO: con diez o menos, el tope y la marca `commentsTruncated`
 * no son observables. Y las HORAS VAN EN DOS LUGARES —al requisito y a una tarea suya—, que es lo
 * único que distingue `totalMinutes` completo de la mitad de la fórmula.
 */
export async function createRequirementRelations(): Promise<void> {
  await RequirementActivity.bulkCreate(
    Array.from({ length: 25 }, (_, index) => ({
      typeOfActivity: 'comment',
      previousValue: '',
      newValue: `Comentario ${index + 1}`,
      visibilityLevel: 'public',
      requirementId: REQ_MAIN,
      changedBy: CREATOR,
    })) as any
  );
  await RequirementActivity.bulkCreate(
    Array.from({ length: 3 }, (_, index) => ({
      typeOfActivity: 'comment',
      previousValue: '',
      newValue: `Comentario corto ${index + 1}`,
      visibilityLevel: 'public',
      requirementId: REQ_OTHER,
      changedBy: CREATOR,
    })) as any
  );
  // CUATRO filas que NO son comentarios: sin ellas, el `where` de la ficha no se estaría probando.
  await RequirementActivity.bulkCreate(
    Array.from({ length: 4 }, () => ({
      typeOfActivity: 'state',
      previousValue: 'analisis',
      newValue: 'desarrollo',
      visibilityLevel: 'internal',
      requirementId: REQ_OTHER,
      changedBy: CREATOR,
    })) as any
  );

  await PersonRequirement.bulkCreate([
    { requirementId: REQ_MAIN, personId: PERSON_ACTIVE, isLeader: true },
    { requirementId: REQ_MAIN, personId: PERSON_INACTIVE, isLeader: false },
  ] as any);

  await RequirementSubscriptor.bulkCreate([
    { requirementId: REQ_MAIN, userId: CREATOR },
    { requirementId: REQ_MAIN, userId: getTrustedPublisherId() },
  ] as any);

  const file: File = await File.create({
    fileName: FILE_MAIN,
    fileSize: 1024,
    mimeType: 'application/pdf',
    storageKey: 'grava-gestion/f/informe.pdf',
    storageBucket: 'test-bucket',
    storageRegion: 'us-east-1',
    uploadedBy: CREATOR,
    byteStatus: 'uploaded',
    retentionStatus: 'active',
  } as any);

  fileMainId = file.id;

  const link = (overrides: Record<string, unknown>) => ({
    entityId: REQ_MAIN,
    fileId: file.id,
    fileName: file.fileName,
    fileSize: file.fileSize,
    mimeType: file.mimeType,
    storageKey: file.storageKey,
    storageBucket: file.storageBucket,
    storageRegion: file.storageRegion,
    uploadedBy: CREATOR,
    ...overrides,
  });

  await Attachment.bulkCreate([
    link({ entityType: 'requirement' }),
    // MISMO `entity_id`, OTRA entidad: `attachments` es POLIMÓRFICA y sin el `where` de la ficha
    // este vínculo saldría como adjunto del requisito.
    link({ entityType: 'requirement_comment' }),
    link({ entityType: 'requirement', deletedAt: new Date('2026-07-01T00:00:00.000Z') }),
  ] as any);

  await Objective.create({
    id: TASK_OF_REQ_MAIN,
    title: 'Tarea del requisito principal',
    description: 'Tarea con horas imputadas',
    state: 'backlog',
    area: 'desarrollo',
    priority: 0,
    visibilityLevel: 'public',
    projectId: PROJECT_MAIN,
    requirementId: REQ_MAIN,
    createdBy: CREATOR,
  } as any);

  await WorkedTime.bulkCreate([
    // Horas del REQUISITO.
    {
      date: new Date('2026-06-02T00:00:00.000Z'),
      minutes: 120,
      projectId: PROJECT_MAIN,
      personId: PERSON_ACTIVE,
      requirementId: REQ_MAIN,
    },
    // Horas de una TAREA del requisito: la segunda mitad de la fórmula.
    {
      date: new Date('2026-06-03T00:00:00.000Z'),
      minutes: 60,
      projectId: PROJECT_MAIN,
      personId: PERSON_ACTIVE,
      objectiveId: TASK_OF_REQ_MAIN,
    },
  ] as any);
}

/** El mundo completo del dominio, en el orden en que las FK lo permiten. */
export async function createDomainWorld(): Promise<void> {
  await createClients();
  await createProjects();
  await createRequirements();
  await createRequirementRelations();
}

/**
 * Borra lo que crea este módulo, EN ORDEN INVERSO A LAS FK.
 *
 * El orden importa y no es defensivo: `worked_times`, `attachments`, `requirement_activity`,
 * `requirement_subscriptors` y `people_requirements` cuelgan de `requirements`; `projects` cuelga
 * de `clients`. Lo que crea `task-fixtures` lo borra `destroyWorld()`, que va DESPUÉS de este.
 */
export async function destroyDomainWorld(): Promise<void> {
  await WorkedTime.destroy({ where: {} });
  await Attachment.destroy({ where: {} });
  await File.destroy({ where: {} });
  await RequirementActivity.destroy({ where: {} });
  await RequirementSubscriptor.destroy({ where: {} });
  await PersonRequirement.destroy({ where: {} });
  await Objective.destroy({ where: {} });
  await Requirement.destroy({ where: {} });
  await Project.destroy({ where: { id: PROJECT_ORPHAN } });
  // LOS PROYECTOS QUE SOBREVIVEN SUELTAN AL ACTOR PRIMERO: `projects.client_id` referencia
  // `clients.id`, y los proyectos 12 y 13 los crea —y los borra— `task-fixtures`. Sin este
  // `UPDATE`, borrar los actores falla por la FK.
  await Project.update({ clientId: null, originId: null } as any, { where: {} });
  await Client.destroy({ where: {} });
  await Origin.destroy({ where: {} });
}
