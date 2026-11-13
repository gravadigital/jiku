# Baja de la integración con sistemas externos (Jira) — procedimiento de despliegue

**Story:** S-010 · **Request:** REQ-003 · **Fecha:** 2026-08-20

Se elimina de la base y de `@jiku/models` todo el esquema que se había preparado para sincronizar
tareas con un sistema externo. **La integración con sistemas externos se descarta como capacidad
del producto**: FG-7 se cierra por su segunda vía —la baja— y sale del listado de feature groups.

Nada cambia de comportamiento observable. Lo que cambia es que dejan de existir dos ramas de
código en `web` que nunca se tomaban, y tres tablas más nueve columnas que nadie leía.

## Por qué esta entrada existe y no hay un ADR

**No se crea ningún ADR, y es deliberado** (RF-10). Un ADR registra una decisión que elige entre
alternativas técnicas o establece una regla a futuro. Esta baja no hace ninguna de las dos: saca
del esquema algo que nunca tuvo código. El rastro de la decisión es **esta entrada más el
historial de git**.

Es una contradicción consciente con la postcondición de FG-7, que pedía "la decisión documentada
en un ADR": FG-7 se cierra, y con él su postcondición.

## Qué se eliminó

### Las tres tablas

| Tabla | Qué guardaba |
|---|---|
| `external_integration_config` | Credenciales y configuración de la integración por actor |
| `external_project` | Mapeo proyecto local ↔ proyecto remoto, con su `prefix` de filtrado |
| `external_sync_event` | Auditoría de cada corrida de sincronización y sus contadores |

Cada `DROP TABLE` se llevó su secuencia `*_id_seq`, sus índices y sus constraints. **`clients` y
`projects` no se tocaron**: las FK que desaparecieron son las *salientes* de las tablas borradas.

### Las nueve columnas

En `objectives` (6): `external_project_id`, `external_issue_id`, `external_issue_key`,
`external_url`, `external_raw_data` y **`last_synced_at`**.

> **`last_synced_at` merece nombrarse aparte.** Es la única columna de la integración **sin el
> prefijo `external_`**. Quien en el futuro busque restos con `grep external_` **no la va a
> encontrar**. Entró en la baja por su función, no por su nombre: la agregó la misma migración
> `20251015_04`, bajo el comentario "external integration columns".

En `objective_activity` (3): `external_reference_url`, `external_user_name`, `external_user_id`.

`objectives` queda con **14** columnas y `objective_activity` con **9**.

### El índice

`uk_objective_activity_external_comment` — índice **único parcial** sobre
`objective_activity(external_reference_url)` donde `type_of_activity = 'comment'`. Vivía en dos
lados: en la base (`20251015_06`) **y** declarado en el decorador `@Table` del modelo. Se fue de
los dos en el mismo cambio; si se hubiera ido solo de la base, `sequelize.sync()` habría
intentado recrearlo sobre una columna inexistente y **el arranque en `development` fallaría**.

### Los conteos que cambian

| Qué | Antes | Ahora |
|---|---|---|
| Clases en `allModels` (`@jiku/models`) | 29 | **26** |
| Migraciones en `api/db-upgrade/migrations/` | 100 | **101** |
| Tablas de la base `jiku` | 28 | **25** |

> Los documentos declaraban "28 modelos" y "95 migraciones": **ya estaban desactualizados antes
> de esta story** —S-001 agregó cinco migraciones y un modelo y nadie corrigió los conteos—. Se
> corrigieron de paso a los valores reales. El conteo de tablas (25) se derivó del 28 documentado
> menos las 3 borradas; **ese 28 no está verificado de forma independiente** y merece una
> revisión propia en FG-6.

## Pérdida de datos: es definitiva y sin respaldo

**Consecuencia asumida** (RF-6, CA-11). La migración **no hace respaldo previo**: no hay
`CREATE TABLE ... AS SELECT` ni dump parcial. Cualquier valor que se haya cargado a mano en estas
tablas o columnas **se pierde y no se recupera**.

El `down` recrea la **estructura vacía**. No recupera un solo dato. Dicho con precisión: la
migración es **reversible de esquema e irreversible de datos**.

Antes de aplicar, para saber qué se va a perder:

```sql
SELECT count(*) FROM objectives
 WHERE external_project_id IS NOT NULL OR external_url IS NOT NULL
    OR external_issue_id IS NOT NULL OR external_issue_key IS NOT NULL
    OR external_raw_data IS NOT NULL OR last_synced_at IS NOT NULL;

SELECT count(*) FROM objective_activity
 WHERE external_reference_url IS NOT NULL OR external_user_name IS NOT NULL
    OR external_user_id IS NOT NULL;
```

**Vale como verificación, no como respaldo.** Si el número no es 0 y a alguien le importa, el
respaldo hay que tomarlo aparte y antes.

## Procedimiento de despliegue

**Un solo release.** A diferencia de S-001, esta migración no toma decisiones sobre datos, no
cuenta nada y no hay nada que revisar entre pasos.

### La razón por la que el procedimiento importa

`core` **comparte los modelos** con la `api` vía `@jiku/models`, pero **no corre las
migraciones** (ADR-001; `docs/architectures/core/conventions/orm.md`:191). Las corre la `api` al
arrancar. En el instante en que la `api` nueva aplica el `DROP COLUMN`, cualquier `core` con la
imagen **anterior** falla en **toda lectura de Tarea** — su `findByPk` sigue pidiendo columnas que
ya no existen. Y `core` es el **único escritor** del producto.

### Pasos

1. Desplegar `api` y `core` **del mismo commit, en el mismo `docker compose up -d`**, recreando
   los dos contenedores.
2. La `api` corre `20260820_01_drop_external_integration` al arrancar.
3. Verificar con una **escritura** sobre Tarea: un `PATCH /api/objectives/{id}` que cambie
   `state`. Tiene que dar `200 OK`, la fila queda con el nuevo estado, y el log de `core` **no**
   tiene ningún `column ... does not exist`.

**El orden seguro es código nuevo primero, migración después** — que es exactamente lo que hace
la api al arrancar. El código nuevo tolera el esquema viejo (Sequelize simplemente no selecciona
las columnas que el modelo ya no declara); **lo inverso no**.

La ventana de riesgo es un `core` viejo que siga vivo después del arranque de la api nueva:
**segundos**, y se cierra recreando los dos contenedores juntos.

`web` puede ir en el mismo release y **no es precondición de nada**: sin sus cambios los campos
llegan `undefined` y las dos condiciones toman la rama que ya venían tomando.

> **Alternativa descartada:** partir en dos releases (modelos limpios primero, migración después)
> para tener ventana cero. No se hizo: dos despliegues para un cambio de prioridad media.

### Rollback, y su asimetría

| Escenario | Consecuencia |
|---|---|
| Revertir la migración **sin** revertir el código | **Inocuo.** Quedan columnas que los modelos no declaran; Sequelize no las selecciona |
| Revertir el código **sin** revertir la migración | **Es el modo de falla de arriba.** Código viejo contra esquema migrado: toda escritura de Tarea rota |

Y en los dos casos: **`db:migrate:undo` no recupera datos.**

```sh
npx sequelize-cli db:migrate:undo --config ./db-upgrade/config.js --migrations-path ./db-upgrade/migrations/
```

### Un entorno de desarrollo desde cero

`local/dump.sql` **todavía trae** las 3 tablas y las 9 columnas: es un snapshot viejo y no está
versionado. No hay nada que hacer al respecto. El orden **dump → migraciones → `sync()`** lo
corrige solo: la migración borra después de que el dump cargó, y `sync()` sin `alter` **crea lo
que falta y no borra lo que sobra**, así que no recrea nada. Precedente exacto: el dump todavía
trae `objectives.stage_id`, que `20260808_01_remove_stages` ya eliminó.

## Efecto de seguridad

Desaparece **`external_integration_config.auth_token_encrypted`**: una columna `TEXT` que
**declaraba cifrado sin que exista implementación de cifrado en el producto**. Con ella se va
`auth_email`. Eran el lugar donde habrían terminado credenciales de un sistema externo, en claro.

**No hay mejora de performance que prometer**, y conviene decirlo para que nadie la busque: son 6
y 3 columnas nulas menos por fila, y **un índice único parcial menos que mantener en cada
`INSERT`/`UPDATE` de `objective_activity`** —el único costo de escritura real que se elimina—.
`DROP COLUMN` en PostgreSQL es **metadata-only**: no reescribe la tabla y no requiere downtime.

## Lo que queda deliberadamente afuera

- **Las tres tablas de mail huérfanas** (`objective_mail_threads`, `requirement_mail_threads`,
  `inbound_mail_threads`) y sus tres modelos **no se tocan** (RF-11). Es el mismo caso —esquema
  sin código— pero siguen bajo FG-6, que antes tiene que decidir si se reutilizan para FG-2.
- **La migración baseline** que permita levantar una instalación desde cero sigue siendo de FG-6.
  Las 101 migraciones siguen asumiendo un esquema preexistente.

---

## Verificación contra base migrada

ADR-013 declara sin mitigación que *"los tests podrían pasar contra un esquema que las migraciones
nunca producirían"*: la suite corre contra el esquema de `sequelize.sync()`, **no** contra las
migraciones. Todo lo irreversible de esta story vive exactamente en ese punto ciego, así que
**CA-1, CA-2, CA-10, CA-11, CA-12 y CA-13 se verificaron a mano**.

**Cómo se armó el escenario.** PostgreSQL 15.4 en un contenedor propio y descartable. El estado
"antes" se construyó corriendo el `up()` de las migraciones **originales** (`20251015_01` a `_07`
y `20251230_01`), **no** el `down()` de la nueva: así el round-trip se compara contra el DDL de
origen de verdad y no contra sí mismo. Con datos cargados: una fila en cada una de las tres
tablas, un `objectives.external_url` no nulo y un `objective_activity.external_reference_url` no
nulo. Sin datos, TS-21, TS-22 y TS-31 no probarían nada.

**Resultado: 28 aserciones, todas en verde.**

| TS | Qué se verificó | Resultado |
|---|---|---|
| TS-17 | Las 3 tablas dan `to_regclass` `NULL`; `0` secuencias `external%` | PASS |
| TS-18 | Los 4 índices propios no existen | PASS |
| TS-19 | `objectives` con 14 columnas exactas, `objective_activity` con 9 | PASS |
| TS-20 | `last_synced_at` se fue, aunque no lleve el prefijo | PASS |
| TS-21 | Los conteos de filas de las dos tablas son idénticos antes y después | PASS |
| TS-22 | Snapshot fila por fila y campo por campo, idéntico | PASS |
| TS-23 | `clients` y `projects` intactas; `0` constraints huérfanas | PASS |
| TS-24 | Idempotencia: correrla de nuevo sobre una base ya migrada no falla | PASS |
| TS-25 | Con una vista dependiente, **aborta y no borra nada** (la transacción revierte: las 9 columnas y el índice siguen ahí) | PASS |
| TS-26 | `20251230_01` corre antes, encuentra `external_reference_url` y aplica su `UPDATE` de `visibility_level` | PASS |
| TS-27 | El `down` recrea las 3 tablas **vacías** con su estructura completa, y **coincide columna por columna con el DDL original** | PASS |
| TS-28 | El `down` recrea los 3 índices de `external_project` | PASS |
| TS-29 | Las 9 columnas vuelven, todas nullable, con sus tipos; y la FK de `external_project_id` | PASS |
| TS-30 | El `indexdef` y el `COMMENT ON INDEX` del índice único son **textualmente** los originales | PASS |
| TS-31 | El `down` **no recupera un solo dato** | PASS |
| TS-32 | La base migrada coincide campo por campo con los decoradores de los modelos | PASS |
| — | El ciclo `up → down → up` deja la base estable | PASS |

### La divergencia que la verificación encontró

**El `down` creaba `external_project.prefix` en la posición ordinal equivocada.** La primera
versión la declaraba *inline* en el `CREATE TABLE`, entre `config` y `created_at`. Pero en el
esquema real `prefix` **no viene de `20251015_02`**: la agrega `20251015_07` con un
`ALTER TABLE ADD COLUMN`, así que queda **última**, después de `created_at` y `updated_at`.

TS-27 lo detectó al comparar el round-trip contra el DDL de origen. **Se corrigió**: el `down`
ahora crea la tabla sin `prefix` y la agrega con su propio `ALTER TABLE`, replicando lo que hizo
`_07`. Con eso el round-trip es exacto.

No habría roto nada funcional —el orden de columnas solo afecta a `SELECT *` y a los `INSERT` sin
lista de columnas— pero es justo la clase de detalle que hace que un `down` no sirva cuando hace
falta, y es **la razón por la que esta verificación no es ceremonia**. Precedente: la Tarea 7 de
`S-001.base` encontró dos errores del mismo tenor.

### Lo que no se ejecutó, y por qué

- **TS-33** (despliegue conjunto `api` + `core` y un `PATCH` de Tarea) y **TS-34** (entorno de
  desarrollo desde cero con `deploy/local.sh`) requieren levantar el stack completo con el compose
  del producto. **Quedan como verificación del despliegue**, con los pasos de la sección
  "Procedimiento de despliegue" de arriba.
- La cobertura equivalente que **sí** se ejecutó: la suite completa de `api` (**694 tests, 0
  fallas**) y la de `core` (**216 tests, 0 fallas**) pasan contra los modelos limpios. La de
  `core` es la red de no-regresión de los 17 comandos sobre Tarea, que entran por el despachador
  y usan el modelo compartido (CA-14).

> **Precisión sobre la corrida de `core`.** Al cerrar esta story el árbol de trabajo tiene un
> archivo **sin versionar y ajeno a S-010**, `core/tests/commands/storage-signer.test.ts`, que
> falla por su cuenta: documenta un bug real del firmado de URLs de subida (el SDK de AWS v3 mete
> un checksum CRC32 del cuerpo vacío como query param firmado). Es de REQ-001 / S-006-S-007, no de
> esta story, y **no se commiteó acá**. Los 216 en verde son la suite sin ese archivo; con él,
> `npm test --workspace @jiku/core` devuelve 2 fallas que **no tienen relación con la baja de la
> integración**.
