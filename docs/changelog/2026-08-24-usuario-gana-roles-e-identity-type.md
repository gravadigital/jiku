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
