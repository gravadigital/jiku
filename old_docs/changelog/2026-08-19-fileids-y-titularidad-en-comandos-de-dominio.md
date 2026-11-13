# `fileIds` y titularidad en los comandos de dominio

**Story:** S-003 · **Request:** REQ-001 · **Servicio:** `core` · **Fecha:** 2026-08-19

Los seis comandos de dominio que reciben archivos pasan de `attachmentIds` (borradores que se
reanclan) a `fileIds` (archivos que ya existen y se vinculan), y ganan una regla de **titularidad**
que antes no existía: solo se puede vincular un archivo que uno mismo subió.

## Cambio de contrato — los seis comandos

| Comando | Antes | Ahora |
|---|---|---|
| `requirements.new` | `attachmentIds` + `attachmentScope` | **`fileIds`**; `attachmentScope` **eliminado** |
| `requirements.{id}.edit` | `attachmentIds` (conjunto completo, sobre drafts) | **`fileIds`** (conjunto completo, sobre el vínculo) |
| `requirements.{id}.comment` | `attachmentIds` | **`fileIds`** |
| `tasks.new` | *(no recibía archivos)* | **`fileIds` — funcionalidad NUEVA** |
| `tasks.{id}.edit` | *(no recibía archivos)* | **`fileIds` — funcionalidad NUEVA** |
| `tasks.{id}.comment` | `attachmentIds` | **`fileIds`** |

`attachmentScope` **no tiene sustituto**: existía solo para elegir el anclaje del borrador, y no hay
borrador. El tope de **10 archivos** deja de ser un límite de transporte de `multer` y pasa a ser
**regla de dominio** en el contrato del bus, validada por Joi (D-20).

### Códigos de error

- Los seis mensajes **suman `file_not_owned`** (→ **403**) en sus `x-error-codes`.
- Los seis **pierden `invalid_attachment_id`**: un `fileId` inexistente o retirado cae en
  `invalid_fields` (→ 400). La distinción 400 / 403 es deliberada — hacer indistinguible *"el
  archivo no existe"* de *"el archivo no es tuyo"* borraría la regla nueva.
- `invalid_attachment_id` **se conserva** en el enum global de `docs/apis/core.yaml` y en
  `@jiku/nats-protocol`, anotado como **código sin emisor**. El paquete es compartido (ADR-005) y
  ningún criterio de aceptación pide retirarlo.

> **La `api` todavía manda `attachmentIds`.** Entre esta story y **S-004**, un `attachmentIds`
> enviado por la api es **rechazado por Joi como campo desconocido**. Es el orden que la story
> declara (*"Habilita la Story 4"*) y el comportamiento esperado en ese intervalo. Ver
> "Qué queda para S-004" al final.

## Titularidad: `resolveActor` compartido

`resolveActor` **se movió** de `core/src/commands/files/resolve-actor.ts` a
`core/src/commands/resolve-actor.ts`. Ahora la comparten **siete** comandos: `files.request-upload`
(que la trajo en S-002) y los seis de dominio. Dejarla bajo `files/` habría obligado a
`requirements/` y `tasks/` a importar del módulo de archivos.

**Que sea la misma función es el punto, no un detalle de organización:** si subir y vincular
resolvieran la identidad distinto, nadie podría vincular lo que subió.

La regla, uniforme para los dos canales:
`File.uploaded_by != resolveActor(ctx, payload)` → `failure(file_not_owned)`.

**Sin excepción por rol** (RF-13): `core` no conoce roles, así que la excepción no tiene dónde
escribirse — un administrador recibe el mismo `file_not_owned` que cualquier otro.

## Helper nuevo: `core/src/commands/link-files.ts`

Concentra la secuencia que los seis comandos repiten. Sin él, la regla de titularidad quedaría
escrita seis veces y **las seis podrían divergir**.

- `linkFiles(...)` — modo aditivo, para los comandos de creación.
- `syncFileLinks(...)` — semántica de **conjunto completo**, para los de edición: preserva la fila
  de los vínculos que siguen (mismo `id`, mismo `createdAt`) y borra los que ya no vienen.

**Orden de validación, obligatorio:** existencia → vida → titularidad. Es lo que hace que un archivo
inexistente responda `invalid_fields` (400) y no `file_not_owned` (403).

**Un `fileId` repetido en el mismo array se deduplica en silencio.** El vínculo es un conjunto: dos
filas idénticas no significarían nada distinto de una.

## Cambios en la base

Ninguna tabla se crea ni se altera. **No hay migraciones nuevas.** Lo que cambia es quién y cómo
escribe:

- `attachments`: pasa de `UPDATE ... SET entity_type, entity_id` (reanclaje del borrador) a
  **`INSERT INTO attachments (entity_type, entity_id, file_id)`** contra una entidad que ya existe.
- `files`: `UPDATE files SET byte_status = 'uploaded'` al vincular con éxito. **No verifica nada**
  contra el bucket: el cliente reportó el `PUT` y se le cree (D-13).
- **La desvinculación es un `DELETE` real**, no un `softDelete()`. `softDelete()` escribe
  `retention_status` y `deleted_at` sobre `attachments`, columnas que la migración `20260819_05` ya
  dropeó: funcionaba en los tests —donde `sync()` las recrea desde el modelo— y **habría fallado en
  producción**.

## Cambio en `@jiku/models` (paquete compartido)

**`Attachment.storageKey` pierde `unique: true`.**

Un `File` puede tener 0..N vínculos, y mientras esa columna siga existiendo en el modelo su valor se
copia del `File` en cada vínculo — con la unicidad puesta, el segundo vínculo del mismo archivo
chocaba contra ella.

No es un aflojamiento real: la migración `20260819_05` **ya dropeó `storage_key` de `attachments`**,
así que la restricción solo vivía en el esquema que `sequelize.sync()` construye para los tests. La
unicidad que sí importa, la de **`files.storage_key`**, sigue intacta. Ninguna ruta de la `api`
dependía de la otra.

Se actualizó en consecuencia el test `TS-19` de `api/tests/00-configurations/attachment-model.test.ts`,
que afirmaba lo contrario.

## Bloque transitorio con fecha de baja: **S-004 / S-005**

Al insertar el vínculo se **copian del `File` siete campos** (`fileName`, `fileSize`, `mimeType`,
`storageKey`, `storageBucket`, `storageRegion`, `uploadedBy`) que el modelo `Attachment` todavía
declara `NOT NULL`.

**Por qué:** las rutas de adjuntos de la `api` (`attachments-preview`, `-download`, `-delete`,
`opus-attachments-*`) las leen y escriben hasta S-004/S-005. La migración ya las dropeó en
producción, pero el esquema de **tests** lo construye `sync()` desde el modelo (ADR-013), así que
ahí siguen siendo obligatorias.

**No se resolvió aflojando el modelo:** `@jiku/models` es compartido y aflojarlo rompería la `api`
en una story que no declara tocarla. La copia es fea a propósito y lleva su comentario de baja en el
código: **cuando S-004/S-005 reduzcan el modelo, ese bloque se borra entero.**

## Qué queda para S-004

- **20 tests de la `api` fallan al cerrar esta story, y es esperado.** Ejercitan el flujo de
  borradores que S-003 eliminó (reanclaje, `invalid_attachment_id`, `attachmentScope`) contra un
  `core` que ya habla el contrato nuevo — el `FakeBus` lo ejecuta de verdad (ADR-013). Están en:
  `tests/routes/requirements-post.test.ts`, `requirements-id-patch.test.ts`,
  `opus-requirements-post.test.ts`, `opus-requirements-id-comments-post.test.ts` y los de
  comentarios de requisitos. **Los arregla S-004**, cuando la `api` deje de mandar `attachmentIds`.
- El **mapa `file_not_owned` → 403** en `api/lib/utils/bus/protocol.ts`. Sin él, un `file_not_owned`
  cae en 500 en la api: correcto y esperado en el intervalo entre las dos stories.
- El comando **`attachments.{id}.delete`** (la desvinculación como comando del bus).
- **Reducir el modelo `Attachment`** y borrar el bloque transitorio de copia de campos.
