import { Attachment, AttachmentEntityType, ByteStatus, File, RetentionStatus } from '@jiku/models';
import { ErrorCode, Reply, failure } from '@jiku/nats-protocol';
import { CommandContext } from './types';

/**
 * La vinculación de archivos a una entidad de dominio, compartida por los SEIS comandos que
 * reciben `fileIds` (`requirements.new`, `requirements.{id}.edit`, `requirements.{id}.comment`,
 * `tasks.new`, `tasks.{id}.edit`, `tasks.{id}.comment`).
 *
 * POR QUÉ ES UN HELPER Y NO SEIS COPIAS: la regla de titularidad es la garantía nueva del
 * REQ-001. Escrita seis veces, las seis pueden divergir —que es exactamente el modo de fallo que
 * el docstring de `resolveActor` describe para la identidad—. Acá vive una sola vez.
 *
 * NO ES UNA CAPA DE REPOSITORIO NI DE SERVICIO (que la convención `commands` prohíbe): es un
 * helper de módulo, del mismo tipo que `pickPresent`, `validateWith`, `resolvePriority` o
 * `activityVisibilityLevel`, que ya existen y son el patrón del codebase. Función pura más
 * llamadas a modelo, sin clase ni estado.
 *
 * NO ABRE NI CIERRA TRANSACCIÓN y no lanza para señalar un error esperado (ADR-003): recibe la
 * del despachador por `ctx` y devuelve un `Reply` de falla que el comando retorna tal cual. El
 * rollback del despachador es lo que garantiza que la entidad y sus vínculos queden juntos o
 * ninguno (CA-4).
 *
 * RECIBE EL ACTOR YA RESUELTO, no el campo crudo del payload. Los seis comandos llamadores
 * resuelven `resolveActor(ctx, payload.creator/author/editor, component)` UNA SOLA VEZ, arriba
 * de `execute()`, para usarlo también en `createdBy`/`changedBy` de la entidad. Si este helper
 * volviera a llamar a `resolveActor` con el campo crudo, la rama externa —la que loguea `warn`—
 * se ejecutaría DOS VECES por comando: una en el llamador, otra acá. `resolveActor` es pura y da
 * el mismo resultado las dos veces, pero el log no es puro.
 */

/** Los parámetros comunes a los dos modos. */
interface LinkFilesParams {
  /** Los ids de `files` a vincular. El tope de 10 lo impone Joi en cada comando (D-20). */
  fileIds: number[];
  /** El actor YA RESUELTO por el comando llamador (`resolveActor`), no el campo crudo. */
  actor: string;
  entityType: AttachmentEntityType;
  entityId: number;
  ctx: CommandContext;
}

/**
 * Vincula `fileIds` a una entidad que YA EXISTE. Modo aditivo: no toca los vínculos previos.
 *
 * Lo usan los comandos de creación, donde por definición no hay vínculos previos.
 *
 * @returns `null` si vinculó bien, o el `Reply` de falla que el comando debe retornar.
 */
export async function linkFiles(params: LinkFilesParams): Promise<Reply<never> | null> {
  const { fileIds, actor, entityType, entityId, ctx } = params;

  if (fileIds.length === 0) {
    return null;
  }

  // Un mismo `fileId` repetido en el array se DEDUPLICA en silencio en vez de rechazarse.
  // Por qué: el resultado que el cliente pide —"que este archivo quede vinculado"— se cumple
  // igual, y un `invalid_fields` por un duplicado sería un fallo por una redundancia inocua.
  // El vínculo es un conjunto, no una lista: dos filas idénticas no significarían nada
  // distinto de una. (CA-3 / TS-38)
  const uniqueIds = [...new Set(fileIds)];

  const validated = await validateFiles(uniqueIds, actor, ctx);
  if ('error' in validated) {
    return validated.error;
  }

  await markUploadedAndLink(validated.files, entityType, entityId, ctx);
  return null;
}

/**
 * Deja vinculado a la entidad EXACTAMENTE el conjunto `fileIds`, ni más ni menos.
 *
 * Es la semántica de "conjunto completo" que declaran `requirements.{id}.edit` y
 * `tasks.{id}.edit`: los que no estaban se vinculan, los que ya no vienen pierden el vínculo.
 * OPERA SOBRE EL VÍNCULO, NUNCA SOBRE EL ARCHIVO (D-04): borrar un vínculo jamás borra el
 * `File`, porque un archivo puede tener 0..N vínculos y llevárselo rompería los otros.
 *
 * @returns `null` si sincronizó bien, o el `Reply` de falla que el comando debe retornar.
 */
export async function syncFileLinks(params: LinkFilesParams): Promise<Reply<never> | null> {
  const { fileIds, actor, entityType, entityId, ctx } = params;

  const uniqueIds = [...new Set(fileIds)];

  const existing = await Attachment.findAll({
    where: { entityType, entityId },
    transaction: ctx.transaction,
  });
  const existingByFileId = new Map<number, Attachment>();
  for (const attachment of existing) {
    if (attachment.fileId !== null) {
      existingByFileId.set(attachment.fileId, attachment);
    }
  }

  // La titularidad se valida SOLO sobre los `fileId` NUEVOS del conjunto. Es una decisión, no
  // un olvido: los que ya estaban vinculados pasaron por esta misma validación cuando se
  // vincularon, y revalidarlos no agrega garantía —el `uploaded_by` de un `File` no cambia—
  // pero sí haría que una edición ajena fallara sobre vínculos que el editor no está tocando.
  const toValidate = uniqueIds.filter((id) => !existingByFileId.has(id));

  const validated = await validateFiles(toValidate, actor, ctx);
  if ('error' in validated) {
    return validated.error;
  }

  // Los vínculos que YA ESTABAN y siguen en el conjunto conservan su fila: mismo `id`, mismo
  // `createdAt`. Es el patrón que la convención `commands` recomienda para código nuevo
  // (el de `tasks-edit.ts` con `responsiblePersonIds`): preservar la fila es información que
  // no cuesta nada conservar.
  // Los vínculos con `fileId` null se tratan como "ya no declarados" y se borran. En producción
  // ese caso NO EXISTE: la migración 20260819_05 puso `file_id` en NOT NULL, y aborta si queda
  // alguna fila sin él. El modelo todavía lo declara nullable porque la columna nació así en la
  // 20260819_02, así que la rama se escribe explícita en vez de dejar que `includes(null)`
  // decida por accidente.
  const toRemove = existing.filter(
    (attachment) => attachment.fileId === null || !uniqueIds.includes(attachment.fileId)
  );

  if (toRemove.length > 0) {
    // DELETE REAL, no `softDelete()`. `softDelete()` escribe `retentionStatus` y `deletedAt`
    // sobre `attachments`, y la migración 20260819_05 ya dropeó `retention_status` de esa
    // tabla: el ciclo de retención vive ahora en `files.retention_status` (D-04). Seguir
    // usándolo funcionaría en los tests —donde `sequelize.sync()` recrea la columna desde el
    // modelo— y fallaría en producción. Desvincular es borrar la fila.
    //
    // `force: true` es obligatorio: el hook `@BeforeDestroy` del modelo lanza sin él.
    await Attachment.destroy({
      where: { id: toRemove.map((attachment) => attachment.id) },
      force: true,
      transaction: ctx.transaction,
    });
  }

  await markUploadedAndLink(validated.files, entityType, entityId, ctx);
  return null;
}

/**
 * Valida los archivos referenciados contra el actor YA RESUELTO, EN ESTE ORDEN:
 *
 *   1. existencia   -> `invalid_fields`  (400)
 *   2. vida         -> `invalid_fields`  (400)
 *   3. titularidad  -> `file_not_owned`  (403)
 *
 * EL ORDEN ES OBLIGATORIO Y NO ES ARBITRARIO (CA-11): existencia y vida se chequean ANTES que
 * titularidad, para que un archivo inexistente responda `invalid_fields` y no `file_not_owned`.
 * Colapsarlos borraría la distinción entre "ese archivo no está" (400) y "ese archivo no es
 * tuyo" (403), que es la regla nueva del REQ.
 *
 * Por lo mismo, la lectura NO filtra por `retentionStatus` en el `where`: un `findAll` con
 * `where: { retentionStatus: Active }` haría indistinguible "no existe" de "existe pero está
 * retirado". Se lee sin filtrar y se valida en memoria.
 */
async function validateFiles(
  fileIds: number[],
  actor: string,
  ctx: CommandContext
): Promise<{ files: File[] } | { error: Reply<never> }> {
  if (fileIds.length === 0) {
    return { files: [] };
  }

  // Un solo `findAll` por PK, no un `findByPk` por archivo: con el tope de 10 el peor caso es
  // una consulta de 10 filas, y N consultas dentro de la transacción del despachador suman
  // round-trips que ADR-002 desaconseja por el timeout de 5000 ms.
  const found = await File.findAll({
    where: { id: fileIds },
    transaction: ctx.transaction,
  });
  const byId = new Map(found.map((file) => [file.id, file]));

  // 1. Existencia. El mensaje no lleva el `fileId`: la convención `error-handling` prohíbe
  //    poner datos internos en el mensaje de error.
  if (found.length !== fileIds.length) {
    return {
      error: failure(ErrorCode.INVALID_FIELDS, 'Alguno de los archivos no existe'),
    };
  }

  // 2. Vida.
  const retired = found.some((file) => file.retentionStatus !== RetentionStatus.Active);
  if (retired) {
    return {
      error: failure(ErrorCode.INVALID_FIELDS, 'Alguno de los archivos ya no está disponible'),
    };
  }

  // 3. Titularidad (RF-12). SIN EXCEPCIÓN POR ROL (RF-13, CA-10): `core` no conoce roles, así
  //    que no hay dónde escribir la excepción ni siquiera si se quisiera. Un administrador
  //    recibe exactamente el mismo `file_not_owned` que cualquier otro.
  const foreign = found.some((file) => file.uploadedBy !== actor);
  if (foreign) {
    return {
      error: failure(
        ErrorCode.FILE_NOT_OWNED,
        'Solo se pueden vincular archivos subidos por uno mismo'
      ),
    };
  }

  // Se devuelve en el orden de `fileIds` y no en el que la base los trajo: ningún CA lo exige,
  // pero deja los tests deterministas.
  return { files: fileIds.map((id) => byId.get(id) as File) };
}

/**
 * Marca los bytes como subidos y crea una fila de `attachments` por archivo.
 *
 * El `UPDATE` de `byte_status` NO VERIFICA NADA contra el bucket: el cliente reportó el PUT y
 * se le cree (D-13). El modo de fallo de un byte que no llegó aparece al leer, con
 * `file_not_available` (S-005), no acá. Es idempotente: un archivo ya `uploaded` que se
 * vincula de nuevo sigue `uploaded`, sin error.
 */
async function markUploadedAndLink(
  files: File[],
  entityType: AttachmentEntityType,
  entityId: number,
  ctx: CommandContext
): Promise<void> {
  if (files.length === 0) {
    return;
  }

  // Un solo `UPDATE ... WHERE id IN (...)`, no uno por archivo.
  await File.update(
    { byteStatus: ByteStatus.Uploaded },
    { where: { id: files.map((file) => file.id) }, transaction: ctx.transaction }
  );

  // El vínculo guarda SOLO el par polimórfico y el `file_id`. Los metadatos del archivo
  // (nombre, tamaño, mime, clave de storage, quién lo subió) viven en `files` y se leen por el
  // `include`: la 20260819_05 dropeó esas columnas de `attachments` justamente para que no
  // hubiera dos copias que pudieran divergir.
  for (const file of files) {
    await Attachment.create(
      {
        entityType,
        entityId,
        fileId: file.id,
      },
      { transaction: ctx.transaction }
    );
  }
}
