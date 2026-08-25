import { Attachment, File } from '@jiku/models';
import { sequelize } from '../../src/models';
import { CREATOR, PROJECT_MAIN, PROJECT_OTHER, Q_EXTERNAL } from './task-fixtures';
import {
  CA_INTERNAL,
  CA_MAIN,
  CR_MAIN,
  Q_EXTERNAL_2,
  TASK_FOREIGN,
  TASK_INTERNAL,
  TASK_MAIN,
} from './activity-fixtures';
import { REQ_INTERNAL, REQ_VISIBLE } from './domain-fixtures';

/**
 * EL MUNDO DE ARCHIVOS Y VÍNCULOS (S-027).
 *
 * ES EL MUNDO CON MÁS RAMAS DEL CONTRATO, y no por gusto: el recorte de `files.get` tiene DOS
 * ramas y la segunda es NEGATIVA (`NOT EXISTS`), así que hacen falta cuatro archivos que se
 * distinguen SOLO por si tienen vínculo vivo y por quién los subió. Con tres, uno de los cuatro
 * casos no se prueba y el que falta es siempre el mismo: el archivo con vínculo vivo a una entidad
 * ajena SUBIDO POR EL CALLER, que es el que distingue este recorte de un `orSelfColumn` copiado.
 *
 * LOS CINCO TIPOS DE ENTIDAD ESTÁN LOS CINCO, cada uno con su par visible / no visible: es la
 * única forma de verificar que las cinco ramas del recorte polimórfico se emitieron y ninguna
 * quedó siempre-verdadera.
 *
 * REUSA `task-fixtures.ts` (proyectos, creador, callers), `activity-fixtures.ts` (la matriz del
 * recorte de tareas y los comentarios de las dos tablas) y `domain-fixtures.ts` (los requisitos).
 * Acá se agrega SOLO lo que los dos recursos nuevos necesitan.
 *
 * LA ESCRITURA VA POR LA CONEXIÓN DE ESCRITURA con los modelos de `@jiku/models`; la LECTURA bajo
 * test va por `readDb` con SQL explícito. Esa asimetría es lo que hace que el test valga.
 *
 * `Attachment` NO TIENE `uploadedBy` (H-1 del plan): la titularidad es del ARCHIVO. El fixture de
 * S-025 lo pasa con un `as any` y Sequelize lo descarta EN SILENCIO, que es lo que induce a creer
 * que la columna existe. Acá no se pasa.
 */

/* --------------------------------------------------------------------------------------------
 * LOS VÍNCULOS — ids EXPLÍCITOS para poder afirmar sobre ellos
 * ------------------------------------------------------------------------------------------ */

/** `project` sobre `PROJECT_MAIN` (permitido): la rama de proyecto del recorte. */
export const LINK_PROJECT = 6001;
/** `project` sobre `PROJECT_OTHER` (SIN permiso): la misma rama, del lado que no pasa. */
export const LINK_PROJECT_FOREIGN = 6002;
/** `requirement` público en proyecto permitido. */
export const LINK_REQUIREMENT = 6003;
/** `requirement` INTERNO en proyecto permitido: la visibilidad de la entidad dueña. */
export const LINK_REQ_INTERNAL = 6004;
/** `objective` (contrato: `task`) público y permitido. */
export const LINK_TASK = 6005;
/** `objective` de la tarea INTERNA: permitida pero no visible. */
export const LINK_TASK_INTERNAL = 6006;
/** `objective` de la tarea de OTRO proyecto. */
export const LINK_TASK_FOREIGN = 6007;
/** `objective_comment` (contrato: `task_comment`) de un comentario PÚBLICO. */
export const LINK_TASK_COMMENT = 6008;
/** `objective_comment` de un comentario INTERNO de una tarea PÚBLICA: las DOS visibilidades. */
export const LINK_TASK_COMMENT_INTERNAL = 6009;
/** `requirement_comment` del comentario del requisito. */
export const LINK_REQ_COMMENT = 6010;
/** CA-5 · el vínculo BORRADO: `deleted_at` no nulo. */
export const LINK_DELETED = 6011;
/** CA-5 · el vínculo vivo a un archivo NO RETENIDO. */
export const LINK_TO_PURGED = 6012;
/** H-5 · la fila LEGADO con `entity_type = 'comment'`: no aparece nunca. */
export const LINK_LEGACY = 6013;
/** El ÚNICO vínculo de `FILE_UNLINKED_AGAIN`, borrado: lo devuelve a la rama huérfana. */
export const LINK_UNLINKED = 6014;
/** El EMPATE de `created_at` con `LINK_TASK`: el desempate por `id` tiene que ser ASC. */
export const LINK_TASK_TIE = 6015;

/**
 * Los cuatro vínculos vivos de `TASK_MAIN`, EN EL ORDEN POR DEFECTO (`createdAt` ASC, `id` ASC).
 *
 * `LINK_TASK` y `LINK_TASK_TIE` COMPARTEN `created_at`: sin el empate, el test "está ordenado"
 * pasa con o sin la clave de desempate, y el keyset se saltea filas en producción sin que nadie
 * lo note.
 */
export const TASK_MAIN_LINKS_IN_ORDER = [LINK_TASK, LINK_TASK_TIE];

/* --------------------------------------------------------------------------------------------
 * LOS ARCHIVOS — ids por ACCESOR: `files.id` es autoincremental
 * ------------------------------------------------------------------------------------------ */

/** El archivo con vínculos vivos sobre las cinco entidades. `checksum` de 64 caracteres. */
export const FILE_LINKED_NAME = 'vinculado.pdf';
/** CA-11 caso A: SIN ningún vínculo, subido por el propio caller externo. */
export const FILE_ORPHAN_MINE_NAME = 'huerfano-mio.pdf';
/** CA-11 caso B: SIN ningún vínculo, subido por OTRO. */
export const FILE_ORPHAN_THEIRS_NAME = 'huerfano-ajeno.pdf';
/** H-4: vínculo VIVO a una entidad ajena Y subido por el caller. La rama (B) NO aplica. */
export const FILE_ONLY_FOREIGN_NAME = 'solo-ajeno.pdf';
/** Su único vínculo tiene `deleted_at`: vuelve a la rama (B). */
export const FILE_UNLINKED_AGAIN_NAME = 'desvinculado.pdf';
/** CA-10: `retention_status = 'purged'`. */
export const FILE_PURGED_NAME = 'purgado.pdf';
/** Vínculo vivo a `TASK_INTERNAL`: permitida pero interna. */
export const FILE_INTERNAL_TASK_NAME = 'de-tarea-interna.pdf';

/** El `checksum` del único archivo que lo declara. Los demás lo tienen en NULL a propósito. */
export const FILE_LINKED_CHECKSUM = 'a'.repeat(64);

const ids: Record<string, number> = {};

export function getLinkedFileId(): number {
  return ids[FILE_LINKED_NAME];
}
export function getOrphanMineFileId(): number {
  return ids[FILE_ORPHAN_MINE_NAME];
}
export function getOrphanTheirsFileId(): number {
  return ids[FILE_ORPHAN_THEIRS_NAME];
}
export function getOnlyForeignFileId(): number {
  return ids[FILE_ONLY_FOREIGN_NAME];
}
export function getUnlinkedAgainFileId(): number {
  return ids[FILE_UNLINKED_AGAIN_NAME];
}
export function getPurgedFileId(): number {
  return ids[FILE_PURGED_NAME];
}
export function getInternalTaskFileId(): number {
  return ids[FILE_INTERNAL_TASK_NAME];
}

interface FileSeed {
  name: string;
  uploadedBy: string;
  retentionStatus?: string;
  checksum?: string | null;
  byteStatus?: string;
}

const FILE_SEEDS: FileSeed[] = [
  { name: FILE_LINKED_NAME, uploadedBy: CREATOR, checksum: FILE_LINKED_CHECKSUM },
  { name: FILE_ORPHAN_MINE_NAME, uploadedBy: Q_EXTERNAL },
  { name: FILE_ORPHAN_THEIRS_NAME, uploadedBy: Q_EXTERNAL_2 },
  { name: FILE_ONLY_FOREIGN_NAME, uploadedBy: Q_EXTERNAL },
  { name: FILE_UNLINKED_AGAIN_NAME, uploadedBy: Q_EXTERNAL },
  { name: FILE_PURGED_NAME, uploadedBy: CREATOR, retentionStatus: 'purged' },
  { name: FILE_INTERNAL_TASK_NAME, uploadedBy: CREATOR },
];

/**
 * `created_at` POR SQL CRUDO: Sequelize pisa los timestamps al guardar, y el orden POR DEFECTO de
 * `attachments.list` es `createdAt` ASC. Sin control sobre esta columna, ni el test de orden ni el
 * de keyset prueban nada.
 */
async function pinCreatedAt(id: number, iso: string): Promise<void> {
  await sequelize.query('UPDATE attachments SET created_at = :ts WHERE id = :id', {
    replacements: { ts: iso, id },
  });
}

/** Los siete archivos y los quince vínculos. */
export async function createFileWorld(): Promise<void> {
  for (const seed of FILE_SEEDS) {
    const file: File = await File.create({
      fileName: seed.name,
      fileSize: 1024,
      mimeType: 'application/pdf',
      // `storage_*` EXISTEN EN LA BASE y son `NOT NULL`: lo que la story prohíbe es DEVOLVERLOS.
      // El fixture los escribe justamente para que los gates de CA-7 tengan algo que no filtrar.
      storageKey: `grava-gestion/f/${seed.name}`,
      storageBucket: 'test-bucket',
      storageRegion: 'us-east-1',
      checksum: seed.checksum ?? null,
      uploadedBy: seed.uploadedBy,
      byteStatus: seed.byteStatus ?? 'uploaded',
      retentionStatus: seed.retentionStatus ?? 'active',
    } as any);
    ids[seed.name] = file.id;
  }

  const linked = getLinkedFileId();

  await Attachment.bulkCreate([
    // LAS CINCO RAMAS DEL RECORTE, del lado VISIBLE.
    { id: LINK_PROJECT, entityType: 'project', entityId: PROJECT_MAIN, fileId: linked },
    { id: LINK_REQUIREMENT, entityType: 'requirement', entityId: REQ_VISIBLE, fileId: linked },
    { id: LINK_TASK, entityType: 'objective', entityId: TASK_MAIN, fileId: linked },
    { id: LINK_TASK_TIE, entityType: 'objective', entityId: TASK_MAIN, fileId: linked },
    { id: LINK_TASK_COMMENT, entityType: 'objective_comment', entityId: CA_MAIN, fileId: linked },
    { id: LINK_REQ_COMMENT, entityType: 'requirement_comment', entityId: CR_MAIN, fileId: linked },

    // …Y DEL LADO QUE NO PASA: proyecto sin permiso, entidad interna, comentario interno.
    { id: LINK_PROJECT_FOREIGN, entityType: 'project', entityId: PROJECT_OTHER, fileId: linked },
    { id: LINK_REQ_INTERNAL, entityType: 'requirement', entityId: REQ_INTERNAL, fileId: linked },
    {
      id: LINK_TASK_INTERNAL,
      entityType: 'objective',
      entityId: TASK_INTERNAL,
      fileId: getInternalTaskFileId(),
    },
    {
      id: LINK_TASK_FOREIGN,
      entityType: 'objective',
      entityId: TASK_FOREIGN,
      fileId: getOnlyForeignFileId(),
    },
    {
      id: LINK_TASK_COMMENT_INTERNAL,
      entityType: 'objective_comment',
      entityId: CA_INTERNAL,
      fileId: linked,
    },

    // CA-5 · LOS DOS QUE NO PUEDEN APARECER: el vínculo borrado y el archivo no retenido.
    {
      id: LINK_DELETED,
      entityType: 'objective',
      entityId: TASK_MAIN,
      fileId: linked,
      deletedAt: new Date('2026-07-01T00:00:00.000Z'),
    },
    {
      id: LINK_TO_PURGED,
      entityType: 'objective',
      entityId: TASK_MAIN,
      fileId: getPurgedFileId(),
    },

    // H-5 · LA FILA LEGADO. `comment` no tiene traducción al contrato: no aparece bajo NINGÚN
    // `entityType` ni sin filtro. Es deny-by-default (ADR-008), no un bug.
    { id: LINK_LEGACY, entityType: 'comment', entityId: CA_MAIN, fileId: linked },

    // El ÚNICO vínculo de su archivo, BORRADO: el vínculo se borró, el archivo se retuvo.
    {
      id: LINK_UNLINKED,
      entityType: 'objective',
      entityId: TASK_MAIN,
      fileId: getUnlinkedAgainFileId(),
      deletedAt: new Date('2026-07-02T00:00:00.000Z'),
    },
  ] as any);

  // EL ORDEN POR DEFECTO ES `createdAt` ASC, y `LINK_TASK` / `LINK_TASK_TIE` EMPATAN: el desempate
  // por `id` ASC es lo único que hace determinista la página.
  await pinCreatedAt(LINK_PROJECT, '2026-01-01T00:00:00.000Z');
  await pinCreatedAt(LINK_REQUIREMENT, '2026-01-02T00:00:00.000Z');
  await pinCreatedAt(LINK_TASK, '2026-01-03T00:00:00.000Z');
  await pinCreatedAt(LINK_TASK_TIE, '2026-01-03T00:00:00.000Z');
  await pinCreatedAt(LINK_TASK_COMMENT, '2026-01-04T00:00:00.000Z');
  await pinCreatedAt(LINK_REQ_COMMENT, '2026-01-05T00:00:00.000Z');
  await pinCreatedAt(LINK_PROJECT_FOREIGN, '2026-01-06T00:00:00.000Z');
  await pinCreatedAt(LINK_REQ_INTERNAL, '2026-01-07T00:00:00.000Z');
  await pinCreatedAt(LINK_TASK_INTERNAL, '2026-01-08T00:00:00.000Z');
  await pinCreatedAt(LINK_TASK_FOREIGN, '2026-01-09T00:00:00.000Z');
  await pinCreatedAt(LINK_TASK_COMMENT_INTERNAL, '2026-01-10T00:00:00.000Z');
  await pinCreatedAt(LINK_DELETED, '2026-01-11T00:00:00.000Z');
  await pinCreatedAt(LINK_TO_PURGED, '2026-01-12T00:00:00.000Z');
  await pinCreatedAt(LINK_LEGACY, '2026-01-13T00:00:00.000Z');
  await pinCreatedAt(LINK_UNLINKED, '2026-01-14T00:00:00.000Z');
}

/**
 * Borra lo que crea este módulo, EN ORDEN INVERSO A LAS FK: `attachments` antes que `files`.
 *
 * `force: true` NO ES OPCIONAL: el hook `@BeforeDestroy requireForce` del modelo obliga a
 * escribir "sí, borrá la fila" en el call site — desvincular BORRA la fila (REQ-001).
 */
export async function destroyFileWorld(): Promise<void> {
  await Attachment.destroy({ where: {}, force: true });
  await File.destroy({ where: {} });
}
