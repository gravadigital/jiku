import {
  Attachment,
  File,
  Objective,
  ObjectiveActivity,
  ObjectiveSubscriptor,
  RequirementActivity,
  RequirementSubscriptor,
  User,
  UserProjectPermission,
} from '@jiku/models';
import { sequelize } from '../../src/models';
import { CREATOR, PROJECT_MAIN, PROJECT_OTHER } from './task-fixtures';

/**
 * Fixtures de la FAMILIA DE LAS DOS TABLAS (S-025): comentarios, actividad y suscripciones.
 *
 * REUSA `task-fixtures.ts` para el mundo mínimo —usuario creador, publicador confiable, proyectos,
 * personas— y `domain-fixtures.ts` para los requisitos: acá se agrega solo lo que los tres
 * recursos nuevos necesitan.
 *
 * LA ESCRITURA VA POR LA CONEXIÓN DE ESCRITURA con los modelos de `@jiku/models`; la LECTURA bajo
 * test va por `readDb` con SQL explícito. Esa asimetría es lo que hace que el test valga.
 *
 * `created_at` SE FIJA CON UN `UPDATE` POR SQL y no en el alta: Sequelize pisa los timestamps al
 * guardar, y el default de orden de `comments` y `activity` es por esa columna. Sin control sobre
 * ella, NINGÚN test de orden de esta story prueba nada — y acá es más grave que en S-024, porque
 * el default es ASCENDENTE y copiar el `-createdAt` del resto del contrato produce exactamente el
 * orden inverso, que a simple vista "también ordena".
 *
 * TODAS LAS FILAS DE ACTIVIDAD SE CREAN CON `id` EXPLÍCITO: después de insertar ids explícitos en
 * una tabla con `increment` la secuencia NO AVANZA, y mezclar las dos formas dejaría los tests
 * dependiendo del orden en que corrieron los archivos.
 */

/* --------------------------------------------------------------------------------------------
 * LAS TRES TAREAS DE LA MATRIZ DEL RECORTE
 * ------------------------------------------------------------------------------------------ */

/** Proyecto permitido (12) y `public`: la única cuyos comentarios públicos ve un externo. */
export const TASK_MAIN = 9200;
/** Proyecto permitido pero `internal`: la entidad dueña no es visible. */
export const TASK_INTERNAL = 9201;
/** `public`, pero en `PROJECT_OTHER` (13), sobre el que el externo NO tiene permiso. */
export const TASK_FOREIGN = 9202;

/** El requisito del mundo del dominio (`domain-fixtures`), `PROJECT_MAIN` y `public`. */
export const REQ_MAIN = 88;

/* --------------------------------------------------------------------------------------------
 * LOS COMENTARIOS
 * ------------------------------------------------------------------------------------------ */

/** Comentario `public` de `TASK_MAIN`, con los TRES adjuntos fabricados. */
export const CA_MAIN = 4001;
/** Comentario de `TASK_MAIN` con `visibility_level = 'internal'`: el de TS-61 y H-8. */
export const CA_INTERNAL = 4002;

/** Los tres del test de orden ascendente, con `created_at` escalonado. */
export const CA_OLD = 4010;
export const CA_MID = 4011;
export const CA_NEW = 4012;

/** Dos con EL MISMO `created_at`: el desempate por `id` tiene que ser ASC. */
export const CA_TIE_A = 4020;
export const CA_TIE_B = 4021;

/** El del `q`: su cuerpo contiene "comprobantes". */
export const CA_SEARCH = 4030;
/** Su cuerpo contiene los dígitos `8140`, que NO tienen que desviarse a una búsqueda por id. */
export const CA_DIGITS = 4031;
/** Autor distinto del resto: el que hace observable `filter.authorId`. */
export const CA_OTHER_AUTHOR = 4032;

/** Comentario de `REQ_MAIN`, en la OTRA tabla, con su adjunto `requirement_comment`. */
export const CR_MAIN = 4100;

/**
 * EL MISMO ID EN LAS DOS TABLAS, con contenidos distintos.
 *
 * Es el fixture que existe para TS-34, el test que atrapa el bug que toda esta story previene. Las
 * dos filas se crean con `id` EXPLÍCITO porque el punto es que COINCIDAN.
 */
export const SHARED_ID = 1234;
export const SHARED_TASK_BODY = 'SOY DE LA TAREA';
export const SHARED_REQUIREMENT_BODY = 'SOY DEL REQUISITO';

/** Una fila de `objective_activity` que NO es un comentario: el predicado fijo tiene que excluirla. */
export const ACT_NOT_COMMENT = 5000;

/** No existe en ninguna de las dos tablas. */
export const MISSING_ID = 999999;

/* --------------------------------------------------------------------------------------------
 * LOS CALLERS EXTERNOS
 * ------------------------------------------------------------------------------------------ */

/**
 * EL SEGUNDO CALLER EXTERNO, para "solo las propias".
 *
 * Se crea acá y no en `createQueryCallers()` para no tocar el helper compartido que usan las
 * suites de S-022 a S-024. Sus permisos se borran ANTES que el usuario: la FK apunta a `users.id`.
 */
export const Q_EXTERNAL_2 = 'sub-q-external-2';

export const FILE_ACTIVE = 'informe.pdf';
export const FILE_DELETED_LINK = 'vinculo-borrado.pdf';
export const FILE_RETAINED = 'no-retenido.pdf';

/** El id del `File` vivo, para poder afirmar sobre `fileId`. La columna es autoincremental. */
let activeFileId = 0;
export function getActiveFileId(): number {
  return activeFileId;
}

/* --------------------------------------------------------------------------------------------
 * ALTAS
 * ------------------------------------------------------------------------------------------ */

async function setCreatedAt(table: string, id: number, createdAt: string): Promise<void> {
  await sequelize.query(`UPDATE ${table} SET created_at = :createdAt WHERE id = :id`, {
    replacements: { createdAt, id },
  });
}

/** Las tres tareas de la matriz del recorte externo. */
export async function createActivityTasks(): Promise<void> {
  await Objective.bulkCreate([
    {
      id: TASK_MAIN,
      title: 'Tarea principal',
      state: 'backlog',
      area: 'desarrollo',
      priority: 0,
      visibilityLevel: 'public',
      projectId: PROJECT_MAIN,
      createdBy: CREATOR,
    },
    {
      id: TASK_INTERNAL,
      title: 'Tarea interna',
      state: 'backlog',
      area: 'desarrollo',
      priority: 0,
      visibilityLevel: 'internal',
      projectId: PROJECT_MAIN,
      createdBy: CREATOR,
    },
    {
      id: TASK_FOREIGN,
      title: 'Tarea de otro proyecto',
      state: 'backlog',
      area: 'desarrollo',
      priority: 0,
      visibilityLevel: 'public',
      projectId: PROJECT_OTHER,
      createdBy: CREATOR,
    },
  ] as any);
}

interface ActivitySeed {
  id: number;
  objectiveId: number;
  type?: string;
  newValue?: string;
  previousValue?: string;
  visibilityLevel?: string;
  changedBy?: string;
  createdAt?: string;
}

/** Filas de `objective_activity` con `id` y `created_at` CONTROLADOS. */
export async function createObjectiveActivity(seeds: ActivitySeed[]): Promise<void> {
  await ObjectiveActivity.bulkCreate(
    seeds.map((seed) => ({
      id: seed.id,
      typeOfActivity: seed.type ?? 'comment',
      previousValue: seed.previousValue ?? '',
      newValue: seed.newValue ?? `Comentario ${seed.id}`,
      visibilityLevel: seed.visibilityLevel ?? 'public',
      objectiveId: seed.objectiveId,
      changedBy: seed.changedBy ?? CREATOR,
    })) as any
  );

  for (const seed of seeds) {
    if (seed.createdAt) {
      await setCreatedAt('objective_activity', seed.id, seed.createdAt);
    }
  }
}

interface RequirementActivitySeed {
  id: number;
  requirementId: number;
  type?: string;
  newValue?: string;
  previousValue?: string;
  visibilityLevel?: string;
  changedBy?: string;
  createdAt?: string;
}

export async function createRequirementActivity(
  seeds: RequirementActivitySeed[]
): Promise<void> {
  await RequirementActivity.bulkCreate(
    seeds.map((seed) => ({
      id: seed.id,
      typeOfActivity: seed.type ?? 'comment',
      previousValue: seed.previousValue ?? '',
      newValue: seed.newValue ?? `Comentario ${seed.id}`,
      visibilityLevel: seed.visibilityLevel ?? 'public',
      requirementId: seed.requirementId,
      changedBy: seed.changedBy ?? CREATOR,
    })) as any
  );

  for (const seed of seeds) {
    if (seed.createdAt) {
      await setCreatedAt('requirement_activity', seed.id, seed.createdAt);
    }
  }
}

/**
 * LOS TRES ADJUNTOS FABRICADOS A PROPÓSITO (CA-6): uno normal, uno con el VÍNCULO borrado y uno
 * cuyo ARCHIVO no está retenido. Solo el primero puede aparecer.
 *
 * CON DOS ADJUNTOS EL TEST PASA CON UNA SOLA EXCLUSIÓN IMPLEMENTADA, y hay dos —`deleted_at IS
 * NULL` y `retention_status = 'active'`—, las dos permanentes y no configurables (RF-26).
 *
 * El cuarto vínculo es del MISMO `entity_id` con OTRO `entity_type`: `attachments` es POLIMÓRFICA y
 * sin el filtro de tipo el comentario traería los adjuntos de la ENTIDAD con ese número.
 */
export async function createCommentAttachments(): Promise<void> {
  const active: File = await File.create({
    fileName: FILE_ACTIVE,
    fileSize: 1024,
    mimeType: 'application/pdf',
    storageKey: 'grava-gestion/f/comentario-activo.pdf',
    storageBucket: 'test-bucket',
    storageRegion: 'us-east-1',
    uploadedBy: CREATOR,
    byteStatus: 'uploaded',
    retentionStatus: 'active',
  } as any);
  activeFileId = active.id;

  const deletedLink: File = await File.create({
    fileName: FILE_DELETED_LINK,
    fileSize: 2048,
    mimeType: 'image/png',
    storageKey: 'grava-gestion/f/vinculo-borrado.png',
    storageBucket: 'test-bucket',
    storageRegion: 'us-east-1',
    uploadedBy: CREATOR,
    byteStatus: 'uploaded',
    retentionStatus: 'active',
  } as any);

  // EL ARCHIVO NO RETENIDO: el vínculo está vivo y el archivo no. La exclusión que le faltaba al
  // camino de S-024 (H-7).
  const retained: File = await File.create({
    fileName: FILE_RETAINED,
    fileSize: 4096,
    mimeType: 'application/pdf',
    storageKey: 'grava-gestion/f/no-retenido.pdf',
    storageBucket: 'test-bucket',
    storageRegion: 'us-east-1',
    uploadedBy: CREATOR,
    byteStatus: 'uploaded',
    retentionStatus: 'deleted',
  } as any);

  await Attachment.bulkCreate([
    // (a) el normal: el ÚNICO que puede aparecer.
    { entityType: 'objective_comment', entityId: CA_MAIN, fileId: active.id, uploadedBy: CREATOR },
    // (b) el vínculo borrado.
    {
      entityType: 'objective_comment',
      entityId: CA_MAIN,
      fileId: deletedLink.id,
      uploadedBy: CREATOR,
      deletedAt: new Date('2026-07-01T00:00:00.000Z'),
    },
    // (c) el archivo no retenido.
    { entityType: 'objective_comment', entityId: CA_MAIN, fileId: retained.id, uploadedBy: CREATOR },
    // (d) MISMO número, OTRO tipo: el adjunto de la ENTIDAD, que no es del comentario.
    { entityType: 'objective', entityId: CA_MAIN, fileId: active.id, uploadedBy: CREATOR },
    // (e) el de la otra variante: `requirement_comment` del comentario del requisito.
    {
      entityType: 'requirement_comment',
      entityId: CR_MAIN,
      fileId: active.id,
      uploadedBy: CREATOR,
    },
  ] as any);
}

/** El segundo caller externo, con los mismos permisos que `Q_EXTERNAL`. */
export async function createSecondExternalCaller(projectIds: number[]): Promise<void> {
  await User.create({
    id: Q_EXTERNAL_2,
    name: 'Externa Dos',
    username: 'q-external-2',
    email: 'q-external-2@test.local',
    roles: ['external-user'],
  } as any);
  await UserProjectPermission.bulkCreate(
    projectIds.map((projectId) => ({ userId: Q_EXTERNAL_2, projectId })) as any
  );
}

export async function destroySecondExternalCaller(): Promise<void> {
  // Los permisos PRIMERO: `user_project_permissions.user_id` referencia `users.id`.
  await UserProjectPermission.destroy({ where: { userId: Q_EXTERNAL_2 } });
  await User.destroy({ where: { id: Q_EXTERNAL_2 } });
}

/** Suscripciones a una tarea. */
export async function subscribeToTask(objectiveId: number, userId: string): Promise<void> {
  await ObjectiveSubscriptor.create({ objectiveId, userId } as any);
}

/** Suscripciones a un requisito, en la tabla SINGULAR. */
export async function subscribeToRequirement(
  requirementId: number,
  userId: string
): Promise<void> {
  await RequirementSubscriptor.create({ requirementId, userId } as any);
}

/** Borra lo que crea este módulo, en orden inverso a las FK. */
export async function destroyActivityWorld(): Promise<void> {
  await Attachment.destroy({ where: {} });
  await File.destroy({ where: {} });
  await ObjectiveActivity.destroy({ where: {} });
  await RequirementActivity.destroy({ where: {} });
  await ObjectiveSubscriptor.destroy({ where: {} });
  await RequirementSubscriptor.destroy({ where: {} });
  await Objective.destroy({ where: {} });
}
