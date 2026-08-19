# Arquitectura: core

Consumidor NATS de Jiku: **el único servicio que escribe en la base de datos**. Atiende los
comandos que publica la api, valida las reglas de negocio y escribe. No expone HTTP y no valida
tokens ni roles — eso es trabajo de la api.

- **Tipo:** worker (consumidor de bus) · **Lenguaje:** node (TypeScript, `strict`) · **Path:** `core/`
- **Expone:** 17 comandos NATS, request/reply sin JetStream
- **Consume:** PostgreSQL `jiku` (lectura y escritura, usuario dueño), NATS, Zitadel (solo para su propio token)

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

Tres capas, cada una con una responsabilidad y sin solapamiento:

```
NATS ──> Consumer ──> Dispatcher ──> Command ──> base de datos
         (conexión)   (transacción)  (valida y escribe)
```

```
core/
├── src/
│   ├── index.ts              # arranque: conecta la base, arranca el consumer, maneja señales
│   ├── logger.ts             # Winston
│   ├── bus/
│   │   ├── consumer.ts       # conexión, suscripción con queue group, drain al cerrar
│   │   └── dispatcher.ts     # resuelve el comando, abre la transacción, responde
│   ├── commands/
│   │   ├── index.ts          # el registro único: agregar un comando es sumarlo a esta lista
│   │   ├── registry.ts       # matching por segmentos, extracción de params
│   │   ├── types.ts          # la interfaz Command y su contexto
│   │   ├── validate.ts       # validateWith (Joi) y pickPresent (edición parcial)
│   │   ├── clients/ projects/ tasks/ requirements/ times/
│   └── models/index.ts       # registra los modelos de @jiku/models con las credenciales del dueño
└── tests/
    ├── setup-env.ts          # levanta el PostgreSQL efímero ANTES de que Mocha cargue los tests
    ├── global-setup.ts       # crea el esquema y trunca; apaga el contenedor al final
    ├── helpers/dispatch.ts   # despacha un comando como si viniera del bus
    └── commands/             # un archivo por módulo de dominio
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

Los módulos son **carpetas bajo `src/commands/`**, una por entidad. Un archivo por comando.

| Módulo | Comandos | Carpeta | Particularidad |
|---|---|---|---|
| `clients` | 2 | `commands/clients/` | "Actores" en la UI, `clients` en la base y en el bus |
| `projects` | 2 | `commands/projects/` | Traduce `properties` ↔ `key_value_pairs` |
| `tasks` | 3 | `commands/tasks/` | Tabla `objectives`. El edit calcula el historial a mano, antes de escribir |
| `requirements` | 6 | `commands/requirements/` | El historial lo calcula el hook `@BeforeUpdate` del modelo |
| `times` | 4 | `commands/times/` | Tope diario compartido entre horas trabajadas y ausencias |

Agregar un comando son tres pasos: el archivo bajo `src/commands/<entidad>/`, el registro en
`src/commands/index.ts`, y sus tests en `tests/commands/`. El `pattern` tiene que coincidir con el
subject de [`docs/apis/core.yaml`](../../apis/core.yaml).

## Core no sabe de roles, permisos ni usuarios finales

Es un corte deliberado y explica dónde vive cada regla de negocio del producto.

**El usuario que actúa viaja en el cuerpo**, en `creator` / `author` / `editor`. No se lee del
subject: el subject identifica al **service user de la api**, no a la persona, porque la api usa
un único service user para todas sus personas (`core/src/commands/types.ts:4-10`).

Esa confianza se apoya **enteramente** en la política de acceso del bus — el auth-callout de
Zitadel mintea los permisos de publicación según el rol del token, así que nadie más que la api
puede publicar estos comandos. **Si esa política falla, core no tiene segunda línea de defensa.**

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

### Reglas que NO viven acá

Las que dependen del rol, del usuario final o del calendario están en la api: la ventana de carga
de horas (día actual + 10 previos), quién puede imputar horas a otra persona, y que no se
modifiquen semanas pasadas de asignación. Core no puede validarlas porque no sabe quién llama.

## Integraciones

| Integración | Para qué | Particularidad |
|---|---|---|
| **NATS** | Recibir comandos | Se suscribe a `{instance}.*.{svc}.{version}.>` con queue group `gestion`, así varias réplicas se reparten los mensajes. **No publica nada** |
| **Zitadel** | Su propio token de bus | Service user con key JSON. El token caduca en ~1h y se renueva solo; por eso no se pasa por variable de entorno |
| **PostgreSQL** | Escribir | Con el usuario dueño. Reintenta la conexión 5 veces con 1s de espera antes de abortar |

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
| `@jiku/models` | Los 28 modelos Sequelize. Compartidos con `api` para que no puedan divergir. El paquete **no abre la conexión**: cada servicio registra las clases en su propio Sequelize porque conectan con credenciales distintas |
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
| [`docs/apis/core.yaml`](../../apis/core.yaml) | Contrato AsyncAPI de los 17 comandos. **Es la fuente de verdad**: ante una discrepancia con el código, manda el documento |
| [`docs/db-schemas/jiku.md`](../../db-schemas/jiku.md) | Esquema de la base compartida |
| [`docs/architectures/api/`](../api/) | El otro lado de la decisión: quien lee y publica |
