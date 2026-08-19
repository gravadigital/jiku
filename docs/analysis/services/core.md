# Análisis de Importación: core

> Documento temporal del flujo de importación. Lo consume `/product-consolidate-services`
> para armar el PRD. La documentación definitiva vive en
> [`docs/architectures/core/`](../../architectures/core/), [`docs/apis/core.yaml`](../../apis/core.yaml)
> y [`docs/db-schemas/jiku.md`](../../db-schemas/jiku.md).

## Identificación

| | |
|---|---|
| **Nombre** | `core` (`@jiku/core` en el workspace) |
| **Tipo** | Backend (consumidor de bus — **sin HTTP**) |
| **Path** | `core/` — workspace del monorepo `jiku` |
| **Propósito** | Único servicio que **escribe** en la base. Atiende los comandos que publica la api en NATS, valida las reglas de negocio y escribe. |
| **Responsabilidad** | Ser el guardián de la integridad de la escritura: una transacción por comando, todo o nada. Es también donde vive el vocabulario nuevo del producto sin tocar el esquema de la base. |

### Stack

| Capa | Tecnología | Versión |
|---|---|---|
| Runtime | Node | ≥ 24 (imagen `node:24.12-alpine3.23`) |
| Lenguaje | TypeScript | 5.9 — `strict: true` |
| Framework HTTP | **ninguno** | no expone puerto ni endpoints |
| Bus | NATS (`nats`) | 2.29 — request/reply, sin JetStream |
| Validación | Joi | 18 — un esquema por comando |
| ORM | Sequelize + sequelize-typescript | 6.37 / 2.1 |
| Base de datos | PostgreSQL | conexión de **lectura y escritura** (usuario dueño) |
| Auth | `@jiku/zitadel-auth` | service user con key JSON, token auto-renovado |
| Logging | winston | 3.19 |
| Testing | mocha + should + sinon, nyc | 11.7 |
| Config | dotenv | 17.2 |

**`strict: true` es propio de este servicio.** La api lo tiene apagado (registrado en su
convención `_base`). Core lo activa y además suma `noUnusedLocals`,
`noUnusedParameters` y `noImplicitReturns` (`core/tsconfig.json:22-26`). Es el servicio de
backend con el tipado más estricto del monorepo, y no es casual: es el único que escribe.

### Paquetes compartidos del monorepo

| Paquete | Qué aporta |
|---|---|
| `@jiku/models` | Los 28 modelos Sequelize. Compartidos con `api` para que no puedan divergir. El paquete **no abre la conexión**: core registra las clases en su propio Sequelize con las credenciales del dueño (`core/src/models/index.ts:17-27`) |
| `@jiku/nats-protocol` | El contrato del bus: gramática de subjects, formato de `Reply`, catálogo de códigos de error, hash del inbox |
| `@jiku/zitadel-auth` | Obtiene y renueva el access token del service user con el que core se autentica en el bus |

## La decisión que define el servicio: es el único que escribe

Es la mitad de la decisión estructural del producto (la otra mitad es que la api solo lee), y
no está en ningún catálogo de convenciones.

- Core conecta con el **usuario dueño de la base** (`core/src/models/index.ts:11-16`), a
  diferencia de la api que usa un rol sin `INSERT`/`UPDATE`/`DELETE`.
- Su única interfaz es el bus: **no expone HTTP**. No hay puerto, ni endpoints, ni verbos, ni
  framework web. Por eso su contrato es AsyncAPI y no OpenAPI.
- Lo que devuelve al crear es **solo el `id`** (`success({ id })`). El contrato con los
  frontends es el recurso completo con sus relaciones, así que la api relee la base después
  del comando.

### La transacción es del despachador, nunca del comando

`core/src/bus/dispatcher.ts:42-54`. El despachador abre la transacción, ejecuta el comando y
hace **commit si el reply es `success`, rollback en cualquier otro caso**.

Los comandos reciben la transacción en su contexto pero **no tienen acceso a `commit` ni
`rollback`**. No es un detalle de estilo: hace estructuralmente imposible dejar una escritura a
medias por olvidarse un rollback en una rama de error. Un comando que responde `failure` con
tres filas ya insertadas las pierde todas, sin que el comando tenga que hacer nada.

### El despachador nunca lanza

`core/src/bus/dispatcher.ts:60-64`. Todo error inesperado se traduce a un `Reply` de falla.

Del otro lado hay una request esperando respuesta: quedarse sin contestar dejaría a la api
colgada hasta su timeout (`NATS_REQUEST_TIMEOUT_MS`, 5000ms por defecto), y el usuario vería
un 503 en lugar del error real. El `consume()` del consumer tiene además una última red por si
el despachador fallara al fallar (`core/src/bus/consumer.ts:101-105`).

## Core no sabe de roles, permisos ni usuarios finales

Es un corte deliberado, y es lo que explica dónde vive cada regla de negocio del producto.

**Core confía en el cuerpo del mensaje.** El usuario que actúa viaja en `creator` / `author` /
`editor`, no se lee del subject. El subject identifica al **service user de la api**, no a la
persona: la api usa un único service user para todas sus personas
(`core/src/commands/types.ts:4-10`).

Esa confianza se apoya **enteramente** en la política de acceso del bus: el auth-callout de
Zitadel mintea los permisos de publicación según el rol del token, así que nadie más que la api
puede publicar estos comandos. **Si esa política falla, core no tiene segunda línea de defensa.**

**Consecuencia para el PRD:** las reglas que dependen del rol, del usuario final o del
calendario NO están acá. Están en la api (ventana de carga de horas, quién imputa a otra
persona, semanas pasadas). Core valida lo que se puede validar sin saber quién llama.

### Reglas de negocio que SÍ viven en core

Candidatas a requisitos explícitos del PRD:

| Regla | Dónde | Detalle |
|---|---|---|
| Tope diario de 24 h por persona | `times/worked-times.ts:80` · `times/unworked-times.ts:56` | 1440 minutos, sumando trabajadas **y** no trabajadas. El mensaje informa los minutos disponibles |
| Horas contra tarea **o** requisito, no ambos | `times/worked-times.ts:32` | `.oxor('taskId', 'requirementId')` |
| El requisito tiene que ser del proyecto | `times/worked-times.ts:66` · `tasks/tasks-new.ts:81` | `requirement_project_mismatch` |
| El primero de la lista es el líder | `tasks/tasks-new.ts:106` · `requirements/requirements-new.ts:130` | El **orden de `responsiblePersonIds` es información**, no un detalle |
| Una incidencia no se resuelve sin conclusión | `requirements/requirements-resolve.ts:45-53` | Acepta la del payload o la ya guardada |
| Visibilidad automática de actividades | `tasks/activity.ts:18` | `state`, `title`, `description` → `public`; el resto → `internal`. **Solo los comentarios permiten elegir** |
| Semántica de edición parcial | `commands/validate.ts:23-33` | ausente = no se toca · valor = reemplaza · `null` = vacía · `null` en obligatorio = falla |
| Los adjuntos tienen que ser drafts propios y vivos | `tasks/tasks-comment.ts:56-77` y equivalentes | Del propio `uploadedBy`, anclados a la entidad correcta, `retentionStatus` activo. Si uno falla, **se descarta toda la escritura** |

### Reemplazo total de responsables

En `tasks` y `requirements`, mandar `responsiblePersonIds` **reemplaza la lista completa**; no
agrega. Con una diferencia entre los dos que conviene notar:

- `tasks`: borra los que no vienen y hace `upsert` de los que sí, **preservando la fila y su
  `createdAt`** (`tasks/tasks-edit.ts:151-166`)
- `requirements`: borra **todos** y recrea (`requirements/requirements-edit.ts:158-174`), así
  que se pierde el `createdAt` de las asignaciones que se mantienen

No hay comentario que justifique la asimetría. **A confirmar en consolidación** si es
intencional o deuda.

## Traducciones contrato ↔ base

Core es donde vive el vocabulario nuevo del producto sin tocar el esquema. El criterio declarado
es explícito: *"la base no se toca: el nombre nuevo es del contrato, no del almacenamiento"*
(`commands/projects/properties.ts:15-17`).

| Contrato / bus | Base de datos | Dónde traduce |
|---|---|---|
| `task`, `taskId` | `objectives`, `objective_id` | en cada comando |
| `properties: [{code, value}]` | `key_value_pairs: {code: value}` | `projects/properties.ts:51` |
| `priority: 'alta'` (enum) | `priority: 3` (integer) | `tasks/priority.ts:43` |
| `responsiblePersonIds` | `personIds` | en cada comando |

### El escape transitorio de `priority`

Documentado en el código y en el contrato. La columna `objectives.priority` aceptaba 0-5 y el
enum del bus tiene 5 valores, así que la traducción ida y vuelta colapsaría el 5 en 4.

La api manda el número original en `priorityValue` y core lo usa tal cual, ignorando `priority`
(`tasks/priority.ts:43-48`). **Desaparece cuando la web hable en nombres de prioridad.**

`requirements.priority`, en cambio, SÍ es un enum en la base: esa tabla ya migró. La traducción
es solo para tasks.

## Correcciones a bugs de la api

Tres comportamientos que core cambió a propósito respecto de lo que hacía la api. Son
**candidatos a requisito** porque cambian lo que el usuario ve:

1. **Comentar sobre una tarea inexistente.** La api no verificaba que existiera, así que fallaba
   por la foreign key con un 500. Core valida y responde `objective_not_found`
   (`tasks/tasks-comment.ts:33-39`).
2. **Editar un proyecto sin mandar `endDate`.** El `PATCH /projects/:id` de la api exigía casi
   todos los campos y **vaciaba `endDate`** cuando no venía. Core deja los campos ausentes como
   estaban (`projects/projects-edit.ts:26-28`).
3. **Resolver un requisito.** Era parte del `PATCH`, mezclado con la edición. Ahora es un comando
   propio, así que la transición a `resuelto` no puede ocurrir por accidente en un edit
   (`requirements/requirements-resolve.ts:14-20`).

## Superficie: 17 comandos en 5 módulos

Contrato completo en [`docs/apis/core.yaml`](../../apis/core.yaml) (AsyncAPI 2.6).

### Gramática de subjects

```
{instance}.{user-id}.{svc}.{version}.{comando}
dev.323332022539911171.gestion.v1.clients.new
```

Core se suscribe a `{instance}.*.{svc}.{version}.>` con **queue group `gestion`**, así que el
wildcard cubre a cualquier caller y varias réplicas se reparten los mensajes en lugar de
procesar cada una lo mismo (`core/src/bus/consumer.ts:69-70`).

El `user-id` va **crudo** en el subject; el inbox, en cambio, usa un **hash** del user id
(sha256 → base32 sin padding → 16 caracteres en minúscula). Tiene que dar exactamente lo mismo
que el auth-callout, que es quien mintea el permiso: sin fijar `inboxPrefix` al conectar, las
respuestas nunca llegarían (`packages/nats-protocol/src/index.ts:64-87`).

### Los comandos

| Módulo | Comandos | Detalle |
|---|---|---|
| `clients` | `clients.new`, `clients.{id}.edit` | "Actores" en la UI, `clients` en la base y en el bus |
| `projects` | `projects.new`, `projects.{id}.edit` | Con traducción de `properties`. Valida el actor si viene |
| `tasks` | `tasks.new`, `tasks.{id}.edit`, `tasks.{id}.comment` | Tabla `objectives`. El edit registra historial de 6 campos |
| `requirements` | `requirements.new`, `.{id}.edit`, `.{id}.resolve`, `.{id}.comment`, `.{id}.subscriptors.new`, `.{id}.subscriptors.{userId}.delete` | El hook `@BeforeUpdate` del modelo calcula el `activityLog` y las marcas de tiempo de estado |
| `times` | `worked-times.new`, `worked-times.{id}.delete`, `unworked-times.new`, `unworked-times.{id}.delete` | Tope diario compartido entre trabajadas y no trabajadas |

### Historial de actividad

Dos mecanismos distintos, que conviene no confundir:

- **`tasks`**: core lo calcula a mano, **antes de escribir** porque necesita el valor anterior.
  Seis campos rastreados (`title`, `estimatedFinishDate`, `state`, `area`, `priority`,
  `description`). El paso a vacío no se registra, **salvo `estimatedFinishDate`**, porque es el
  historial que espera ver la web (`tasks/tasks-edit.ts:103-134`).
- **`requirements`**: lo calcula el hook `@BeforeUpdate` del modelo en `@jiku/models`, y core
  solo persiste lo que quedó en `activityLog` (`requirements/requirements-edit.ts:90-109`).

### Formato de respuesta

Igual para los 17 comandos (`packages/nats-protocol/src/index.ts:116-129`):

```json
{ "status": "success", "data": { "id": 7 } }
{ "status": "failure", "errorCode": "project_not_found", "errorMessage": "Project not found" }
```

**El `status` decide la transacción.** Las creaciones devuelven solo el `id`; las ediciones y
borrados, nada.

## Interfaces

### Expone

| Tipo | Detalle |
|---|---|
| `message_bus` | 17 comandos NATS, request/reply sin JetStream. Suscripción con queue group para varias réplicas |

**Nada más.** Sin HTTP, sin eventos publicados, sin webhooks, sin tareas programadas.

### Consume

| Tipo | Target | Detalle |
|---|---|---|
| `database` | PostgreSQL `jiku` | **Lectura y escritura** con el usuario dueño. 28 tablas vía `@jiku/models`. Reintenta la conexión 5 veces con 1s de espera antes de abortar |
| `message_bus` | NATS | Se suscribe; no publica. Creds de sentinel + token de service user |
| `external_service` | Zitadel (OIDC) | **Solo para su propio token de bus.** No valida tokens de usuario ni lee roles de personas |

## Flujos detectados

Core es el **extremo receptor** de todos los flujos de escritura del producto. No inicia
ninguno.

```
web / opus-web ──HTTP──> api ──NATS──> core ──> PostgreSQL
                          │                        ▲
                          └────── lee ─────────────┘
```

| Flujo | Origen | Destino | Detalle |
|---|---|---|---|
| Escritura de cualquier entidad | `api` | `core` | 17 formas de comando. La api publica y espera; core valida, escribe y responde |
| Relectura post-comando | `api` | PostgreSQL | Core devuelve solo el `id`; la api relee para rearmar el recurso completo |
| Token de bus | `core` | Zitadel | Pide el token con la key del service user y lo renueva solo (caduca en ~1h) |

**Un solo consumidor real hoy:** la api. El subject usa un wildcard para el caller, así que
sumar otro publicador es una decisión de política del bus, no un cambio de código en core.

## Limitaciones que afectan al producto

Para el PRD, en orden de impacto:

1. **Un comando perdido es un comando perdido.** Sin JetStream no hay cola, ni reintento, ni
   persistencia, ni idempotencia. Si core está caído cuando la api publica, la request expira
   por timeout y **la operación no ocurrió**. No hay reconciliación posterior.
2. **La autorización del bus es la única defensa.** Core confía en el `creator`/`author`/`editor`
   del cuerpo sin verificar nada. Si la política del auth-callout falla, cualquiera que pueda
   publicar puede escribir como cualquier persona.
3. **`sequelize.sync()` en `testing` y `development`** (`core/src/models/index.ts:56-62`). En
   producción no corre, pero significa que el esquema de desarrollo lo construye Sequelize y el
   de producción las migraciones de la api: **dos fuentes distintas** para el mismo esquema.
4. **Los mensajes de error son texto de interfaz**, y están mezclados entre inglés y español
   —a veces en el mismo archivo (`times/worked-times.ts:44` en inglés, `:49` en español). Llegan
   al usuario final a través de la api. Es inconsistencia heredada que no se unificó porque los
   frontends muestran algunos directamente.
5. **Tres códigos de error se emiten como literal** en vez de la constante del paquete:
   `resolution_required`, `worked_time_not_found`, `unworked_time_not_found`. El valor es
   correcto pero está duplicado a mano.
6. **`unknown_command` no tiene mapeo a HTTP en la api**: cae en un 500 genérico.
7. **El logger de producción escribe a archivo** con rutas de variables de entorno
   (`LOGGER_INFO_PATH`, `LOGGER_ERROR_PATH`) que **el compose no define**
   (`deploy/docker-compose.yml:128-142`). Sin ellas, los transports de archivo de Winston
   quedan con `filename: undefined`.

## Testing

136 casos en 5 archivos, **contra una base PostgreSQL real** sin mocks de Sequelize.

| Aspecto | Cómo |
|---|---|
| Base | PostgreSQL efímero en Docker, levantado por `tests/setup-env.ts` |
| Por qué ahí | `src/models/index.ts` construye el Sequelize **al importarse**, leyendo `process.env` en ese momento. Un `mochaGlobalSetup` correría demasiado tarde |
| Esquema | `sequelize.sync()` + `TRUNCATE ... RESTART IDENTITY CASCADE` una vez por corrida |
| Entrada | El helper `dispatch()` arma el subject completo y entra **por el despachador**, así que los tests cubren la transacción, no solo el `execute` |
| En CI | `CI=true` usa la base del pipeline en lugar de levantar contenedor |
| Escapes | `KEEP_DB=true` deja el contenedor vivo entre corridas |
| Zona horaria | `TZ=UTC` fijado en `setup-env.ts:16` |

Que los tests entren por el despachador es la decisión que más cubre: verifica el
comportamiento de punta a punta —incluido el rollback— y no el de cada `execute` aislado.

## Configuración

Sin validación de esquema: `dotenv` + `process.env` directo, y **sin asserts al arrancar**
(a diferencia de la api, que tiene dos).

| Variable | Para qué | Si falta |
|---|---|---|
| `POSTGRESQL_DB`, `_USER`, `_PASSWORD`, `_HOST`, `_PORT` | Conexión con el usuario dueño | Falla el arranque tras 5 reintentos |
| `NATS_URL` | El bus | Default `nats://localhost:4222` |
| `NATS_CREDS` | Creds del sentinel | Se conecta sin ese autenticador |
| `ZITADEL_SERVICE_USER_KEY_B64` | Key del service user, en base64 | **La conexión al bus se rechaza**: las creds del sentinel no conceden permisos solas |
| `ZITADEL_ISSUER_URL`, `ZITADEL_PROJECT_ID` | Dónde pedir el token y qué proyecto tiene los roles | No se puede obtener el token |
| `NATS_INSTANCE`, `NATS_SERVICE_NAME`, `NATS_PROTOCOL_VERSION` | Segmentos del subject | Defaults `dev` / `gestion` / `v1` |
| `NATS_USER_ID` | Fallback del inbox sin service user (solo tests) | Cae en `SERVICE_NAME` |
| `LOG_COMMANDS` | Imprime cada comando y su respuesta | Apagado. **Encenderlo loguea datos de negocio** |
| `LOGGER_*` | Rutas y niveles de los archivos de log en producción | Los transports quedan sin `filename` (ver limitación 7) |

## Información para la consolidación del PRD

### Vocabulario

Core es el eslabón donde el vocabulario del producto se separa del de la base. Sumado a lo
detectado en `api`:

| UI / producto | HTTP / base | Bus (core) |
|---|---|---|
| Actor | `client` | `client` |
| Tarea | `objective` | `task` |
| Etapa | (eliminada de la base) | no existe |

El bus ya usa `task`; la base sigue en `objectives`. **La dirección del cambio está decidida y a
medio camino.**

### Preguntas abiertas para consolidación

1. **¿La asimetría de reemplazo de responsables es intencional?** `tasks` preserva el
   `createdAt` de las asignaciones que se mantienen, `requirements` no.
2. **¿El tope de 24 h es un requisito de producto o un guardarraíl técnico?** Está duplicado en
   dos archivos como constante local (`DAILY_LIMIT_MINUTES`), no compartido.
3. **¿La visibilidad automática de actividades es la regla definitiva?** Está declarada como
   "reglas de negocio de S-002" en `tasks/activity.ts:5-8`, con una historia que ya no existe en
   `docs/stories/`.
4. **¿Se cataloga formalmente el `ErrorCode`?** El contrato dice explícitamente que el catálogo
   no está cerrado, y hay 4 códigos declarados que ningún comando emite hoy
   (`invalid_date_range`, `invalid_state_transition`, `stage_not_found`, y `unknown_command` que
   no tiene mapeo HTTP).
5. **¿Se unifica el idioma de los mensajes de error?** Llegan al usuario final y hoy están
   mezclados.

### Discrepancia detectada fuera de core

`deploy/docker-compose.yml:129` dice *"Core es el único que escribe, y el que corre las
migraciones"*. Las migraciones viven en `api/db-upgrade/migrations/` y las corre la api al
arrancar; core no las toca. La primera mitad del comentario es correcta, la segunda no.

## Referencias a la documentación generada

| Documento | Qué contiene |
|---|---|
| [`docs/architectures/core/`](../../architectures/core/) | Manifest, overview y las convenciones custom del servicio |
| [`docs/apis/core.yaml`](../../apis/core.yaml) | Contrato AsyncAPI 2.6 de los 17 comandos. **Verificado contra el código en este análisis**: los 17 channels, los `required`, los defaults, los enums y los 21 códigos de error coinciden |
| [`docs/db-schemas/jiku.md`](../../db-schemas/jiku.md) | Esquema de la base compartida. Ya documenta a core como el único escritor |
