# Jiku: mejoras de rendimiento en core y PostgreSQL (plano de queries)

**Fecha:** 2026-09-23 · **Base:** medición local del plano de queries (`jiku-queries`) por NATS con
el stack de `deploy/local.sh up` y el dump de `local/dump.sql`. **Ninguna medición tocó instancias
públicas.** El reporte de la línea base y los datos crudos están en `local/perf-baseline/`; lo del
cliente (SDK Go y CLI), en `../jiku-go/PERFORMANCE.md`.

Cada mejora de este documento está **medida por separado**, con las sentencias reales que core
ejecutó durante la línea base (extraídas del log de PostgreSQL) y con scripts aislados, sin tocar el
código de core. La §4 combina esas mediciones en una proyección por query, que es una estimación y
hay que validarla con un prototipo.

---

## 0. Estado (2026-09-23): qué se implementó y qué rindió

**De punta a punta, contra la línea base original: mediana −19,7 %, y las 38 queries del benchmark
mejoran** (entre −6 % y −72 %). Medido con A/B alternado, 4 corridas por lado, la traza apagada y
tráfico sostenido. El throughput con 20 requests concurrentes pasa de 69 a 87 req/s. Datos crudos
y detalle en `local/perf-baseline/RESULTS-2.md`.

| Mejora | Estado | Resultado medido (A/B, traza apagada) |
|---|---|---|
| P1 — índices del sort por defecto | Implementada | `worked-times.list` −56 %, `tasks.list` −26 % |
| C2 — includes en paralelo | Implementada | Fase de includes −47 % a −58 % |
| C3 — `timestamptz` como ISO | Implementada | `paginate` + `encode` −60 % a −75 % |
| P2/H3 — trigramas + `random_page_cost` 1,1 en la lectura | Implementada | `tasks.list/q` −43 %; ningún plan empeora |
| C5/H2 — consultas parametrizadas y preparadas con nombre | Implementada (`plan_cache_mode = auto`) | −12 % a −23 % en 10 queries |
| H1 — roles del caller sin el ORM (sin cache: CA-17 intacto) | Implementada | Mediana −9,2 % |
| C1 — cache de roles | **Descartada** | Contradice CA-17 de S-023 |
| C4/H4 — serializar una sola vez | **Descartada** | −4 % en páginas grandes (throughput +11 %) |
| H6 — saltear `sequelize.query()` en los SELECT | **Descartada** | Mediana −2,4 %, dentro del ruido (throughput +11 %) |
| Planes genéricos forzados | **No implementada, a decidir** | −16 % en `worked-times.list` 200 por persona, con el riesgo de planes genéricos peores para valores poco comunes |

**Las secciones 1 a 4 son el análisis inicial.** Sus ahorros y la proyección de la §4 se estimaron con
micro-benchmarks y **no se sostuvieron todos** de punta a punta: H1 rindió más de lo estimado, y C4 y
el `pg` directo, menos. La tabla de arriba es la medición real.

---

## 1. Dónde se va el tiempo de una query

Core + PostgreSQL es **entre el 61 % y el 85 % del tiempo de cada query** (mediana 65 %), medido de
punta a punta desde el SDK. Revisando cada sentencia, el tiempo de core se reparte así:

| Componente | Cuánto | Evidencia |
|---|---|---|
| **Ejecución real en PostgreSQL** | **0,01–0,3 ms** en 45 de las 55 sentencias | `EXPLAIN (ANALYZE, BUFFERS)` en sesión caliente, sobre las 55 sentencias distintas de la línea base |
| **Planificación en PostgreSQL** | 0,02–1,5 ms por sentencia; **supera a la ejecución** en 12 de 37 escenarios | Mismo `EXPLAIN`. `worked-times.list` persona+includes: plan 1,49 ms contra ejecución 0,66 ms |
| **Sentencias sin índice** | 1,4–6,5 ms | Seq Scan de la tabla entera + sort: `worked_times` (23 856 filas), `objectives` (2 670) |
| **Lectura del caller** (`User.findByPk`) | ~1 ms fijo por request | Tramo `auth.readCaller`; PostgreSQL lo ejecuta en 0,2 ms |
| **Parseo de filas en Node** | proporcional a filas × columnas | Timestamps a `Date`: +0,5–1,8 ms por sentencia de 200 filas |
| **Includes en serie** | la suma de todas las sentencias | `for … await` en `engine/include.ts` |
| **Serialización de la página** | hasta 6,9 ms en 250 KB | Cada item se serializa dos veces, y cada `Date` pasa por `toJSON()` en las dos |
| Sequelize sobre `pg` | 0,1–0,4 ms por sentencia | micro-benchmark `sql.js` |
| Espera por el pool | ≤ 0,3 ms | tramo `pool.acquire` |

**La conclusión es que la mayor parte del tiempo está en core (Node), no en la base.** PostgreSQL
pesa en cuatro escenarios: los tres sin índice y el conteo completo de `worked_times`.

### 1.1 Escenarios más lentos

| Escenario | total | core | Qué lo explica |
|---|---|---|---|
| `tasks.list` 200 + todos los includes | 36,5 ms | 24,0 | Sentencia principal sin índice de orden (3,0 ms de ejecución); 3 includes en serie (7,7 ms); 873 timestamps parseados a `Date` y serializados dos veces (7,5 ms de CPU) |
| `requirements.list` 200 + todos los includes | 23,7 | 15,4 | 4 includes en serie (6,6 ms); serialización (3,7 ms); planificación 1,0 ms |
| `worked-times.list` 200 por persona + includes | 17,3 | 11,0 | Planificación 1,49 ms > ejecución 0,66 ms; parseo de `Date`; serialización (3,4 ms) |
| `tasks.list` con `q` | 13,8 | 11,4 | `ILIKE '%…%'` sobre title y description: Seq Scan (5,5 ms) |
| `worked-times.list` sin filtro | 11,9 | 10,1 | Seq Scan de 23 856 filas + top-N sort (6,5 ms) para devolver 50 |
| `tasks.get` + includes | 8,2 | 6,8 | 4 sentencias en serie; planificación 0,67 ms > ejecución 0,70 ms |
| `tasks.list` sin filtro | 7,0 | 4,7 | Seq Scan de `objectives` + sort (1,4 ms) |
| Queries chicas (`clients.get`, `settings.list`, …) | 3–4 | 2–2,5 | La lectura del caller es la mitad de core (~1 ms) |

---

## 2. Mejoras en core

### C1. Cachear los roles del caller — **DESCARTADA**

> **Descartada (2026-09-23):** contradice CA-17 de S-023 (y CA-17 de REQ-005/S-017), que fija "sin
> cache de roles". Se prototipó y midió (−1 ms por request, `local/perf-baseline/RESULTS.md`), y se
> retiró del código. Se deja el análisis como registro.


**Dónde:** `authorize-caller.ts:462`, `queries/dispatcher.ts:104`.

Cada request lee `users` por PK con el ORM y por la conexión de escritura: ~1 ms fijo, **el 45–50 %
de core en las queries chicas**.

- Cache en memoria por `sub`, con TTL corto (por ejemplo 30 s), invalidado por el evento de auth que
  core ya consume (`events/auth/user-sync.ts`). Con la entrada en cache, la compuerta no toca la base.
- Si la lectura falla y no hay entrada, la compuerta sigue **fallando cerrada**, como hoy.
- **Riesgo:** un rol revocado sigue vigente hasta que vence el TTL o llega el evento. Es un cambio de
  seguridad (defensa en profundidad del plano de queries) y conviene decidirlo explícitamente.
- Si no se acepta la cache, al menos leer con SQL directo por la conexión de lectura:
  0,29–0,40 ms en lugar de ~1 ms.

### C2. Includes en paralelo — **−46 % a −59 % del SQL de includes**

**Dónde:** `queries/engine/include.ts:49`.

Las relaciones de colección son independientes entre sí; hoy se resuelven con `for … await`.
Medido con las sentencias reales y un pool de 10 (`par.js`):

| Caso | En serie | `Promise.all` |
|---|---|---|
| `tasks.list` 200 (3 includes) | 5,47 ms | **2,95 ms** |
| `requirements.list` 200 (4 includes) | 4,52 ms | **1,84 ms** |
| `tasks.get` (3 includes) | 1,71 ms | **0,82 ms** |

Bajo carga alta conviene acotar la concurrencia por request (2–3 sentencias a la vez), para que una
página pesada no se lleve el pool entero.

Con el mismo criterio, `count: true` puede correr el `COUNT` en paralelo con la consulta de filas
(`queries/engine/run.ts`): hoy va después, en serie.

### C3. Timestamps como string ISO, sin `Date` — **−0,5 a −1,8 ms por sentencia de 200 filas**

**Dónde:** `models/read.ts` (parsers de tipo de la conexión de lectura).

El driver convierte cada `timestamptz` en un `Date`, y después `JSON.stringify` lo vuelve a string
con `toJSON()`. Un parser que transforma el texto de PostgreSQL (`2026-08-07 12:50:50.66+00`)
directamente en el ISO que hoy sale por el bus (`2026-08-07T12:50:50.660Z`) **da una salida JSON
byte a byte idéntica** (verificado en `types.js`):

| Sentencia | Con `Date` | ISO directo |
|---|---|---|
| `tasks.list` 200, principal | 7,17 ms | **5,41 ms** |
| include `comments` (184 filas) | 3,06 ms | **2,61 ms** |
| `worked-times.list` 200 por persona | 3,58 ms | **2,08 ms** |

Requiere que la sesión de lectura esté en UTC (`SET TIME ZONE 'UTC'` al abrir la conexión) y cubrir
también `date` (OID 1082) si alguna ficha lo expone. Con Sequelize se hace registrando el parser en
su connection manager; con C5 es una opción del `Pool`.

Hay que revisar que ninguna ficha use el valor como `Date` antes de serializar: el cursor
(`engine/cursor.ts`) codifica las claves de orden, y ahí el formato tiene que ser el mismo.

### C4. Serializar una sola vez — **−63 % de la serialización (con C3)**

**Dónde:** `queries/engine/paginate.ts:51`, `bus/service.ts:31`.

`paginate` mide cada item con `JSON.stringify` para el presupuesto de bytes, y `encode` serializa la
respuesta entera otra vez. Con `Date`, cada timestamp paga `toJSON()` dos veces. Sobre la página
real de 200 tasks (257 707 bytes, 873 timestamps; `ser.js` y `ser2.js`):

| | Hoy (dos veces) | Una sola vez |
|---|---|---|
| Items con `Date` (como hoy) | 4,90 ms | 3,14 ms |
| Items con ISO (C3) | 2,23 ms | **1,82 ms** |

`paginate` puede conservar el string de cada item y el envelope de un list armarse concatenando
(`{"status":"success","data":{"items":[…],"page":{…}}}`). La salida es **idéntica byte a byte**
(verificado). Es la palanca principal para el **techo de concurrencia**: hoy core se satura en
~60 req/s con estas páginas porque la serialización corre en el único hilo.

### C5. Motor de lectura sobre `pg` directo, con sentencias preparadas — **−0,2 a −2,2 ms por sentencia**

**Dónde:** `models/read.ts`, `queries/engine/execute-sql.ts`, `queries/engine/build-sql.ts`.

La conexión de lectura **ya no usa el ORM**: registra cero modelos y ejecuta SQL crudo con
`db.query` (decisión documentada en `models/read.ts`). Sequelize solo aporta el pool y la
sustitución de `replacements`, que interpola los valores en el texto; por eso PostgreSQL planifica
cada sentencia desde cero. Medido con las sentencias reales (`sql.js`, 400 ejecuciones):

| Sentencia | Sequelize (hoy) | `pg` texto | `pg` preparada |
|---|---|---|---|
| `clients.list` (5 filas) | 0,55 ms | 0,36 | **0,27** |
| `users` por PK | 0,40 | 0,29 | **0,24** |
| `tasks.list` (51 filas) | 1,02 | 0,80 | **0,70** |
| include `responsiblePersons` (316 filas) | 2,11 | 1,88 | **1,19** |
| include `comments` (184 filas) | 2,83 | 2,75 | **2,06** |
| `worked-times.list` 200 por persona | 4,78 | 4,47 | **2,25** |

Qué implica:

- `build-sql` pasa a emitir parámetros posicionales (`$1…`), y los `IN (:ids)` a `= ANY($1)`, para
  que el texto no dependa de la cantidad de ids y el plan se reuse.
- Sentencias con nombre por hash del texto, con un LRU por conexión: las combinaciones de
  filtro/sort son finitas, pero no pocas.
- **Incompatible con PgBouncer en modo transacción**, si algún despliegue lo usa.
- `statement_timeout` y el mapeo de `57014` a `query_timeout` se conservan: son del servidor y del
  código de error, no de Sequelize.
- Es el cambio más grande de este documento. Se puede hacer por partes: primero solo las sentencias
  fijas (lectura del caller, `get` por id, includes), que son las de mayor reuso.

### C6. Menor

- **`meta.describe`:** su respuesta depende solo de las fichas. Se puede calcular una vez al
  arrancar y reusar el buffer serializado (~0,3 ms de CPU por request más la serialización de
  18 KB).
- **Capacidad:** más réplicas de core. Los servicios micro ya usan queue group (`queue: spec.name`
  en `bus/service.ts`), así que el bus reparte solo. Es la forma inmediata de subir el techo de
  ~60 req/s mientras se hacen C3–C4.

---

## 3. Mejoras en PostgreSQL

Todas probadas dentro de `BEGIN … ROLLBACK`: la base quedó sin cambios. Van en una migración en
`api/db-upgrade/migrations/`.

### P1. Índices para el orden por defecto — **las mayores ganancias individuales**

Un `list` sin filtro cuyo sort default no tiene índice lee y ordena **la tabla entera** para devolver
50 filas, y su costo crece linealmente con los datos.

| Índice | Escenario | Hoy (sentencia en Node) | Con índice |
|---|---|---|---|
| `worked_times (date DESC, id DESC)` | `worked-times.list` sin filtro | 6,78 ms | **0,69 ms** (−90 %) |
| `objectives (created_at DESC, id DESC)` | `tasks.list` sin filtro | 2,16 ms | **0,69 ms** (−68 %) |
| (el mismo) | `tasks.list` 200 + includes, principal | 5,25 ms | **2,02 ms** (−62 %) |

```sql
CREATE INDEX CONCURRENTLY idx_worked_times_date_id ON worked_times (date DESC, id DESC);
CREATE INDEX CONCURRENTLY idx_objectives_created_id ON objectives (created_at DESC, id DESC);
```

Conviene hacer lo mismo con **todas** las fichas: cruzar el `defaults.sort` de `meta.describe` con
`pg_indexes`. En los datos actuales el resto de las tablas es chico (≤ 550 filas) y no se nota, pero
el patrón es el mismo.

### P2. Búsqueda `q` con trigramas — **5,5 → 0,7 ms, condicionado al planner**

`q` se traduce a `title ILIKE '%…%' OR description ILIKE '%…%'`, que no puede usar un btree.

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX CONCURRENTLY idx_objectives_title_trgm ON objectives USING gin (title gin_trgm_ops);
CREATE INDEX CONCURRENTLY idx_objectives_description_trgm ON objectives USING gin (description gin_trgm_ops);
-- y lo mismo en requirements, que también declara `q`
```

Con el tamaño actual **el planner prefiere igual el Seq Scan**: la mejora se midió forzando el plan
(BitmapOr, 0,7 ms). Con `random_page_cost = 1,1` lo eligió solo (2,9 ms), pero ese mismo cambio
empeoró otras sentencias en la misma prueba. **No lo recomiendo sin una medición dedicada.** El
índice rinde a medida que crecen las tablas; `CREATE EXTENSION` necesita el rol dueño de la base.

### P3. Índice de `people_objectives` por tarea

El include `responsiblePersons` filtra por `objective_id IN (…)`, y el índice existente empieza por
`person_id`, así que hoy es un Seq Scan (316 filas). Con los datos actuales no se midió ganancia
(1,17 → 1,13 ms); es preventivo, porque la tabla crece con cada asignación.

```sql
CREATE INDEX CONCURRENTLY idx_people_objectives_objective ON people_objectives (objective_id);
```

### P4. Revisar la configuración del servidor en producción

La base local tiene 19 MB y entra entera en `shared_buffers` (128 MB por defecto). Estos números no
dicen nada de un servidor con otra memoria o con disco frío. Vale revisar `shared_buffers`,
`effective_cache_size` y `work_mem` del servidor real, y `pg_stat_statements` para ver el ranking de
sentencias con carga real.

### Descartado

- **Armar el JSON en PostgreSQL** (`json_agg` + texto): medido, es **más lento** que parsear filas
  en Node en todas las sentencias probadas (por ejemplo, 5,93 contra 5,25 ms).
- **Conteos aproximados** (`reltuples`) para `count`: cambiaría el contrato (el total dejaría de ser
  exacto). `worked-times.list` con `count: "only"` ya usa un Index Only Scan (1,6–1,9 ms), así que
  queda como está.

---

## 4. Proyección por query

**Es una estimación**: suma los ahorros medidos por separado de cada palanca que aplica y descuenta
la superposición entre C3 y C4 (las dos tocan la serialización de fechas). La cifra real hay que
confirmarla con un prototipo y el mismo benchmark (`local/perf-baseline/tools/`).

| Escenario | Hoy (total / core) | Palancas | Estimado (total / core) | Mejora |
|---|---|---|---|---|
| Queries chicas (`clients.get`) | 3,3 / 2,2 ms | C1, C5 | ~2,1 / ~1,0 | **−35 %** |
| `tasks.list` sin filtro | 7,0 / 4,7 | C1, C4, C5, P1 | ~4,0 / ~1,7 | **−43 %** |
| `worked-times.list` sin filtro | 11,9 / 10,1 | C1, C4, C5, P1 | ~4,1 / ~2,3 | **−65 %** |
| `tasks.list` con `q` | 13,8 / 11,4 | C1, C5, P2 | ~6,5 / ~4,0 | **−53 %** (si el planner usa el índice) |
| `requirements.list` 200 + includes | 23,7 / 15,4 | C1, C2, C4, C5 | ~15 / ~7 | **−37 %** |
| `tasks.list` 200 + includes | 36,5 / 24,0 | C1–C5, P1 | ~22 / ~9,5 | **−40 %** |

Con la mejora de decodificación del SDK Go (`../jiku-go/PERFORMANCE.md` §4.5), las dos páginas
pesadas bajan a **~12 ms (−49 %)** y **~16 ms (−55 %)** de punta a punta.

Bajo carga, C3 + C4 + C5 bajan la CPU por request en core, que es lo que hoy fija el techo de
~60 req/s. Cuánto sube ese techo no se puede estimar con fiabilidad desde micro-benchmarks: se mide
con la prueba de concurrencia del benchmark.

### Orden sugerido

1. **P1** (índices de orden) y **C2** (includes en paralelo): los cambios más chicos, sin cambio de
   contrato, y con las mayores ganancias en las queries lentas.
2. **C1** (roles en cache), después de decidir el TTL, porque es un cambio de seguridad.
3. **C3 + C4** (fechas ISO y serialización única): bajan la CPU y el techo de concurrencia. Hay que
   probarlos contra los tests de forma de respuesta y de cursor.
4. **C5** (`pg` directo con sentencias preparadas): el más grande, por partes.
5. **P2** (trigramas), con una medición del planner sobre datos más grandes.

Cada uno es un cambio de código o de esquema que corresponde llevar por su REQ/story.

---

## 5. Otros hallazgos

- **Subred fija de la red local.** `docker-compose.local.yml` fija `172.28.0.0/16`, y el stack no
  levanta (`Pool overlaps with other one on this address space`) si otra red de Docker ya la usa,
  como pasó acá con la red de otro proyecto. Conviene que la subred sea configurable por `.env`,
  junto con `STORAGE_S3_ENDPOINT`, que depende de ella, y que `local.sh` nombre la causa y el
  arreglo en el mensaje de error.
- **`JIKU_EVENTS` no se crea en el primer `up`.** `local.sh` lo advierte, pero no lo crea. No afecta
  a las queries.

---

## 6. Cómo se midió

| Script (`local/perf-baseline/tools/`) | Qué mide |
|---|---|
| `main.go` + `analyze.py` | Línea base de punta a punta, 38 escenarios × 30 iteraciones, cruzada con el log de PostgreSQL por `traceId` |
| `data/explain-all/*.sql` + `data/explain-all.json` | Las 55 sentencias reales y su `EXPLAIN (ANALYZE, BUFFERS)` en sesión caliente |
| `nodebench/sql.js` | Costo por sentencia: Sequelize, `pg` texto, `pg` preparada (C5) |
| `nodebench/json.js` | Índices dentro de `BEGIN … ROLLBACK` y `json_agg` (P1, P2, descartado) |
| `nodebench/types.js` | Timestamps `Date` contra ISO directo, con verificación de salida idéntica (C3) |
| `nodebench/ser.js`, `ser2.js` | Serialización doble contra única, sobre la página real de 200 tasks (C4) |
| `nodebench/par.js` | Includes en serie contra `Promise.all` (C2) |

Los scripts de `nodebench/` corren desde el host contra la base local (`localhost:5432`), no desde el
contenedor de core, así que el viaje a la base es ligeramente distinto al de core. Las diferencias
entre variantes son comparables entre sí; los valores absolutos, no del todo con los de la §1.

---

## 7. Instrumentación agregada en core (sin commitear)

Apagada por defecto: sin `QUERY_TIMING=true` el camino de una request no cambia. La suite de core
pasa entera (2073 tests).

| Archivo | Cambio |
|---|---|
| `core/src/timing.ts` (nuevo) | Traza por request en `AsyncLocalStorage`; `span`/`spanSync`; hooks del pool; `tagSql`; headers de respuesta; log `[timing]`; monitor del event loop |
| `core/src/bus/service.ts` | Abre la traza por mensaje; tramos `decode`/`encode`; agrega los headers `Jiku-Timing`, `Jiku-Recv-At` y `Jiku-Resp-At` a la respuesta sin tocar el cuerpo |
| `core/src/queries/engine/execute-sql.ts` | Tramo `sql:<label>` con filas; con traza, prefija el SQL con `/* <traceId> <label> */` |
| `core/src/authorize-caller.ts` | Tramo `auth.readCaller` |
| `core/src/queries/dispatcher.ts` | Tramo `validate` |
| `core/src/queries/engine/run.ts` | Tramos `project` y `paginate` |
| `core/src/models/index.ts`, `models/read.ts` | Hooks `beforePoolAcquire` y `afterPoolAcquire` (`pool.acquire:write` / `pool.acquire:read`) |
| `core/src/index.ts` | Arranca el monitor del event loop |
| `deploy/docker-compose.local.yml` | Pasa `QUERY_TIMING`, `QUERY_TIMING_SQL` y `QUERY_TIMING_LOOP_MS` (default `false`) |

Variables:

- `QUERY_TIMING=true` — traza, log `[timing]` y headers.
- `QUERY_TIMING_SQL=true` — suma el SQL al log (queda solo en el log, nunca viaja en los headers).
- `QUERY_TIMING_LOOP_MS` — cada cuánto se loguea el retardo del event loop (30 000 por defecto).

Para cruzar con PostgreSQL: `ALTER SYSTEM SET log_min_duration_statement = 0` y buscar el comentario
`/* <traceId> … */` en el log. En el entorno local **sigue activo**; se revierte con
`ALTER SYSTEM RESET log_min_duration_statement; SELECT pg_reload_conf();`.
