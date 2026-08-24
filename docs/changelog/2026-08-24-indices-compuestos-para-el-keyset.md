# Los índices compuestos que el keyset necesita — la migración y su verificación

**Story:** S-021 · **Request:** REQ-006 · **Fecha:** 2026-08-24

`api/db-upgrade/migrations/20260824_02_query_indexes.js` crea los 18 índices que la paginación
keyset del contrato de consultas necesita. Es **puramente aditiva** —solo `CREATE INDEX`— y no toca
una sola línea de `api/lib/`. El diff completo de `api/` son **dos archivos nuevos**: la migración y
su test.

Esta entrada publica lo que **no tiene herramienta**: las verificaciones contra una base migrada,
los tamaños medidos que sostienen la decisión de `CONCURRENTLY`, y dos hallazgos del catálogo real
que el diseño de la story no había relevado y que **cambiaron la migración**.

---

## Por qué esta entrada existe

RF-10 de REQ-006 declara un campo ordenable **solo si tiene índice compuesto terminado en `id`**,
porque es lo que hace resoluble la página siguiente con `WHERE (sort…, id) > (k…)`. Sin el índice,
cada página degrada a `Seq Scan` + `Sort` y el `statement_timeout` de 8000 ms de la conexión de solo
lectura empieza a devolver `query_timeout` bajo carga normal. **No es una optimización: es la
precondición** de que el contrato pueda declarar esos campos.

Pero el test automatizado no puede cerrar toda la story. El esquema de la suite de `api` lo
construye `sequelize.sync()`, no las migraciones (ADR-013, su límite declarado), así que en esa base
**no existe ninguno de los índices preexistentes** — los creó otra migración y `sync()` no los
reproduce. Todo lo que dependa de ellos se verifica a mano, y su evidencia va acá.

---

## Los 18 índices y qué sostiene cada uno

| # | Tabla | Índice | Columnas | Qué sostiene |
|---|---|---|---|---|
| 1 | `objectives` | `idx_objectives_project_created_id` | `(project_id, created_at DESC, id DESC)` | `tasks.list` por proyecto, sort default `["-createdAt"]` |
| 2 | `objectives` | `idx_objectives_priority_created_id` | `(priority DESC, created_at DESC, id DESC)` | `sort: ["-priority", …]` |
| 3 | `objectives` | `idx_objectives_state_created_id` | `(state, created_at DESC, id DESC)` | `filter.state` + sort default |
| 4 | `requirements` | `idx_requirements_project_created_id` | `(project_id, created_at DESC, id DESC)` | `requirements.list` por proyecto |
| 5 | `requirements` | `idx_requirements_state_created_id` | `(state, created_at DESC, id DESC)` | `filter.state` + sort default |
| 6 | `requirements` | `idx_requirements_tags_gin` | **GIN** `(tags)` | filtro `tag` por par exacto (RF-7) y `requirements.tags` de S-028 |
| 7 | `objective_activity` | `idx_objective_activity_entity_type_created_id` | `(objective_id, type_of_activity, created_at, id)` | `comments.list` y `activity.list` |
| 8 | `requirement_activity` | `idx_requirement_activity_entity_type_created_id` | `(requirement_id, type_of_activity, created_at, id)` | el mismo del otro lado |
| 9 | `people_objectives` | `idx_people_objectives_person_objective` | `(person_id, objective_id)` | `filter.responsiblePersonId` de `tasks` |
| 10 | `people_requirements` | `idx_people_requirements_person_requirement` | `(person_id, requirement_id)` | `filter.responsiblePersonId` de `requirements` |
| 11 | `projects` | `idx_projects_client_name_id` | `(client_id, name, id)` | `projects.list` + `filter.clientId` con sort por `name` |
| 12 | `worked_times` | `idx_worked_times_person_date_id` | `(person_id, "date" DESC, id DESC)` | `worked-times.list`, sort default `["-date"]` |
| 13 | `worked_times` | `idx_worked_times_project_date_id` | `(project_id, "date" DESC, id DESC)` | ídem por proyecto |
| 14 | `worked_times` | `idx_worked_times_requirement_id` | `(requirement_id)` | `requirements.totalMinutes` — **ya existía**, ver abajo |
| 15 | `worked_times` | `idx_worked_times_objective_id` | `(objective_id)` | la otra mitad de `totalMinutes` |
| 16 | `unworked_times` | `idx_unworked_times_person_date_id` | `(person_id, "date", id)` | `unworked-times.list`, sort default `["date"]` |
| 17 | `week_assigned_times` | `idx_week_assigned_times_person_datefrom_id` | `(person_id, date_from, id)` | `week-assigned-times.list`, sort default `["dateFrom"]` |
| 18 | `user_project_permissions` | `idx_user_project_permissions_user_id` | `(user_id)` — **condicional** | participa de TODA consulta en modo externo — **no se creó**, ver abajo |

Los nombres no fueron una elección de la implementación: **`docs/db-schemas/jiku.md` ya los
declaraba** en los bloques `indexes { … }` desde el diseño de REQ-006. La verificación 1:1 dio
exacto en nombre, tabla, columnas y orden de columnas; las únicas entradas del documento que la
migración no nombra son los índices preexistentes (`idx_projects_client_id`,
`idx_attachments_file_id`, `idx_inbound_mail_threads_requirement_id`), que es justamente lo
esperado.

---

## La decisión de `CONCURRENTLY`, con los números

**Se usa `CREATE INDEX` común. `CONCURRENTLY` queda descartado.** La medición que sostiene la
decisión, contra el entorno local migrado el 2026-08-24:

```
         relname          | filas_estimadas | tamano_total
--------------------------+-----------------+--------------
 worked_times             |           23856 | 2800 kB
 objective_activity       |            6930 | 1304 kB
 objectives               |            2670 | 888 kB
 people_objectives        |            4643 | 432 kB
 requirements             |             124 | 240 kB
 requirement_activity     |             421 | 184 kB
 unworked_times           |             500 | 128 kB
 projects                 |              97 | 112 kB
 week_assigned_times      |             549 | 104 kB
 people_requirements      |             186 | 72 kB
 user_project_permissions |              13 | 40 kB
```

A esa escala el `SHARE` lock del `CREATE INDEX` común dura milisegundos, no una ventana: la
migración completa corrió en **0,141 s** contra esa base. Y la ventana coincide igual con el
despliegue, porque las escrituras entran por `core`, que se despliega **después** de la migración.

**Umbral para reconsiderarlo, escrito en el propio archivo:** que alguna de `objectives`,
`requirements` u `objective_activity` supere **~5.000.000 de filas**, o que el `CREATE INDEX` se
estime en más de **~30 s**. La próxima story que agregue índices puede partir de estos números en
vez de volver a medir a ciegas.

### La premisa de CA-12 sobre la transacción es falsa en este repo

CA-12 arranca con *"`sequelize-cli` envuelve cada migración en una transacción por defecto"*. **En
este repositorio no es así**, y conviene que quede registrado porque la creencia contraria circula:

- `sequelize-cli` 6.6.3 usa **umzug 2.3.0**, que no abre ninguna transacción por migración.
- `sequelize-cli/lib/core/migrator.js` pasa a cada migración el `queryInterface` **pelado**.
- Las transacciones de `20260819_01`, `20260820_01` y `20260824_01` las abre **cada archivo**, no la
  herramienta.

O sea que `CONCURRENTLY` **estaba disponible sin desactivar nada**: alcanzaba con no abrir una. El
motivo real para no usarlo es otro, y es el que quedó escrito en la migración: las migraciones corren
**al arrancar la api** (`npm start` → `upgrade-db && ts-node ./bin`), y un `CONCURRENTLY` que falla a
mitad deja el índice `INVALID` bloqueando el próximo arranque hasta que alguien lo dropee a mano.

Consecuente con eso, **esta migración no abre transacción propia**: cada sentencia es idempotente por
su `IF NOT EXISTS`, así que una corrida parcial se completa sola en el reintento, y la estructura
queda lista por si algún día hubiera que escalar.

---

## Dos hallazgos del catálogo real que cambiaron la migración

### 1. `user_project_permissions` YA tiene un índice sobre `user_id`, y por eso el #18 no se creó

El diseño planteaba esto como una verificación: *"puede existir uno implícito por una constraint
única"*. **Existe.** La migración `20260529_07_user_project_permissions_simplify` creó
`uk_user_project_permissions ON user_project_permissions (user_id, project_id)`, cuya primera
columna es `user_id` y por lo tanto ya sirve como prefijo al recorte del modo externo.

**Esto es exactamente por qué `CREATE INDEX IF NOT EXISTS` no alcanzaba para CA-8**: compara por
**nombre**, no por definición. Un `IF NOT EXISTS idx_user_project_permissions_user_id` no habría
visto `uk_user_project_permissions` y habría creado un **índice redundante, que cuesta escrituras
para siempre**. Por eso el #18 se resuelve con un bloque `DO $$` que consulta `pg_index`.

**TS-28 — `pg_indexes` sobre `user_project_permissions`, antes y después de aplicar:**

```
           indexname           |                              indexdef
-------------------------------+----------------------------------------------------------------------
 uk_user_project_permissions   | CREATE UNIQUE INDEX uk_user_project_permissions ON public.user_project_permissions USING btree (user_id, project_id)
 user_project_permissions_pkey | CREATE UNIQUE INDEX user_project_permissions_pkey ON public.user_project_permissions USING btree (id)
(2 rows)
```

Las dos capturas son **idénticas**: el `DO $$` no creó nada. **Un solo índice cubre `(user_id)`**, y
es el preexistente. En la base que construye `sync()` el desenlace es el otro —el modelo no declara
esa constraint, así que el índice no está y la migración sí lo crea— y también ahí un solo índice
cubre `(user_id)`. Los dos desenlaces están cubiertos por tests (TS-11 y TS-12).

### 2. `idx_worked_times_requirement_id` ya existía: es un CUARTO índice preexistente

CA-10 enumeraba **tres** índices preexistentes. El catálogo real tiene **cuatro**:
`20260626_01_worked_times_requirement_id` creó `idx_worked_times_requirement_id` **junto con la
columna `requirement_id`**, así que toda base que tenga la columna tiene el índice. La única donde
falta es la que construye `sequelize.sync()` en tests, porque el modelo no declara `indexes`.

**Consecuencia sobre el `down`, y es la razón por la que este hallazgo importa.** CA-13 exige que el
`down` dropee *"los mismos nombres que creó, y ninguno más"*, y nombra tres índices preexistentes
que no se pueden borrar. `idx_worked_times_requirement_id` es de esa misma clase: contra una base
migrada **este `up` no lo crea**, así que dropearlo sería borrar un índice preexistente — y encima
desharía en silencio parte de `20260626_01`. Dos migraciones no pueden ser dueñas del mismo objeto.

**Por eso el `down` dropea 17 nombres, no 18.** El `up` sigue teniendo su `CREATE INDEX IF NOT
EXISTS` para el #14: contra una base migrada es un no-op, y contra la de tests es lo que hace que el
índice de CA-7 exista también ahí.

**Efecto sobre TS-17.** Su redacción pide que los dos snapshots del catálogo sean *"exactamente
iguales"*. Esa igualdad estricta **no puede ser cierta en los dos entornos a la vez**: contra una
base migrada lo es (verificado abajo), pero contra la de `sync()` el `up` crea el #14 y el `down` no
lo dropea, así que queda uno de más. El test afirma la **garantía real de CA-13** —que el `down` no
borra **nada** que existiera antes— y fija que el único excedente posible es exactamente ese índice y
ninguno otro. La desviación está comentada en el propio test.

---

## La verificación contra una base migrada (CA-10, CA-8, CA-13)

### Cómo se fabricó la base migrada

**Las 102 migraciones previas no construyen el esquema desde cero** —ninguna crea `objectives`— así
que esto **no se verifica corriendo `upgrade-db` sobre una base vacía**. Es la misma fricción que
registró el changelog de S-015.

Acá se usó el **entorno local levantado con `deploy/docker-compose.local.yml`** (contenedor
`jiku-local-database`, `postgres:15.4-alpine3.18`), cuyo esquema se cargó desde el dump
(`DUMP_FILE`) y sobre el que la api ya había aplicado las 102 migraciones —`sequelize_meta` lo
confirmaba antes de empezar—. La migración se aplicó desde el host con
`npx sequelize-cli db:migrate --config ./db-upgrade/config.js`.

### TS-27 — los preexistentes de `attachments`, `projects` y `files`

**Antes de aplicar:**

```
  tablename  |           indexname            |                              indexdef
-------------+--------------------------------+-------------------------------------------------------
 attachments | attachments_pkey               | CREATE UNIQUE INDEX attachments_pkey ON public.attachments USING btree (id)
 attachments | idx_attachments_entity         | CREATE INDEX idx_attachments_entity ON public.attachments USING btree (entity_type, entity_id, deleted_at)
 attachments | idx_attachments_file_id        | CREATE INDEX idx_attachments_file_id ON public.attachments USING btree (file_id)
 files       | files_pkey                     | CREATE UNIQUE INDEX files_pkey ON public.files USING btree (id)
 files       | files_storage_key_key          | CREATE UNIQUE INDEX files_storage_key_key ON public.files USING btree (storage_key)
 files       | idx_files_uploader_byte_status | CREATE INDEX idx_files_uploader_byte_status ON public.files USING btree (uploaded_by, byte_status)
 projects    | idx_projects_client_id         | CREATE INDEX idx_projects_client_id ON public.projects USING btree (client_id)
 projects    | projects_pkey                  | CREATE UNIQUE INDEX projects_pkey ON public.projects USING btree (id)
 projects    | uk_projects_ticket_slug        | CREATE UNIQUE INDEX uk_projects_ticket_slug ON public.projects USING btree (ticket_slug) WHERE (ticket_slug IS NOT NULL)
(9 rows)
```

**Después de aplicar — el `diff` completo de las dos capturas:**

```
9a10
>  projects    | idx_projects_client_name_id    | CREATE INDEX idx_projects_client_name_id ON public.projects USING btree (client_id, name, id)
```

Los tres preexistentes están en las dos capturas con **idéntico `indexdef`**, y la **única**
diferencia es el agregado de `idx_projects_client_name_id`. CA-9 y CA-10 cerrados: el compuesto de
`projects` existe y el índice simple anterior **no se borró**.

Una nota sobre `attachments`: el índice real es
`idx_attachments_entity (entity_type, entity_id, deleted_at)` — tres columnas, no dos. CA-10 lo
nombra como `(entity_type, entity_id)`, que es su **prefijo**, así que cubre el caso igual. La
migración no lo toca.

### CA-13 — el `down` contra una base migrada

Se corrió `db:migrate:undo` y se comparó el catálogo de las 13 tablas afectadas contra el estado
previo:

```
== 20260824_02_query_indexes: reverting =======
== 20260824_02_query_indexes: reverted (0.021s)

diff estado-previo estado-tras-el-down  →  sin diferencias
```

**Idénticos.** Siguen ahí `idx_projects_client_id`, `idx_worked_times_requirement_id` y todos los
índices de `attachments` y `files`. Es la verificación que atrapa un `DROP INDEX` de más — y es la
que habría fallado si el `down` hubiera incluido el #14.

Después se reaplicó, y una **segunda** corrida de `upgrade-db` no hace nada
(*"No migrations were executed, database schema was already up to date"*). `sequelize_meta` quedó en
**103**.

---

## Lo que el test automatizado cubre y lo que no (ADR-013)

`api/tests/00-configurations/query-indexes-migration.test.ts` es **el primer test de una migración
del producto**. El changelog de S-015 decía *"ninguna de las 102 migraciones se testea con Mocha, y
esta tampoco"*. Acá se pudo, y la razón es concreta: **una migración de solo índices no depende del
estado de los datos**. El esquema que deja `sync()` tiene las mismas tablas y columnas que
producción, así que el DDL de `CREATE INDEX` que se ejecuta es idéntico.

El archivo aplica la migración **a mano** (`migration.up(sequelize.getQueryInterface(), Sequelize)`),
no corre `upgrade-db` y no toca `sequelize_meta`. **27 escenarios, todos en verde**, y cada `describe`
que aplica la migración la revierte en su `after` para no contaminar a los 61 archivos de rutas que
corren después.

**Lo que NO puede probar ahí**, y por eso está más arriba en esta entrada: que los índices
preexistentes existan. En esa base **no existe ninguno de los cuatro**, porque los creó una migración
y `sync()` no los reproduce. La mitad verificable —que la migración **no los nombra en ninguna
sentencia** y no crea nada nuevo sobre `attachments` ni `files`— sí está automatizada.

**Tampoco prueba tiempos:** `EXPLAIN`, no `EXPLAIN ANALYZE`. El plan, no el reloj. Los tres
escenarios de plan (TS-19, TS-20, TS-21) corren dentro de una transacción con
`SET LOCAL enable_seqscan = off`, porque las tablas de la suite están vacías y el planner elegiría
`Seq Scan` legítimamente por tamaño: lo que se verifica es que el índice **sea utilizable** por la
consulta, no que gane por costo.

Una trampa que conviene dejar nombrada para S-022: **TS-19 usa igualdad en la columna líder**
(`project_id = 12`), no un `IN`. Un `state IN ('backlog','activo')` sobre la columna líder produce un
`ScalarArrayOpExpr`, y el orden de las columnas trailing **no se preserva entre elementos del
array**, así que el plan puede conservar un nodo `Sort` legítimamente. No es un defecto de estos
índices —son los que el REQ declara— pero un test de `EXPLAIN` escrito con `IN` fallaría por una
razón correcta y llevaría a "arreglar" el índice. **Es donde S-022 tiene que decidir si el caso de
lista merece otra estrategia.**

---

## El orden de despliegue

**La migración va primero. El `core` de S-022, después.** No es una preferencia: un `core` con
contrato de consultas contra una base sin estos índices es **funcionalmente correcto y
operativamente inviable** — cada página degrada a `Seq Scan` + `Sort`, y el `statement_timeout` de
8000 ms de la conexión de lectura devuelve `query_timeout` bajo carga normal. Invertir el orden
produce exactamente el modo de falla que esta story existe para prevenir.

---

## Costo de escritura: lo único observable hasta S-022

**Nada usa estos índices todavía.** El consumidor es el motor de consulta de S-022 en adelante.
Hasta entonces, el único efecto observable es el **costo de escritura** que cada índice agrega a
`objectives`, `requirements`, `objective_activity` y `worked_times`, que son las cuatro tablas de
mayor tránsito de escritura del producto y las que más índices reciben.

Es el precio explícito de que el keyset se sostenga, y está aceptado por diseño. El GIN de `tags`
sigue la misma lógica en la otra dirección: acelera lecturas y encarece escrituras de `requirements`,
que se escriben poco y se consultan en cada pantalla de requisitos.

Un índice **no** abre superficie de seguridad: no expone datos ni cambia permisos, y no hizo falta
ningún `GRANT` — el rol de solo lectura ya tiene `SELECT` sobre todo el esquema y un índice no
requiere permisos adicionales (ADR-001). El único vínculo con seguridad es indirecto y vale nombrarlo:
que el recorte del modo externo sea **barato** es lo que sostiene que nadie proponga desactivarlo
"solo para este caso", y RF-22 exige que no se pueda desactivar por payload.

---

## Nota de mantenimiento: el conteo de migraciones

`docs/db-schemas/jiku.md` arrastraba una fila `| Cantidad | **101** |` desde S-015, mientras **el
resto del producto —incluida la prosa dos párrafos más abajo del mismo archivo—** decía 102 y `ls`
confirmaba 102. La Tarea 5 del plan de S-015 enumeraba los lugares a actualizar de 101 a 102 y este
quedó afuera, o se actualizó solo en la prosa. **Es un desliz del cierre de S-015, no de esta
story**, y queda corregido acá.

El conteo pasó a **103** en los **13 lugares de documentación viva**:

| Archivo | Menciones |
|---|---|
| `docs/db-schemas/jiku.md` | 3 (línea 6, la fila `Cantidad`, el callout "Las 10X asumen") |
| `docs/architectures/api/overview.md` | 2 |
| `docs/architectures/api/conventions/orm.md` | 1 |
| `docs/architectures/core/conventions/orm.md` | 1 |
| `docs/prd/architecture.md` | 3 |
| `docs/prd/requirements.md` | 1 (NFR-R07) |
| `docs/prd/feature-groups.md` | 1 |
| `docs/prd/goals-and-context.md` | 1 |

Los documentos que son **registro histórico no se tocaron**, y la razón es la misma de siempre:
`docs/changelog/`, `docs/requests/`, `docs/stories/` y los story-plans anteriores registran lo que se
sabía cuando se escribieron. Reescribirlos borraría el rastro en vez de conservarlo.

**Para el próximo que actualice este conteo:** verificalo con `grep`, no con los números de línea de
un plan anterior. Es exactamente el modo de falla que produjo la discrepancia de S-015.

```sh
ls api/db-upgrade/migrations/ | wc -l
grep -rn "10[0-9] migraciones\|Las 10[0-9]\|Cantidad | \*\*10" docs/ \
  | grep -v changelog | grep -v requests | grep -v "docs/stories" | grep -v story-plans
```

---

## CA-16: la api no cambió de comportamiento

| Afirmación | Verificado |
|---|---|
| El diff de `api/` son solo dos archivos | `git status --porcelain api/` lista únicamente la migración y su test, los dos **nuevos**. Ningún archivo existente de `api/` cambió |
| `sendQuery` no existe | `grep -rn "sendQuery" api/lib api/tests` → 0 resultados |
| Ninguna ruta `GET` migró al bus | Ninguna ruta llama a `bus().query()` |
| `api/lib/utils/bus/protocol.ts` sin modificar | No figura en el diff |
| `packages/` y `core/` intactos | `git status --porcelain packages/ core/` → vacío. **Ningún `@Table` ganó `indexes`** (ADR-005) |
| La suite pasa | `npm test --workspace @jiku/api` → **789 tests, 0 fallos**. Ninguna aserción preexistente cambió |
| Build y lint | `npm run build` y `npm run lint --workspace @jiku/api` → exit 0 |

**No hay ADR nuevo.** Esta story no decide nada que ADR-001, ADR-005 y ADR-013 no hayan decidido ya.
Esta entrada registra **evidencia**, no una decisión de arquitectura.
