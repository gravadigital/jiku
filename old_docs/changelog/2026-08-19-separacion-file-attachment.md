# Separación de `File` y `Attachment` — procedimiento de despliegue

**Story:** S-001 · **Request:** REQ-001 · **Fecha:** 2026-08-19

Las cinco migraciones de S-001 **se despliegan en dos releases**, con una verificación humana
en el medio. Este documento es el procedimiento que quien opere el despliegue tiene que seguir.

## Por qué dos releases

`npm start` corre **todas** las migraciones pendientes de un tirón. Si las cinco se despliegan
juntas, el paso 4 y el paso 5 corren en el mismo arranque, el operador nunca ve los conteos, y
la reversibilidad de las migraciones 1-4 no sirve de nada: para cuando alguien mire el log, el
punto de no retorno ya pasó.

| Release | Migraciones | Carácter |
|---|---|---|
| **1ª** | `20260819_01` a `20260819_04` | Aditivas y **reversibles**. Ningún servicio cambia de comportamiento |
| **2ª** | `20260819_05` | Destructiva. **Punto de no retorno** |

`20260819_05_harden_attachments_schema.js` **no se mergea a la rama de despliegue** hasta que la
verificación de los conteos esté hecha y aceptada.

## Paso a paso

1. Desplegar la 1ª release. Las migraciones 1-4 corren al arrancar la `api`.
2. Leer del log las **siete líneas** con prefijo `[20260819_04]` (ver la tabla de abajo).
3. Decidir: avanzar a la 2ª release, o revertir y corregir.
4. Si se avanza: desplegar la 2ª release.
5. Confirmar que la `api` arranca y que los endpoints de adjuntos siguen respondiendo igual —
   esta story **no cambia el comportamiento de ningún servicio**.

## Los siete conteos y qué significa cada uno

| Conteo | Qué se espera | Si sale distinto |
|---|---|---|
| `drafts sin entity_id borrados` | Un número acorde al uso del patrón draft | Si es 0, sospechar: el patrón draft se usa hoy |
| `stage recuperados` | Bajo; la tabla `stages` se borró en `20260808_01` | Si es alto, revisar cuántos archivos se estaban perdiendo |
| `comment -> requirement_comment` | Posiblemente 0 | Si >0, `20260729_01` quedó a medias como se sospechaba |
| `comment -> objective_comment` | Posiblemente 0 | Idem |
| `comment irresolubles borrados` | **0 idealmente** | Si >0, son vínculos que se pierden: confirmar uno por uno antes de avanzar |
| `drafts normalizados` | Bajo | Si es alto, revisar el mapeo `comment_draft` → `objective_comment` |
| `comment ambiguos` | **0 obligatoriamente** | Si >0, **revertir**: el mapeo resolvió por orden, no por criterio |

### Criterio de decisión, explícito

Avanzar al paso 5 **solo si** `comment ambiguos` es `0` **y** los irresolubles fueron revisados
uno por uno. Cualquier otra cosa → revertir 1-4, corregir `20260819_04`, repetir.

Verificar además, antes de avanzar:

```sql
SELECT count(*) FROM attachments WHERE entity_id IS NULL;  -- tiene que dar 0
SELECT count(*) FROM attachments WHERE file_id  IS NULL;   -- tiene que dar 0
```

Si alguno no da 0, `20260819_05` **falla a propósito** con un mensaje que nombra la cantidad, y
la `api` no arranca. Es el comportamiento correcto, preferible a endurecer sobre datos sin
resolver.

## Rollback

```sh
# Revierte 20260819_04, _03, _02 y _01, en ese orden. Una invocación por migración.
npx sequelize-cli db:migrate:undo --config ./db-upgrade/config.js --migrations-path ./db-upgrade/migrations/
```

- **Los pasos 1-4 revierten el ESQUEMA al punto de partida**: `files` desaparece, el tipo
  `file_byte_status` desaparece, `attachments.file_id` desaparece.
- **El `down` de `20260819_04` es un no-op de datos**: las filas borradas no vuelven y los
  `entity_type` normalizados no se distinguen de los que ya estaban en su tipo concreto. Por eso
  el ensayo del procedimiento se hace **sobre una copia de producción**, no sobre producción.
- **El paso 5 NO es reversible.** Recrear las 10 columnas dejaría las filas borradas en el paso 4
  sin restaurar, y los datos que vivían en ellas ya migraron a `files`. Su `down` es un no-op
  documentado.

## Ninguna migración toca el bucket

**Ninguna de las cinco migraciones instancia un cliente S3.** Las `storage_key` existentes se
copian tal cual, con su patrón viejo; ningún objeto se mueve ni se renombra. Es exactamente lo
que hace que todo este procedimiento sea reversible por SQL.

---

# Revisión campo por campo modelo ↔ migración (Tarea 7)

Ejecutada el 2026-08-19 sobre una base **construida por las migraciones**, no por `sync()`.
Esta revisión existe porque **los tests no cubren lo que verifica**: ADR-013 hace que la suite
corra contra el esquema de `sequelize.sync()`, así que un desalineo entre el modelo y la
migración pasa todos los tests y aparece recién en producción.

## Resultado: las 14 columnas de `files` coinciden

`information_schema.columns` de una base migrada, contrastado contra los decoradores de
`packages/models/src/file.model.ts`:

| Columna | Tipo en la base | Longitud | Nullable | Default | Modelo |
|---|---|---|---|---|---|
| `id` | integer | — | NO | `nextval` | ✔ `INTEGER` PK autoincrement |
| `file_name` | varchar | 255 | NO | — | ✔ `STRING(255)` |
| `file_size` | integer | — | NO | — | ✔ `INTEGER`, sin `validate` |
| `mime_type` | varchar | 100 | NO | — | ✔ `STRING(100)` |
| `storage_key` | varchar | 500 | NO | — | ✔ `STRING(500)` unique |
| `storage_bucket` | varchar | 100 | NO | — | ✔ `STRING(100)` |
| `storage_region` | varchar | 50 | NO | — | ✔ `STRING(50)` |
| `checksum` | varchar | 64 | YES | — | ✔ `STRING(64)` nullable |
| `byte_status` | `file_byte_status` | — | NO | `'pending'` | ✔ `STRING`, default `ByteStatus.Pending` |
| `uploaded_by` | varchar | 100 | NO | — | ✔ `STRING(100)` + FK |
| `retention_status` | `retention_status` | — | NO | `'active'` | ✔ `STRING`, default `RetentionStatus.Active` |
| `deleted_at` | timestamptz | — | YES | — | ✔ `DATE` nullable |
| `deleted_by` | varchar | 100 | YES | — | ✔ `STRING(100)` + FK |
| `created_at` | timestamptz | — | NO | `CURRENT_TIMESTAMP` | ✔ `timestamps: true` |
| `updated_at` | timestamptz | — | NO | `CURRENT_TIMESTAMP` | ✔ `timestamps: true` |

**Índices:** `files_storage_key_key` (UNIQUE sobre `storage_key`) e
`idx_files_uploader_byte_status` sobre `(uploaded_by, byte_status)`. Coinciden con lo declarado.

**FK:** `uploaded_by → users(id) ON UPDATE CASCADE ON DELETE RESTRICT` y
`deleted_by → users(id) ON UPDATE CASCADE ON DELETE SET NULL`. Coinciden.

**`attachments` tras el endurecimiento:** 8 columnas (`id`, `entity_type`, `entity_id`,
`file_id`, `deleted_at`, `deleted_by`, `created_at`, `updated_at`), FK `fk_attachments_file`
presente, `check_attachments_active_status` eliminada, `idx_attachments_file_id` sobreviviente
e `idx_attachments_uploader` borrado en cascada con su columna, como se esperaba.

## Divergencias encontradas, y qué se decidió

| # | Divergencia | Decisión |
|---|---|---|
| 1 | `byteStatus` y `retentionStatus` son `DataType.STRING` en el modelo y ENUM nativo en la migración | **Aceptada y deliberada.** Declararlos `ENUM` haría que `sync()` cree tipos con la convención de Sequelize (`enum_files_byte_status`), distintos de los que la migración crea (`file_byte_status`), agravando la divergencia que esta story tiene que vigilar. Es el mismo criterio que `Attachment` ya aplica a `entityType` |
| 2 | `attachments.retention_status` es ENUM nativo en producción y `varchar` en el esquema de `sync()` | **Preexistente, no la introduce esta story.** Obligó a un cast explícito en el backfill (ver abajo) |
| 3 | `fileSize` sin `validate` en el modelo y sin CHECK en la base | **Coinciden en no restringir**, que es lo buscado: el tope pasa a ser configurable por `file-max-size-bytes` |

## Dos correcciones que la verificación destapó

Ninguna de las dos habría sido detectada por los tests, y las dos habrían roto la migración en
producción:

1. **Los nombres de las tablas de actividad.** `20260819_04` consultaba
   `objective_activities` / `requirement_activities` (plural). Las tablas reales son
   **`objective_activity` / `requirement_activity`** (singular), según
   `packages/models/src/*-activity.model.ts`. Con el nombre en plural la migración fallaba con
   `relation does not exist` en cuanto hubiera una fila `comment` legado. **Corregido.**

2. **El cast de `retention_status` en el backfill.** `files.retention_status` es ENUM nativo y
   el origen puede ser ENUM (producción) o `varchar` (esquema de `sync()`). El
   `INSERT ... SELECT` fallaba con *"column is of type retention_status but expression is of
   type character varying"*. Se agregó `retention_status::text::retention_status` y
   `'uploaded'::file_byte_status`, que funcionan bajo las dos formas. **Corregido.**
