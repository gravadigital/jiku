# `Usuario` gana `roles` e `identityType` — el DDL de `sync()` y la revisión campo por campo

**Story:** S-015 · **Request:** REQ-005 · **Fecha:** 2026-08-24

`packages/models/src/user.model.ts` declara dos columnas nuevas —`roles` (`DataType.JSONB`) e
`identityType` (`DataType.STRING`)— y exporta el enum `IdentityType` por el barrel de
`@jiku/models`. **Ningún comportamiento cambia**: las dos columnas existen, toda fila dice
`person` / `[]`, y **nada las escribe** — el escritor es S-016 y el lector es S-017. Es puramente
aditiva.

Esta entrada es el entregable de la Tarea 3 del plan de `packages/models`: publica el **DDL exacto
que `sequelize.sync()` emite** para las dos columnas, para que la revisión de CA-11 contra la
migración sea comparación de texto y no interpretación.

## Por qué esta entrada existe

El producto tiene **dos fuentes para el mismo esquema**: `sequelize.sync()` en `development` y
`testing` (`core/src/models/index.ts`), y las migraciones de `api/db-upgrade/migrations/` en
producción. `docs/db-schemas/jiku.md` declara que **los tests no detectan la divergencia**, porque
ADR-013 los corre contra el esquema que produce `sync()`. La única barrera que existe hoy es la
revisión campo por campo del par modelo/migración, y esa revisión necesita el DDL de las dos
fuentes escrito en el mismo lugar.

**No hay ADR nuevo.** No se decide nada que ADR-005 y ADR-013 no hayan decidido ya: el par
modelo/migración en el mismo cambio y los tests contra `sync()` son sus reglas. Esta entrada
registra la **evidencia** de que el par coincide, no una decisión.

## El DDL que `sync()` emite

Capturado con el query generator de Sequelize 6.37.8 sobre la definición real del modelo, sin
conectarse a ninguna base (script efímero, no commiteado):

```
"roles"         JSONB NOT NULL DEFAULT '[]'
"identity_type" VARCHAR(255) NOT NULL DEFAULT 'person'
```

Salida completa del generador para `users`, para que el contexto de las dos columnas quede visible:

```json
{
  "id": "VARCHAR(100) PRIMARY KEY",
  "name": "VARCHAR(255) NOT NULL",
  "username": "VARCHAR(255) NOT NULL",
  "email": "VARCHAR(255) NOT NULL",
  "roles": "JSONB NOT NULL DEFAULT '[]'",
  "identity_type": "VARCHAR(255) NOT NULL DEFAULT 'person'",
  "created_at": "TIMESTAMP WITH TIME ZONE NOT NULL",
  "updated_at": "TIMESTAMP WITH TIME ZONE NOT NULL"
}
```

## El DDL que la migración va a crear

Es de S-015 lado `api`, y se transcribe acá porque es el otro lado de la comparación:

```sql
CREATE TYPE identity_type AS ENUM ('person', 'service');

ALTER TABLE users
  ADD COLUMN roles         JSONB           NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN identity_type "identity_type" NOT NULL DEFAULT 'person';
```

## Comparación campo por campo (CA-11)

| Campo | `sync()` (FUENTE 1, tests) | Migración (FUENTE 2, producción) | ¿Coincide? |
|---|---|---|---|
| Nombre de columna | `roles` | `roles` | **Sí** |
| Nombre de columna | `identity_type` | `identity_type` | **Sí** |
| Tipo de `roles` | `JSONB` | `JSONB` | **Sí** |
| Nulabilidad de `roles` | `NOT NULL` | `NOT NULL` | **Sí** |
| Default de `roles` | `'[]'` | `'[]'::jsonb` | **Sí** — mismo valor, distinta anotación de tipo. `jsonb_in('[]')` y `'[]'::jsonb` producen el mismo `[]` |
| Nulabilidad de `identity_type` | `NOT NULL` | `NOT NULL` | **Sí** |
| Default de `identity_type` | `'person'` | `'person'` | **Sí** |
| **Tipo de `identity_type`** | **`VARCHAR(255)`** | **ENUM nativo `identity_type`** | **NO — y es la divergencia DELIBERADA** |

### La divergencia que hay, y por qué es la correcta

En el tipo de `identity_type` las dos fuentes **no coinciden**, y eso es el diseño, no un fallo.
Es el precedente **documentado** de `byte_status` / `retention_status` (`docs/db-schemas/jiku.md`,
sección `files`, bajo "Migración y backfill (REQ-001, S-001)"): declarar la columna
`DataType.ENUM` en el modelo haría que `sync()` cree el tipo con la convención de nombre de
Sequelize —`enum_users_identity_type`— **distinto del `identity_type` que crea la migración**.

Hay dos divergencias posibles y conviene nombrar cuál es cuál:

| Divergencia | Qué es | Estado |
|---|---|---|
| `VARCHAR(255)` ↔ ENUM nativo `identity_type` | **La correcta.** Conocida, precedentada, sin consecuencia: la columna acepta los mismos valores por los dos caminos, y ningún test afirma nada sobre el tipo que no sea lo que `sync()` produce | **Es la que hay** |
| `enum_users_identity_type` ↔ `identity_type` | **La incorrecta.** Dos tipos distintos con el mismo propósito, uno por fuente, sin síntoma en CI | **NO existe** |

### La divergencia que NO hay

**No existe `enum_users_identity_type`.** Evidencia automatizada: TS-11 de
`api/tests/00-configurations/user-model.test.ts` —
`SELECT typname FROM pg_type WHERE typname LIKE '%identity%'` devuelve **cero filas** contra el
esquema de `sync()`. Verificado además que la aserción **sirve de red**: con el modelo cambiado
temporalmente a `DataType.ENUM(...Object.values(IdentityType))` y recompilado, **TS-11 y TS-6
fallan** (aparece el tipo, y `type.key` pasa de `STRING` a `ENUM`). Revertido.

### CA-11 no queda cerrado con esta entrada

Falta **la mitad de la evidencia**: la verificación contra una **base migrada**. Requiere correr
`npm run upgrade-db --workspace @jiku/api` con la migración de la story, que **este lado de S-015
no crea**. El cierre de CA-11 es del plan de `api`; este lado aporta el DDL de `sync()` y esta
tabla.

## Evidencia de CA-13: ningún test existente cambió

Las dos suites completas pasan sin tocar una aserción:

| Suite | Resultado | `git diff --name-only` sobre archivos versionados |
|---|---|---|
| `npm test --workspace @jiku/api` | **731 passing**, 0 failing | `api/tests/` **vacío** |
| `npm test --workspace @jiku/core` | **289 passing**, 0 failing | `core/tests/` **vacío** |

El único cambio en `api/tests/` es el archivo **nuevo** `00-configurations/user-model.test.ts`, que
aparece como `??` en `git status` y no en `git diff`.

**El número que lo respalda:** los puntos de siembra de `User` que **no hubo que tocar**:

| Suite | Llamadas a `User.create` / `User.bulkCreate` | Archivos |
|---|---|---|
| `api/tests/` | 117 | 64 |
| `core/tests/` | 10 | 7 |
| **Total** | **127** | **71** |

Es una corrección al conteo de la story, que dice "~40". No cambia nada del diseño —los defaults
hacen que los 127 sigan funcionando igual— pero **sí cambia la lectura de un fallo**: si CA-13 se
rompiera, el trabajo de reparación es sobre ~71 archivos, no ~40.

El mecanismo exacto por el que los 127 siguen pasando está automatizado en TS-10: un `INSERT`
**crudo** que no menciona las dos columnas resuelve sin error y toma los defaults. Va con SQL crudo
y no con `User.create({...})` a propósito: `create` pasa por el modelo, que ya conoce los defaults;
el `INSERT` crudo prueba que el `DEFAULT` está **en la base**.

## Lo que la divergencia cuesta

En `testing` la columna es un `VARCHAR(255)` **sin CHECK**, así que un test puede insertar
`identityType: 'banana'` y **va a pasar**, mientras producción lo rechazaría con
`invalid input value for enum identity_type`. Consecuencia práctica, y está escrita en el docblock
del test: **no hay ningún escenario que afirme que un valor inválido es rechazado** — fallaría por
el límite de ADR-013 y no por un bug del producto. La validación del valor vive en el consumidor
del evento (S-016), no en la columna.

## Build y lint

| Verificación | Resultado |
|---|---|
| `npm run build --workspace @jiku/models` | exit 0. `dist/user.model.d.ts` declara `roles: string[]` e `identityType: IdentityType`; `dist/index.d.ts` re-exporta `IdentityType` |
| `npm run lint --workspace @jiku/models` | exit 0, cero errores y cero warnings |

**Rebuild obligatorio:** `api` y `core` consumen `dist/`. Un test que falle con
`column identity_type does not exist` o con `identityType` `undefined` casi siempre es un
`npm run build:packages` que falta.

## Una regla que sale de acá

**Agregar una columna a un modelo de `@jiku/models` obliga a revisar los `include` de ese modelo en
`api/lib/`.** El default de Sequelize es devolver **todas** las columnas, así que una columna nueva
aparece **sola** en toda respuesta cuyo `include` no declare `attributes` — sin cambio de spec y sin
aviso. Es CA-12 de esta story, y es del lado `api`.

## Fuera del alcance de este lado de la story

| Qué | Dónde |
|---|---|
| `api/db-upgrade/migrations/20260824_01_users_roles_identity_type.js` | S-015 · `api` |
| Filtro `where: { identityType: 'person' }` en `opus-projects-projid-users-get.ts` y su test | S-015 · `api` |
| Acotar los `include` de `User` sin `attributes` (CA-12) | S-015 · `api` |
| Las dos `description` de `docs/apis/api.yaml` (el schema `User` **no** gana las columnas, CA-9) | S-015 · `api` |
| Escribir las columnas al autenticar contra el bus | S-016 |
| Autorizar a los callers del bus por `roles` | S-017 |

**Los dos lados se despliegan juntos.** ADR-005 lo pide y ADR-012 lo fuerza. Un despliegue de
`@jiku/models` sin la migración deja el modelo declarando columnas que la base de producción no
tiene, y **toda lectura de `users` falla** con `column users.identity_type does not exist` — no solo
las que usan las columnas nuevas, porque Sequelize las incluye en el `SELECT` de cualquier `include`
sin `attributes`.

## Corrección aparte, no relacionada con S-015

`core/src/commands/files/storage.ts` — el `S3Client` del firmador suma
`requestChecksumCalculation: 'WHEN_REQUIRED'`. El SDK de AWS v3 calcula un checksum CRC32 por
defecto en `PutObject` y al **prefirmar** lo mete como query param **firmado**; como al firmar
todavía no hay cuerpo, el valor es el CRC32 del contenido **vacío**, el objeto que el navegador
sube nunca coincide, y el proveedor rechaza el PUT con 403 — que el navegador reporta como fallo de
CORS.

`core/tests/commands/storage-signer.test.ts` ya declaraba ese contrato y **fallaba en dos de sus
tres escenarios** desde que se agregó: el test entró sin el cambio de implementación que lo
satisface. Se corrige acá porque la story exige que las dos suites queden en verde.

---

# Lado `api`: la migración, el filtro de `opus`, los `include` acotados y el cierre de CA-11

**Story:** S-015 · **Request:** REQ-005 · **Fecha:** 2026-08-24 · **Servicio:** `api`

Esta segunda mitad de la entrada cierra S-015. Agrega la **migración** que crea el ENUM nativo
`identity_type` y las dos columnas de `users` en producción, el **filtro** `identityType: 'person'`
en el único endpoint que las lee, el **acotado de los `include` de `User`** (el criterio con
consecuencia de seguridad) y las dos `description` de `docs/apis/api.yaml`.

**Sigue sin cambiar ningún comportamiento de producción.** Al terminar, las dos columnas existen en
la base real, **toda fila dice `person` / `[]`**, y **nada las escribe**: el escritor es S-016, el
lector es S-017.

## Lo que se agregó

| Qué | Dónde |
|---|---|
| La migración | `api/db-upgrade/migrations/20260824_01_users_roles_identity_type.js` (**nueva**, la 102) |
| El filtro `identityType: 'person'` | `api/lib/routes/opus-projects-projid-users-get.ts` |
| `attributes: ['id','name','email']` en los 5 `include` de `User` que no lo declaraban | `api/lib/routes/projects-id-get.ts`, `projects-get.ts`, `objectives-id-get.ts` (×2), `api/lib/utils/find-persons-by-missing-hours-interval.ts` |
| La nota de omisión deliberada del schema `User` y la respuesta a medias de `/auth/present` | `docs/apis/api.yaml` (dos `description`) |

## CA-11 se cierra acá: la comparación campo por campo, con salida real

El lado `models` publicó el DDL que `sync()` emite; faltaba **la mitad que necesita una base
migrada**, y la migración de esta tarea la produce. Las dos salidas son de
`information_schema.columns` corridas contra dos bases reales, no una transcripción.

**FUENTE 1 — base creada por `sequelize.sync()`** (la de los tests, contenedor `jiku-api-tests-db`):

```
  column_name  |        data_type         |  udt_name   | is_nullable |       column_default
---------------+--------------------------+-------------+-------------+-----------------------------
 id            | character varying        | varchar     | NO          |
 name          | character varying        | varchar     | NO          |
 username      | character varying        | varchar     | NO          |
 email         | character varying        | varchar     | NO          |
 roles         | jsonb                    | jsonb       | NO          | '[]'::jsonb
 identity_type | character varying        | varchar     | NO          | 'person'::character varying
 created_at    | timestamp with time zone | timestamptz | NO          |
 updated_at    | timestamp with time zone | timestamptz | NO          |
```

`character_maximum_length` de `identity_type` es **255**, que es exactamente el `VARCHAR(255)` que
el lado `models` publicó. **La comparación es de texto y coincide.**

**FUENTE 2 — base migrada** (esquema previo reconstruido + las 101 anteriores marcadas como
aplicadas + `npm run upgrade-db`):

```
  column_name  |        data_type         |   udt_name    | is_nullable |     column_default
---------------+--------------------------+---------------+-------------+-------------------------
 id            | character varying        | varchar       | NO          |
 name          | character varying        | varchar       | NO          |
 username      | character varying        | varchar       | NO          |
 email         | character varying        | varchar       | NO          |
 created_at    | timestamp with time zone | timestamptz   | NO          | CURRENT_TIMESTAMP
 updated_at    | timestamp with time zone | timestamptz   | NO          | CURRENT_TIMESTAMP
 roles         | jsonb                    | jsonb         | NO          | '[]'::jsonb
 identity_type | USER-DEFINED             | identity_type | NO          | 'person'::identity_type
```

### El veredicto, columna por columna

| Campo | `sync()` | Migrada | ¿Coincide? |
|---|---|---|---|
| Nombre `roles` | `roles` | `roles` | **Sí** |
| Tipo de `roles` | `jsonb` / `jsonb` | `jsonb` / `jsonb` | **Sí** |
| Nulabilidad de `roles` | `NO` | `NO` | **Sí** |
| Default de `roles` | `'[]'::jsonb` | `'[]'::jsonb` | **Sí — idéntico, carácter por carácter** |
| Nombre `identity_type` | `identity_type` | `identity_type` | **Sí** |
| Nulabilidad de `identity_type` | `NO` | `NO` | **Sí** |
| Default de `identity_type` | `'person'::character varying` | `'person'::identity_type` | **Sí** — mismo valor, la anotación de tipo es la de cada columna |
| **Tipo de `identity_type`** | **`character varying` / `varchar(255)`** | **`USER-DEFINED` / `identity_type`** | **NO — es la divergencia DELIBERADA** |

**La única diferencia es la esperada, y es la correcta de las dos posibles.** Es el precedente
documentado de `byte_status` / `retention_status`: el modelo declara `DataType.STRING` a propósito
para que `sync()` **no cree ningún tipo** y por lo tanto no pueda crearlo con otro nombre.

### TS-25: la divergencia peligrosa no existe

```
-- base de sync():   SELECT typname FROM pg_type WHERE typname LIKE '%identity_type%';
(0 rows)

-- base migrada:     SELECT typname FROM pg_type WHERE typname LIKE '%identity_type%';
 identity_type
 _identity_type
```

**No aparece `enum_users_identity_type` en ninguna de las dos.** `_identity_type` en la migrada es
el tipo array que PostgreSQL crea automáticamente para **todo** ENUM (`identity_type[]`), no un
segundo tipo ni una convención de Sequelize. Si alguna vez aparece `enum_users_identity_type`, el
modelo se cambió a `DataType.ENUM` y hay que revertirlo.

### Las dos diferencias que NO son de las columnas nuevas, y por qué no son hallazgos

El plan pide comparar **las dos salidas completas** y anotar cualquier otra diferencia. Hay dos, y
las dos son **artefactos del banco de pruebas**, no del producto:

1. **`created_at` / `updated_at` tienen `DEFAULT CURRENT_TIMESTAMP` en la migrada y ninguno en la de
   `sync()`.** Lo puso la reconstrucción a mano del esquema previo a la migración (`users` no se crea
   desde cero en ninguna de las 102 migraciones, así que hubo que fabricar el estado previo). **La
   migración de esta story no toca esas dos columnas.**
2. **El `ordinal_position` de `roles` / `identity_type` es 5-6 en `sync()` y 9-10 en la migrada.**
   `sync()` las crea en el orden del modelo; un `ADD COLUMN` las agrega al final, y los huecos 7-8
   son los `attnum` que consumió el `DROP COLUMN` de la verificación del `down` (TS-7). El orden
   físico de columnas **no es parte de lo que CA-11 compara** —nombre, tipo, nulabilidad, default— y
   Sequelize no depende de él: nombra las columnas en cada `SELECT` y en cada `INSERT`.

## Verificación de la migración contra una base real (TS-1 a TS-8)

Ninguna de las 102 migraciones se testea con Mocha, y esta tampoco: la suite corre contra el esquema
de `sync()`, donde `identity_type` es un `VARCHAR(255)` **sin CHECK** (ADR-013). La verificación es
SQL contra una base migrada, y esto es lo que dio:

| TS | Qué verifica | Resultado |
|---|---|---|
| TS-1 | El ENUM nativo con sus dos valores en orden | `person`, `service` — en ese orden |
| TS-2 | `roles`: tipo, nulabilidad, default | `jsonb` / `jsonb` / `NO` / `'[]'::jsonb` |
| TS-3 | `identity_type` es ENUM nativo, no varchar | `USER-DEFINED` / `identity_type` / `NO` / `'person'::identity_type` |
| TS-4 | El backfill lo dan los defaults | Fila sembrada **antes** de migrar quedó `[]` / `person`. `grep -c UPDATE` en la migración → **0** |
| TS-5 | Un `INSERT` de cuatro columnas sigue funcionando | Inserta sin error; queda `[]` / `person` |
| TS-6 | Un valor fuera del ENUM se rechaza | `ERROR: invalid input value for enum identity_type: "banana"` |
| TS-7 | El `down` revierte, en el orden correcto | `users` vuelve a sus 6 columnas, `pg_type` no tiene `identity_type`, **las 2 filas siguen ahí con todos sus datos** |
| TS-8 | Re-correr el `up` falla y no deja el esquema a medias | `ERROR: type "identity_type" already exists`. `users` **no** gana columnas duplicadas (8 columnas, cada una una vez) y el ENUM sigue con **2** valores: la transacción hizo rollback |

**TS-6 es la razón de que ninguno de estos sea un test de Mocha.** Ese `UPDATE` **pasaría** en
`testing`, donde la columna es un varchar. Un test así fallaría por el límite de ADR-013, no por un
bug del producto.

## CA-13: ningún test existente cambió, con **una** excepción registrada

| Suite | Resultado | Diff |
|---|---|---|
| `npm test --workspace @jiku/api` | **736 passing**, 0 failing | 4 archivos de `tests/`, solo agregados salvo la excepción de abajo |
| `npm test --workspace @jiku/core` | **289 passing**, 0 failing | `git diff --name-only core/` → **vacío** |

736 = las 731 del lado `models` + **5 tests nuevos**: 2 del filtro de identidad y 3 de forma de
respuesta.

**La evidencia mecánica, y es corta a propósito.** En todo `api/tests/`, el diff de esta tarea
elimina exactamente **dos** líneas:

```
-import { Project, User, UserProjectPermission } from '@jiku/models';
-            username: 'user01',
```

La primera es el import, reemplazado por uno que además trae `IdentityType`. **La segunda es la
única aserción preexistente que esta story cambia**, y es la excepción declarada:

> `api/tests/routes/projects-id-get.test.ts` esperaba `creator: { id, name, username, email }`.
> Acotar ese `include` a `['id','name','email']` —lo que CA-12 ordena— hace desaparecer `username`
> de la respuesta y rompe el `containDeep`. **Gana CA-12**, que es el criterio con consecuencia de
> seguridad. Se quitó `username` del objeto esperado, con un comentario en el test que dice por qué.
>
> **Por qué es seguro:** ningún componente de `web` ni de `opus-web` lee `username` de un usuario
> embebido — solo `name` e `id`. **Por qué no se resolvió al revés:** poner
> `['id','name','username','email']` solo en esa ruta crearía una cuarta variante de la lista de
> `attributes` en el servicio, y una lista distinta por sitio es exactamente cómo el próximo cambio
> de esquema vuelve a filtrar una columna.

**Y el número que respalda el resto:** los puntos de siembra de `User` que **no hubo que tocar**:

| Suite | Llamadas a `User.create` / `User.bulkCreate` | Archivos |
|---|---|---|
| `api/tests/` | 122 | 65 |
| `core/tests/` | 10 | 7 |
| **Total** | **132** | **72** |

(El lado `models` contó 127 en 71; la diferencia son los 5 puntos de siembra de su propio archivo
nuevo `api/tests/00-configurations/user-model.test.ts`.) De esos 72 archivos, esta tarea tocó **4**,
y en 3 de ellos **solo agregó**.

## CA-12: el criterio con consecuencia de seguridad

Cinco `include` de `User` devolvían **todas** las columnas del modelo. Sin acotarlos, `roles` e
`identityType` habrían empezado a salir en las respuestas **el mismo día que esta story se
despliegue**, sin ningún cambio de spec que lo delate — y `GET /api/projects` habría filtrado los
roles de **cada** creador de proyecto en una sola respuesta.

Los cinco quedaron con la **misma** lista, `['id','name','email']`, igual que los siete que ya
estaban acotados: la uniformidad es lo que hace que el próximo cambio no se equivoque.

**Verificación estructural, no por grep de una línea:** un recorrido de los 16 `include` de `User`
de `api/lib/` (multilínea incluidos) da **0 sin `attributes`**. El `grep -rn "model: User" lib/ |
grep -v attributes` que proponía el plan devuelve 7 falsos positivos, porque en esos casos
`attributes` está en otra línea del mismo objeto; conviene saberlo para no perseguir un fantasma la
próxima vez.

El quinto caso —`lib/utils/find-persons-by-missing-hours-interval.ts`— **no estaba en el inventario
de la story** y es código muerto (cero llamadores). Se acotó igual, con un comentario que lo dice:
cuesta una línea y elimina la trampa para el día que alguien la revive.

**La regla que sale de acá, y ya estaba escrita del lado `models`:** agregar una columna a un modelo
de `@jiku/models` **obliga** a revisar los `include` de ese modelo en `api/lib/`, porque el default
de Sequelize es devolver todo.

## CA-7 y CA-8: el filtro que es defensa, no corrección

`GET /api/opus/projects/{projid}/users` suma `where: { identityType: IdentityType.Person }` al
`include`. **El contrato HTTP no cambia**: mismo path, mismos middlewares, mismos `attributes`,
mismo `order`, mismos códigos de error. Cambia **qué filas entran**.

Hoy un service user tampoco aparecería —el listado sale de `user_project_permissions` y no tiene
fila ahí—, así que el test **tiene** que sembrar el permiso a mano o pasa sin probar nada. Los dos
tests nuevos siembran una fila `service` **con** `UserProjectPermission` sobre el proyecto, en
proyectos **nuevos** (4 y 5) y no en el 1, para que un fallo del filtro rompa **un** test cuyo
nombre lo explique en vez de cuatro repartidos en tres `describe`.

**La verificación negativa se hizo y sirvió:** con el `where` todavía sin poner, los dos tests
nuevos fallaron con la respuesta trayendo **2** usuarios donde esperaban 1, y **1** donde esperaban
0. Es la prueba de que la siembra del permiso quedó bien y el test prueba algo — el modo de falla que
CA-8 existe para evitar.

`where` dentro de un `include` promueve el JOIN a **INNER**, y eso es lo buscado: con `LEFT JOIN`
(`required: false`) el `.map(p => p.user)` produciría `undefined` en la respuesta. Por eso el
escenario de "todos los permitidos son de servicio" afirma `[]` y no un array con huecos.

## CA-9: el schema `User` no gana las columnas, y la omisión quedó escrita

`docs/apis/api.yaml` conserva las **cuatro** propiedades del schema `User` (`id`, `name`, `email`,
`username`). Verificado por parseo, no por lectura: ningún schema del documento tiene `roles`,
`identityType` ni `identity_type` como property, y el YAML sigue siendo válido (47 paths).

Lo que sí cambió son dos `description`:

- **`User`** gana la nota de que la omisión es **deliberada** (D-12 de REQ-005) y **por qué**: ese
  schema es alcanzable por `external-user` a través de `GET /opus/projects/{projid}/users`. La nota
  dice además que **la garantía no la da el schema sino los `include` acotados**, para que nadie la
  lea como automática.
- **`POST /auth/present`** reemplaza su "Pendiente: definir…" por la respuesta a medias de REQ-005:
  para quien **se conecta al bus** lo resuelve el auth-callout por evento (S-016); para el usuario de
  `web` / `opus-web` **sigue abierta**. El `summary` sigue marcándola no-op, las `responses` no
  cambian y **no hay ningún cambio de código** en `lib/routes/auth-present-post.ts`.

## El conteo de migraciones: 101 → 102

Se actualizó en los **12** lugares de documentación viva (`docs/architectures/`, `docs/db-schemas/`,
`docs/prd/`). `ls api/db-upgrade/migrations/ | wc -l` da **102** y el grep de control no devuelve
ninguna línea.

Es un **hecho contable sobre el repo**, no un cambio de definición técnica: ninguna decisión
arquitectónica cambia, así que se actualizó acá en vez de disparar
`/product-change-technical-definition`. Dejar 6 de 12 al día crearía exactamente el tipo de
divergencia entre documentación y realidad que esta story existe para prevenir.

En el mermaid de `docs/prd/architecture.md` se cambió **solo el número**: el label también dice "2
excepciones" y ese conteo no cambia con esta story.

**Los documentos de registro histórico no se tocaron, y es deliberado:** el `DADO` de CA-3 en
`docs/stories/S-015…` describe el estado **previo** ("que tiene 101 migraciones") y es correcto tal
cual; `docs/requests/REQ-005…`, los dos story-plans y las entradas de changelog anteriores registran
lo que se sabía cuando se escribieron.

## Build y lint

| Verificación | Resultado |
|---|---|
| `npm run build:packages` | exit 0 |
| `npm run build --workspace @jiku/api` | exit 0 |
| `npm run lint --workspace @jiku/api` | exit 0, cero errores y cero warnings |

## Lo que todavía no existe

**Nada escribe `roles` ni `identityType`.** Al cerrar S-015 las dos columnas existen en el modelo y
en la base de producción, **toda fila dice `person` / `[]`**, y el único lector en todo el producto
es el filtro de `opus` de esta story.

| Qué falta | Dónde |
|---|---|
| Consumir el evento de autenticación del bus y espejar la identidad (**el escritor**) | S-016 |
| Autorizar a los callers del bus comparando `roles` contra un mapa cerrado y deny-by-default (**el lector**) | S-017 |
| El flujo `sincronizacion-de-identidades` en `docs/flows/` | S-016 |

**Los dos lados de S-015 se despliegan juntos.** Un despliegue de `@jiku/models` sin esta migración
deja el modelo declarando columnas que la base no tiene, y **toda lectura de `users` falla** con
`column users.identity_type does not exist` — no solo las que usan las columnas nuevas, porque
Sequelize las incluye en el `SELECT` de cualquier `include` sin `attributes`.

## Hallazgos de la planificación, para que no se descubran dos veces

Cuatro cosas que aparecieron al verificar la story contra el código. Las dos primeras ya están
resueltas arriba; las dos últimas son **deuda que esta story no arregla**.

1. **CA-12 y CA-13 se contradicen en un punto exacto y la story no lo ve.** Resuelto: gana CA-12, se
   quitó `username` de la aserción de `projects-id-get.test.ts`, registrado arriba como la única
   excepción.

2. **El test modelo que la story manda seguir no existe.** CA-8 cita
   `api/tests/routes/attachments-post-permissions.test.ts`, borrado en el commit `28a6d33` (S-004,
   REQ-001). La referencia quedó desactualizada **también en
   `docs/architectures/api/conventions/authorization.md`**, en su última regla. El modelo vivo es el
   propio archivo del endpoint. **Recomendación aparte:** corregir esa referencia en
   `authorization.md` vía `/product-change-technical-definition` — es un cambio de convención, no de
   story.

3. **Hay un quinto `include` sin `attributes` que el inventario de la story declara completo.**
   `lib/utils/find-persons-by-missing-hours-interval.ts`. Resuelto arriba: acotado, con comentario.

4. **El spec sobredeclara `creator`, y esta story lo empeora sin poder arreglarlo.** `api.yaml`
   declara `creator: { $ref: User }` y `User` tiene cuatro propiedades, `username` incluida; después
   de esta story esas respuestas devuelven **tres**. **La deriva es preexistente**
   (`requirements-id-get.ts` y `opus-projects-projid-requirements-get.ts` ya devolvían tres contra el
   mismo `$ref`); esta story suma tres endpoints al mismo desfasaje. El arreglo correcto es un
   `UserSummary` (`id`, `name`, `email`) en `components/schemas`, con los `$ref` de `creator`,
   `uploader`, `user` y `changedByUser` apuntando ahí. **Va por
   `/product-change-technical-definition`, no por una story.**

   **El mismo desfasaje existe del lado `web`:** `web/src/features/auth/types/auth.types.ts` declara
   `username: string` **requerido** en el tipo `User`, y ese tipo se usa para `Project.creator` y
   `Objective.creator`. Después de esta story el tipo **miente**. No rompe nada en runtime —ningún
   componente lo lee— y `web` está explícitamente fuera del alcance. Es material para una story de
   `web`; el patrón correcto ya existe en ese repo: `RequirementCreator` declara exactamente `id`,
   `name`, `email`.
