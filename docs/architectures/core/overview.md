# Arquitectura: core

Consumidor NATS de Jiku: **el único servicio que escribe en la base de datos**. Atiende los
comandos que publica la api, valida las reglas de negocio y escribe. Desde REQ-006 atiende además
**el contrato de consultas del producto**, por una conexión de solo lectura. No expone HTTP y **no
valida tokens** — eso sigue siendo trabajo de la api; lo que sí hace, y solo en el plano de
consultas, es **leer roles** para decidir qué le recorta a cada caller.

- **Tipo:** worker (consumidor de bus) · **Lenguaje:** node (TypeScript, `strict`) · **Path:** `core/`
- **Expone:** **21 comandos** (`jiku-commands`) y **23 consultas sobre 16 recursos**
  (`jiku-queries`), request/reply sin JetStream, **dos micro servicios sobre una sola conexión**
- **Consume:** PostgreSQL `jiku` por **dos conexiones** —el usuario dueño para escribir, un rol de
  **solo lectura** para las consultas—, NATS, Zitadel (solo para su propio token)

## La decisión que define el servicio

**La lectura y la escritura están separadas por servicio y por credenciales.** `api` conecta con
un rol sin `INSERT`/`UPDATE`/`DELETE`; `core` conecta con el usuario dueño de la base
(`core/src/models/index.ts:11-16`). Es una decisión de infraestructura, no de estilo: no hay forma
de que la api escriba por accidente.

La consecuencia es que **core no tiene interfaz HTTP en absoluto**. No hay puerto, ni endpoints,
ni verbos, ni framework web. Su único contrato es el bus, y por eso está documentado en AsyncAPI
y no en OpenAPI: una spec de OpenAPI tendría que inventar rutas que no existen.

```
web / opus-web ──HTTP──> api ──NATS──> core ──escribe──> PostgreSQL
                          │                                  ▲
                          └──────────── lee ─────────────────┘
```

Lo que core devuelve al crear es **solo el `id`**. El contrato con los frontends es el recurso
completo con sus relaciones, así que la api relee la base después de que el comando responde.

## Estructura

**Dos planos sobre una sola conexión al bus.** Un proceso registra dos micro servicios con queue
groups distintos: `jiku-commands` para las escrituras y `jiku-queries` para las lecturas. La
separación vive en el token `{svc}` del subject y no anidada bajo el otro, porque dos queue groups
sobre subjects que se solapan entregan el mensaje a las DOS suscripciones y dos respuestas llegan al
mismo inbox — un `request()` devuelve la primera y **descarta la segunda en silencio**.

El plano de COMANDOS, tres capas sin solapamiento:

```
NATS ──> Consumer ──> Dispatcher ──> Command ──> base de datos (usuario DUEÑO)
         (conexión)   (transacción)  (valida y escribe)
```

El plano de CONSULTAS, tres capas y **ninguna transacción**:

```
NATS ──> service.ts ──> QueryDispatcher ──> Query.validate ──> Query.execute ──> engine ──> readDb
                        (2 compuertas,      (nunca toca        (delega en                 (SOLO
                         1 SELECT)           la base)           el motor)                 LECTURA)
```

```
core/
├── src/
│   ├── index.ts              # arranque: conecta la base, arranca el consumer, maneja señales
│   ├── logger.ts             # Winston
│   ├── bus/
│   │   ├── consumer.ts       # conexión, suscripción con queue group, drain al cerrar
│   │   └── dispatcher.ts     # resuelve el comando, abre la transacción, responde
│   ├── authorize-caller.ts   # la compuerta de método, COMPARTIDA por los dos planos
│   ├── commands/
│   │   ├── index.ts          # el registro único: agregar un comando es sumarlo a esta lista
│   │   ├── registry.ts       # matching por segmentos, extracción de params
│   │   ├── types.ts          # la interfaz Command y su contexto
│   │   ├── validate.ts       # validateWith (Joi) y pickPresent (edición parcial)
│   │   ├── clients/ projects/ tasks/ requirements/ times/ attachments/ files/
│   ├── queries/              # EL PLANO DE CONSULTAS
│   │   ├── index.ts          # el registro único de las 23 consultas
│   │   ├── registry.ts       # Map EXACTO: los patrones NO llevan {param}
│   │   ├── dispatcher.ts     # despachador de consultas: SIN transacción
│   │   ├── caller-class.ts   # rol -> clase (external/internal/connector)
│   │   ├── entity-type.ts    # la traducción de entityType, en UN lugar y como DATO
│   │   ├── types.ts          # ResourceSpec y toda la gramática de la ficha
│   │   ├── resources.ts      # el registro de las 16 fichas, del que deriva meta.describe
│   │   ├── engine/           # el motor genérico: NO conoce ningún recurso
│   │   ├── meta/             # meta.describe y la proyección de una ficha a su descripción
│   │   └── {recurso}/        # una carpeta por recurso: {r}-spec.ts + {r}-list.ts / {r}-get.ts
│   └── models/
│       ├── index.ts          # conexión del DUEÑO (escritura)
│       └── read.ts           # conexión de SOLO LECTURA (consultas), con statement_timeout propio
└── tests/
    ├── setup-env.ts          # levanta el PostgreSQL efímero ANTES de que Mocha cargue los tests
    ├── global-setup.ts       # crea el esquema y trunca; apaga el contenedor al final
    ├── helpers/dispatch.ts   # dispatch() y dispatchQuery(): los dos planos, por su despachador
    ├── commands/             # un archivo por módulo de dominio
    └── queries/              # un archivo por recurso, más los gates estructurales del contrato
```

### La transacción es del despachador, nunca del comando

`core/src/bus/dispatcher.ts:42-54`. El despachador abre la transacción, ejecuta el comando y hace
**commit si el reply es `success`, rollback en cualquier otro caso**.

Los comandos reciben la transacción en su contexto pero **no tienen acceso a `commit` ni
`rollback`**. Eso hace estructuralmente imposible dejar una escritura a medias por olvidarse un
rollback en una rama de error: un comando que responde `failure` con tres filas ya insertadas las
pierde todas sin tener que hacer nada.

### El despachador nunca lanza

`core/src/bus/dispatcher.ts:60-64`. Todo error inesperado se traduce a un `Reply` de falla.

Del otro lado hay una request esperando: quedarse sin contestar dejaría a la api colgada hasta su
timeout (`NATS_REQUEST_TIMEOUT_MS`, 5000ms por defecto) y el usuario vería un 503 en vez del error
real. El `consume()` del consumer tiene además una última red por si el despachador fallara al
fallar (`core/src/bus/consumer.ts:101-105`).

## Módulos de dominio

**La lista de módulos ya no describe solo `src/commands/`.** Los siete primeros son carpetas de
comandos, una por entidad, con un archivo por comando. El octavo —`queries`— es la **superficie de
lectura completa** y vive en `src/queries/`.

| Módulo | Comandos | Carpeta | Particularidad |
|---|---|---|---|
| `clients` | 2 | `commands/clients/` | "Actores" en la UI, `clients` en la base y en el bus |
| `projects` | 2 | `commands/projects/` | Traduce `properties` ↔ `key_value_pairs` |
| `tasks` | 3 | `commands/tasks/` | Tabla `objectives`. El edit calcula el historial a mano, antes de escribir |
| `requirements` | 6 | `commands/requirements/` | El historial lo calcula el hook `@BeforeUpdate` del modelo |
| `times` | 5 | `commands/times/` | Tope diario compartido entre horas trabajadas y ausencias. Desde REQ-007 suma `week-assigned-times.replace`, el reemplazo de la semana completa de la grilla |
| `attachments` | 1 | `commands/attachments/` | Borrado lógico del vínculo; el archivo lo retiene `files` |
| `files` | 2 | `commands/files/` | Firma PUT y GET contra S3. **La api no tiene credenciales de S3** |
| **`queries`** | — | **`src/queries/`** | **23 endpoints sobre 16 recursos.** Un motor genérico más una ficha por recurso |

**Son 21 comandos**, y el número sale de contar `src/commands/index.ts`, no de esta tabla: la suma
de la columna es la verificación, no la fuente.

Agregar un comando son tres pasos: el archivo bajo `src/commands/<entidad>/`, el registro en
`src/commands/index.ts`, y sus tests en `tests/commands/`. El `pattern` tiene que coincidir con el
subject de [`docs/apis/core.yaml`](../../apis/core.yaml).

### El plano de consultas

**Un motor genérico que sirve a cualquier recurso con ficha.** La ficha (`ResourceSpec`) es un
**dato**, no código: declara las cinco listas blancas del recurso —conjunto base, incluibles,
filtrables, ordenables y el recorte del modo externo— y el motor sabe cómo servirlas. **El motor no
conoce ningún recurso**, y hay un test estructural que lo verifica: ninguna línea de
`src/queries/engine/` puede nombrar uno.

Agregar una consulta son tres pasos: la ficha y el archivo bajo `src/queries/<recurso>/`, el registro
en `src/queries/index.ts`, y los tests en `tests/queries/`. **No hay que tocar `bus/`**:
`registerService` crea un endpoint por patrón desde `queryRegistry.patterns()`, así que sumar una
línea al registro alcanza para que aparezca en `nats micro info jiku-queries` con queue group y
contadores propios.

**El despachador de consultas NO abre transacción, y la ausencia es el contrato.** Una lectura no
necesita atomicidad, y una transacción por request tomaría y sostendría un snapshot por cada
consulta. Es el contraste deliberado con el de comandos.

**`meta.describe` devuelve el contrato como dato**, derivado de las mismas fichas que validan: todo
lo que declara ordenable se puede ordenar, y lo que no declara responde `invalid_fields`. No hay una
segunda copia que mantener, así que la descripción no puede desactualizarse.

**`models/read.ts` no registra los modelos a propósito**: dos instancias de Sequelize en el mismo
proceso se pelean las clases de `@jiku/models` y la segunda las reasigna. Por eso el plano de
consultas arma **SQL explícito** contra su conexión y no usa el ORM.

## En el plano de COMANDOS, core no sabe de roles, permisos ni usuarios finales

Es un corte deliberado y explica dónde vive cada regla de negocio del producto. **Vale para los 20
comandos y solo para ellos**: el plano de consultas sí resuelve una clase de caller desde
`users.roles` — ver la sección siguiente.

**El usuario que actúa viaja en el cuerpo**, en `creator` / `author` / `editor`. No se lee del
subject: el subject identifica al **service user de la api**, no a la persona, porque la api usa
un único service user para todas sus personas (`core/src/commands/types.ts:4-10`).

Esa confianza se apoya **enteramente** en la política de acceso del bus — el auth-callout de
Zitadel mintea los permisos de publicación según el rol del token, así que nadie más que la api
puede publicar estos comandos. **Si esa política falla, core no tiene segunda línea de defensa.**

> Desde REQ-005 hay una compuerta que autoriza al **caller del subject** contra `users.roles` antes
> de resolver el método, en los dos planos. **No cierra el hueco de arriba**: el canal de la api está
> exento de ella —sin la exención, un evento de autenticación perdido dejaría a la api sin fila en
> `users` y core rechazaría los 21 comandos con un 403—, y dentro de ese canal core sigue confiando
> en el `creator`/`author`/`editor` del cuerpo.

## En el plano de CONSULTAS, core SÍ lee roles

Y es la corrección más importante de este documento: la frase de arriba describía el servicio entero
hasta REQ-006 y hoy describe la mitad.

**Dos compuertas, un solo `SELECT` sobre `users`**, antes de resolver el método
(`core/src/queries/dispatcher.ts`):

1. **`authorizeWithRoles(caller, roles, method, 'queries')`** — *"¿puede ejecutar este método?"*.
   Rechazo: `caller_not_authorized`.
2. **`resolveCallerClass(roles)`** — *"¿qué le recorto?"*. Rechazo: `unknown_caller`.

Son **dos preguntas distintas** y unificar sus códigos sería un bug: la primera es sobre permiso, la
segunda sobre quién *es* el caller. Un caller sin fila en `users` recibe un **error**, nunca una
lista vacía — una lista vacía se leería como "no hay datos".

**Las tres clases** (gana la más restrictiva): `connector` —el service user de la api, que autoriza
por su cuenta—, `internal` —`admin` y `user`, sin recorte de filas por decisión explícita de la v1— y
`external` —`external-user`, que recibe lo que declare el recorte de cada ficha—.

**El recorte del modo externo se inyecta en el SQL y no hay forma de desactivarlo por payload.**
Declararlo en la ficha ES aplicarlo: el motor lo antepone al `WHERE` de los tres SQL —filas, COUNT y
`get`— y no existe ningún interruptor. Para los recursos que declaran "sin acceso", el corte ocurre
**antes de consultar**: cero SQL, cero filas, y `items: []` en vez de un error.

### Reglas que viven acá

| Regla | Dónde |
|---|---|
| Tope de 1440 min/día por persona, sumando trabajadas **y** ausencias | `times/worked-times.ts:80` · `times/unworked-times.ts:56` |
| Horas contra tarea **o** requisito, nunca ambos (`.oxor`) | `times/worked-times.ts:32` |
| El requisito tiene que pertenecer al proyecto | `times/worked-times.ts:66` · `tasks/tasks-new.ts:81` |
| El primero de `responsiblePersonIds` es el líder | `tasks/tasks-new.ts:106` · `requirements/requirements-new.ts:130` |
| Una incidencia no se resuelve sin conclusión | `requirements/requirements-resolve.ts:45-53` |
| Visibilidad automática de actividades: `state`/`title`/`description` públicas, el resto internas | `tasks/activity.ts:18` |
| Los adjuntos tienen que ser drafts propios, vivos y anclados a la entidad correcta | `tasks/tasks-comment.ts:56-77` y equivalentes |
| No se modifican semanas pasadas de la asignación semanal (C-36) | `times/week-assigned-times.ts` |

### Reglas que NO viven acá

Las que dependen del rol, del usuario final o del calendario están en la api: la ventana de carga
de horas (día actual + 10 previos) y quién puede imputar horas a otra persona. Core no puede
validarlas porque no sabe quién llama.

**Que no se modifiquen semanas pasadas de asignación (C-36) ya NO está acá:** con el comando 21
(S-032) esa regla se mudó a `times/week-assigned-times.ts`, y figura en la tabla de arriba. La
otra regla de la grilla —*solo `admin` la edita* (C-38)— tampoco vive en un comando: no depende del
payload, así que la resuelve el **mapa rol → método** de `authorize-caller.ts` antes de tocar el
dominio.

## Integraciones

| Integración | Para qué | Particularidad |
|---|---|---|
| **NATS** | Recibir comandos **y consultas** | **Dos micro servicios sobre una sola conexión**, cada uno con su queue group: `jiku-commands` se suscribe por patrón con `{param}` y `jiku-queries` con un endpoint EXACTO por consulta —ninguna consulta lleva `{param}`, así que ningún subject lleva `*`—. **No publica nada** |
| **Zitadel** | Su propio token de bus | Service user con key JSON. El token caduca en ~1h y se renueva solo; por eso no se pasa por variable de entorno |
| **PostgreSQL** | Escribir **y leer** | **Dos conexiones**: el usuario dueño para los comandos —reintenta 5 veces con 1s de espera antes de abortar— y un rol de **solo lectura** con pool propio y `statement_timeout` de 8000 ms para las consultas. Ese timeout es MENOR que el del caller (10000 ms), y esa desigualdad es lo que hace que la base corte primero y el motor pueda responder `query_timeout` en vez de dejar un timeout mudo del bus |

### El inbox va hasheado, el subject crudo

El `user-id` viaja **crudo** en el subject de comandos, pero el inbox usa un **hash** del user id
(sha256 → base32 sin padding → 16 caracteres en minúscula,
`packages/nats-protocol/src/index.ts:76-87`).

Tiene que dar exactamente lo mismo que el auth-callout, que es quien mintea el permiso. Y hay que
fijarlo al conectar (`inboxPrefix`): por defecto nats.js genera un `_INBOX.<aleatorio>` que ningún
permiso acotado autoriza, y **las respuestas nunca llegarían**.

El inbox va bajo el user id propio y no bajo el nombre del servicio, así que es **por réplica**:
dos réplicas de core con distinto service user no se roban las respuestas de los servicios que
llamen (`core/src/bus/consumer.ts:44-46`).

## Paquetes compartidos del monorepo

| Paquete | Qué aporta |
|---|---|
| `@jiku/models` | Los 26 modelos Sequelize. Compartidos con `api` para que no puedan divergir. El paquete **no abre la conexión**: cada servicio registra las clases en su propio Sequelize porque conectan con credenciales distintas |
| `@jiku/nats-protocol` | Gramática de subjects, formato de `Reply`, catálogo de códigos de error, hash del inbox |
| `@jiku/zitadel-auth` | Obtiene y renueva el access token del service user |

## Particularidades de este codebase

1. **`strict: true`, único entre los backends.** La api lo tiene apagado. Core además suma
   `noUnusedLocals`, `noUnusedParameters` y `noImplicitReturns` (`core/tsconfig.json:22-26`). No es
   casual: es el único servicio que escribe.
2. **El registry matchea por segmentos, no por regex** (`commands/registry.ts:9-17`). Los ids del
   protocolo pueden ser números (`clients.7.edit`) o strings de Zitadel
   (`requirements.3.subscriptors.<zitadel-user-id>.delete`), y un `.` dentro de un valor rompería
   una regex ingenua.
3. **Los tests entran por el despachador**, no por el `execute` de cada comando
   (`tests/helpers/dispatch.ts`). Cubren la transacción y el rollback, no solo la lógica.
4. **`sequelize.sync()` corre en `testing` y `development`** (`models/index.ts:56-62`). En
   producción no, pero significa que el esquema de desarrollo lo construye Sequelize y el de
   producción las migraciones de la api: **dos fuentes distintas** para el mismo esquema.
5. **Cada mensaje se procesa sin bloquear la llegada del siguiente**
   (`consumer.ts:97-105`): el `dispatch` no se espera dentro del `for await`. La concurrencia real
   la acota el pool de Sequelize, no el consumer.

## Limitaciones

1. **Un comando perdido es un comando perdido.** Sin JetStream no hay cola, ni reintento, ni
   persistencia, ni idempotencia. Si core está caído cuando la api publica, la request expira por
   timeout y **la operación no ocurrió**. No hay reconciliación posterior.
2. **La autorización del bus es la única defensa.** Ver arriba: core confía en el cuerpo sin
   verificar nada.
3. **Los mensajes de error son texto de interfaz** y están mezclados entre inglés y español, a
   veces en el mismo archivo (`times/worked-times.ts:44` en inglés, `:49` en español). Llegan al
   usuario final a través de la api.
4. **Tres códigos de error se emiten como literal** en vez de la constante del paquete:
   `resolution_required`, `worked_time_not_found`, `unworked_time_not_found`. El valor es correcto
   pero está duplicado a mano.
5. **Los `LOGGER_*` no están definidos en el compose.** El logger de producción arma dos transports
   de archivo con `filename: process.env.LOGGER_INFO_PATH` y `LOGGER_ERROR_PATH`
   (`logger.ts:26,36`), pero `deploy/docker-compose.yml:128-142` no define ninguna. En producción
   esos transports quedan con `filename: undefined`.
6. **Asimetría no explicada en el reemplazo de responsables.** `tasks` preserva la fila y su
   `createdAt` de las asignaciones que se mantienen (`tasks-edit.ts:151-166`); `requirements` borra
   todas y recrea (`requirements-edit.ts:158-174`). Sin comentario que lo justifique.

## Referencias

| Documento | Contenido |
|---|---|
| [`docs/apis/core.yaml`](../../apis/core.yaml) | Contrato AsyncAPI de los **21 comandos**. **Es la fuente de verdad**: ante una discrepancia con el código, manda el documento |
| [`docs/apis/core-queries.yaml`](../../apis/core-queries.yaml) | Contrato AsyncAPI de las **23 consultas sobre 16 recursos**, con las cinco listas blancas por recurso. **Es la fuente de verdad** con el mismo criterio. `meta.describe` es su reflejo en datos |
| [`docs/flows/consulta-por-el-bus.md`](../../flows/consulta-por-el-bus.md) | El recorrido completo de una consulta, de la publicación al cursor |
| [`docs/db-schemas/jiku.md`](../../db-schemas/jiku.md) | Esquema de la base compartida |
| [`docs/architectures/api/`](../api/) | El otro lado de la decisión: quien lee y publica |
