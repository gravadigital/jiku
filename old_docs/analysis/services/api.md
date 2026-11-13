# Análisis de Importación: api

> Documento temporal del flujo de importación. Lo consume `/product-consolidate-services`
> para armar el PRD. La documentación definitiva vive en
> [`docs/architectures/api/`](../../architectures/api/), [`docs/apis/api.yaml`](../../apis/api.yaml)
> y [`docs/db-schemas/jiku.md`](../../db-schemas/jiku.md).

## Identificación

| | |
|---|---|
| **Nombre** | `api` (`@jiku/api` en el workspace) |
| **Tipo** | Backend (servicio HTTP) |
| **Path** | `api/` — workspace del monorepo `jiku` |
| **Propósito** | Única puerta HTTP del producto. Autentica, autoriza por rol y por entidad, **lee la base directamente** y convierte toda mutación en un comando publicado en NATS. |
| **Responsabilidad** | Contrato HTTP estable para los dos frontends. Es la dueña del esquema (corre las migraciones) y la única que conoce roles y usuarios finales. |

### Stack

| Capa | Tecnología | Versión |
|---|---|---|
| Runtime | Node | ≥ 24 (imagen `node:24.12-alpine3.23`) |
| Lenguaje | TypeScript | 5.9 |
| Framework HTTP | Express | 5.2 |
| Validación | Joi | 18 |
| ORM | Sequelize + sequelize-typescript | 6.37 / 2.1 |
| Base de datos | PostgreSQL | conexión de **solo lectura** |
| Bus | NATS (`nats`) | 2.29 — request/reply, sin JetStream |
| Auth | `jsonwebtoken` + JWKS de Zitadel | 9.0 |
| Storage | `@aws-sdk/client-s3` + presigner | 3.995 |
| Uploads | multer (memoria) | 2.0 |
| Logging | winston + express-winston | 3.19 / 4.2 |
| Testing | mocha + should + sinon + supertest + nock + mockery, nyc | 11.7 |
| Migraciones | sequelize-cli | 6.6 — 95 migraciones |

### Paquetes compartidos del monorepo

| Paquete | Qué aporta |
|---|---|
| `@jiku/models` | Los 28 modelos Sequelize. Compartidos con `core` para que no puedan divergir. El paquete **no abre la conexión**: cada servicio registra las clases en su propio Sequelize, porque conectan con credenciales distintas |
| `@jiku/nats-protocol` | El contrato del bus: gramática de subjects, formato de `Reply`, hash del inbox |
| `@jiku/zitadel-auth` | Obtiene y renueva el access token del service user con el que la api se autentica en el bus |

## La decisión que define el servicio: lee la base, escribe por el bus

No está en ningún catálogo de convenciones y condiciona todo lo demás.

- La conexión Sequelize es de **solo lectura por credenciales** (`api/lib/models/index.ts:19-31`).
  La separación lectura/escritura es una decisión de infraestructura, no de estilo.
- **Tres excepciones.** Las migraciones, que corren al arrancar con credenciales propias
  (`POSTGRESQL_MIGRATION_USER`, `api/db-upgrade/config.js:10-14`); la fila de `attachments`
  (`Attachment.create()`, `attachments-post.ts:105-118`); y `PUT /api/week-assigned-times`
  (`destroy` + `bulkCreate` en una transacción, `week-assigned-times-put.ts:39-78`) — la única
  ruta que escribe con el ORM y la única que usa los middlewares de transacción. Las dos últimas
  son deuda: escriben con las credenciales de solo lectura y funcionan porque el rol de la
  instalación se lo permite.
- Toda mutación pasa por `sendCommand` / `runCommand` (`api/lib/utils/bus/send-command.ts`),
  que publica el comando y **traduce la respuesta de core a HTTP**.
- Después de publicar, la api **relee la base** para rearmar la respuesta: core solo devuelve
  el `id`, pero el contrato con los fronts es el recurso completo con sus relaciones.
- El mapa `errorCode` → status HTTP vive en la api (`api/lib/utils/bus/protocol.ts:40-75`,
  20 códigos). Es lo que sostiene el contrato con `web` y `opus-web`.
- **Sin JetStream:** no hay reintento ni cola. Bus caído o timeout responde 503 y la operación
  no ocurrió. Si core escribe y la respuesta se pierde, el cliente ve un error de algo que sí pasó.

### Traductores de contrato api ↔ bus

El bus renombró conceptos que ni la base ni los fronts cambiaron, así que la api traduce en
ambos sentidos para no tocar el contrato HTTP:

| Contrato HTTP | Contrato del bus | Dónde |
|---|---|---|
| `objectives` | `tasks` | nombre del comando |
| `priority` numérica 0-5 | enum `sin_prioridad`…`urgente` | `api/lib/utils/bus/priority.ts` |
| `keyValuePairs` (objeto plano) | `properties` (lista `{code, value}`) | `api/lib/utils/bus/properties.ts` |
| `personIds` | `responsiblePersonIds` | `api/lib/routes/objectives-post.ts:33` |
| `objectiveId` | `taskId` | `api/lib/routes/worked-times-post.ts:124` |

## Features principales

### clients — actores (5 endpoints)
Listado con sus proyectos, alta, detalle, edición y proyectos filtrados por cliente. En la UI
se llaman "actores"; en la base son `clients`.

### projects — proyectos (6 endpoints)
CRUD, personas asignadas, resumen de objetivos por proyecto. Los enlaces del proyecto
(documentación, diseño, board, grupo de Mattermost) viven en `keyValuePairs`, un JSON con
claves validadas por Joi.

### requirements — requisitos (8 endpoints)
CRUD, comentarios con visibilidad, horas trabajadas imputadas, reporte, sugerencias de tags
(filtrado por `tags @> '[{"key":…,"value":…}]'::jsonb`).
Regla de negocio propia de la api: **una incidencia no se resuelve sin tipo y conclusión**
(`api/lib/routes/requirements-id-patch.ts:36-58`) — se queda acá porque combina el estado que
llega con el que ya tiene el requisito y devuelve un código que no está en el protocolo.

### objectives — tareas (6 endpoints)
CRUD, comentarios con visibilidad configurable, y agregación de minutos trabajados: totales,
agrupados por persona y detallados (`api/lib/routes/objectives-get.ts:104-146`).
El modelo tiene un hook `@BeforeUpdate` que setea y limpia `finishedAt` según la transición de
estado.

### worked-times — horas trabajadas (8 endpoints)
Carga, borrado y tres reportes (por persona, por proyecto, por proyecto puntual). Reglas que
viven en la api porque core no conoce roles ni calendario:
- **Ventana de carga:** el día actual y los 10 previos (`worked-times-post.ts:87-110`)
- **Solo un admin imputa horas a otra persona** (`worked-times-post.ts:57-83`)
- `personId` se resuelve por default desde el usuario autenticado
- `objectiveId` y `requirementId` son mutuamente excluyentes (Joi `.oxor`)

### unworked-times — ausencias (5 endpoints)
Alta, borrado con deadline, motivos y reporte.

### week-assigned-times — asignación semanal (2 endpoints)
El **único `PUT`** de la api y **la única ruta que escribe con el ORM**: reemplaza la semana
completa con `destroy` + `bulkCreate` en una transacción, derivando `internal` del tipo de
proyecto. Solo `admin`, y `validateWeekNotPast` impide modificar semanas pasadas. Es la única
escritura que nunca se convirtió en comando, y su futuro está sin definir: puede mantenerse,
rehacerse o eliminarse (ver known-limitations).

### attachments — adjuntos (6 endpoints)
Subida multi-archivo (hasta 10, 10 MB cada uno) a storage S3-compatible, con:
- lista blanca doble de extensión **y** MIME type
- checksum sha256 por archivo
- **rollback:** si algo falla a mitad, borra del bucket lo ya subido (`attachments-post.ts:124-134`)
- `entityId` nullable para drafts anclados al usuario (el requisito todavía no existe)
- preview inline, descarga y borrado; para archivos grandes redirige a URL pre-firmada

Escribe la fila de `attachments` directamente (`attachments-post.ts:105-118`), sin pasar por el
bus. Es una de las dos escrituras con ORM que quedaron en la api, junto con
`PUT /api/week-assigned-times`.

### opus/* — portal de clientes (12 endpoints)
Superficie separada que consume `opus-web`. Un `external-user` solo ve los proyectos que le
fueron concedidos vía `user_project_permissions`. Incluye alta de requisitos, comentarios,
suscripciones y adjuntos propios.
`GET /api/opus/attachments/:id/public` es **el único endpoint sin autenticación** de todo el
servicio: sirve solo adjuntos marcados públicos, responde 403 en cualquier otro caso, y manda
`X-Content-Type-Options: nosniff` con CSP de sandbox.

### auth / settings / persons (3 endpoints)
`GET /api/persons`, `GET /api/settings/hours-per-day` y `POST /api/auth/present`, que hoy es un
**no-op** (ver limitaciones).

## Autorización: tres capas

1. **Global por método HTTP, no por ruta.** `app.ts:32-35` instala `validateToken` para todo
   path *excepto* una lista de exenciones en `config/public.ts`, armada como regex de
   lookahead negativo. Es deny-by-default, la forma correcta, pero significa que **un archivo
   de ruta puede parecer desprotegido y estar cubierto**.
2. **Por rol.** `hasAnyRole([...])` sobre los roles del claim
   `urn:zitadel:iam:org:project:roles`. Roles observados: `admin`, `user`, `external-user`.
3. **Por entidad.** `validateProjectPermissions` y `canUserAccessEntity` / `canUserViewEntity`
   (`api/lib/utils/attachments-access.ts`) restringen a `external-user` por permiso de
   proyecto, resolviendo el proyecto desde 9 tipos de entidad distintos (objetivo, requisito,
   comentario de cada uno, drafts, proyecto, y un `comment` legado sin migrar).

El bypass de autenticación para desarrollo (`AUTH_BYPASS=true`) es **opt-in explícito**, está
prohibido con `NODE_ENV=production` (el arranque falla) y exige `DEV_USER_ID`. El comentario en
el código registra por qué: antes se activaba solo con que faltara `IDENTITY_URL`, así que una
variable sin completar dejaba la api abierta y con rol `admin`, en silencio
(`api/lib/utils/middlewares/validate-token.ts:12-24`).

## Decisiones técnicas identificadas

1. **Express 5 con una ruta por archivo.** 61 archivos en `lib/routes/`, exportados por un
   barrel que `app.ts` monta iterando `Object.keys(routes)`. Agregar un endpoint es crear un
   archivo y una línea en el barrel; nada más se toca. El costo es que la lógica de validación
   y permisos se repite entre archivos vecinos en vez de vivir en una capa de dominio.

2. **Modelos en un paquete compartido, conexiones separadas.** `@jiku/models` exporta las clases
   pero no abre la conexión, justamente para que api y core usen la misma definición con
   credenciales distintas. Es lo que hace posible la garantía de solo-lectura.

3. **Joi inline en el archivo de ruta.** El esquema vive al lado del handler que lo usa, no en
   un `*.schema.ts` por módulo. Coherente con la decisión de colocar todo lo de un endpoint en
   un archivo.

4. **Winston con transports a archivo en producción.** Consola en desarrollo, consola + dos
   archivos rotados (info y error) en producción. Anterior a la práctica de log estructurado a
   stdout.

5. **Mocha con base de datos real y `FakeBus` que ejecuta core.** El doble del bus registra qué
   comando se publicó y, por defecto, **lo ejecuta contra core con la misma base**
   (`api/tests/mocks/bus.ts`). Un solo test verifica las tres cosas: comando y payload
   publicados, traducción de la respuesta a HTTP, y que la escritura efectivamente ocurrió. Con
   `reply()` / `failWith()` se corta la ejecución real para cubrir caminos de error. Core se
   carga de forma perezosa: si no está, el doble sigue funcionando con respuestas fijas.
   Cualquier archivo de test corre solo, porque el esquema y el mock de auth se preparan en
   fixtures globales de Mocha.

6. **El JWKS se sincroniza con reintentos.** `verifyingKeys` reintenta `KEY_SYNC_ATTEMPS` veces
   resincronizando las claves si el `kid` del token no está entre las conocidas — cubre la
   rotación de claves en Zitadel sin reiniciar.

7. **Token del service user con auto-refresh.** El token del bus caduca en ~1h, así que pasarlo
   por variable de entorno obligaría a reiniciar. `@jiku/zitadel-auth` lo pide con la key y lo
   renueva solo. El `userId` con el que se publica sale de la key y **no** de una variable,
   porque tiene que coincidir exactamente con el `sub` que el auth-callout lee del token para
   autorizar el subject.

8. **`inboxPrefix` explícito.** Los permisos que mintea el callout solo autorizan
   `_INBOX.<hash(user-id)>.>`. Sin fijar el prefijo, la librería genera un inbox aleatorio y
   las respuestas nunca llegan.

9. **Storage sin defaults.** Bucket y región no tienen valor por default a propósito: dependen
   del proveedor de cada instalación (S3, MinIO, Spaces, R2), y un default apuntaría a la
   infraestructura de otro. El prefijo de claves sí tiene default histórico, porque cambiarlo
   en una instalación con datos deja inaccesibles los adjuntos ya subidos.

10. **Docker con contexto en la raíz del monorepo.** El Dockerfile vive en `api/` pero se
    construye desde la raíz, porque la api depende de los paquetes del workspace. Copia los
    manifiestos antes del código para cachear el `npm ci`.

## Interfaces

### Expone

| Tipo | Detalle |
|---|---|
| `rest_api` | **61 endpoints** bajo `/api`. 49 internos (consumidos por `web`) y 12 en `/api/opus/*` (consumidos por `opus-web`). Documentación autogenerada con `@grava.io/api-doc` a partir de los JSDoc `@route` / `@bodyparam` / `@response` |

### Consume

| Tipo | Target | Detalle |
|---|---|---|
| `database` | PostgreSQL `jiku` | **Solo lectura.** 28 tablas vía `@jiku/models`. Las migraciones son la excepción: escriben con credenciales propias |
| `message_bus` | NATS → `core` | Publica **13 formas de comando**. Subject `{instance}.{user-id}.gestion.v1.{comando}`. Request/reply con timeout de `NATS_REQUEST_TIMEOUT_MS` (default 5000 ms) |
| `external_service` | Zitadel | JWKS en `{IDENTITY_URL}/oauth/v2/keys`, userinfo en `/oidc/v1/userinfo`, y service user con JSON key para autenticarse en el bus |
| `external_service` | Storage S3-compatible | Bucket de adjuntos. Sirve AWS S3, MinIO, DigitalOcean Spaces o Cloudflare R2 |

## Flujos detectados (parciales)

Interacciones cross-service leídas del código. Se consolidan en `docs/flows/` con
`/product-generate-flows`.

### api → core (NATS, request/reply)

| Comando | Origen | Disparado por |
|---|---|---|
| `clients.new` | `clients-post.ts:15` | `POST /api/clients` |
| `clients.{id}.edit` | `clients-patch.ts:14` | `PATCH /api/clients/:id` |
| `projects.new` | `projects-post.ts:19` | `POST /api/projects` |
| `projects.{id}.edit` | `projects-patch.ts:31` | `PATCH /api/projects/:id` |
| `tasks.new` | `objectives-post.ts:26` | `POST /api/objectives` |
| `tasks.{id}.edit` | `objectives-patch.ts:40` | `PATCH /api/objectives/:id` |
| `tasks.{id}.comment` | `objectives-id-comments-post.ts:14` | `POST /api/objectives/:id/comments` |
| `requirements.new` | `requirements-post.ts:57` · `opus-requirements-post.ts:44` | `POST /api/requirements` · `POST /api/opus/requirements` |
| `requirements.{id}.edit` | `requirements-id-patch.ts:67` · `opus-requirements-id-patch.ts:17` | `PATCH` de ambas superficies |
| `requirements.{id}.subscriptors.new` | `opus-requirements-post.ts:63` · `opus-requirements-id-subscriptors-post.ts:61` | alta con suscriptores · suscripción explícita |
| `worked-times.new` | `worked-times-post.ts:124` | `POST /api/worked-times` |
| `worked-times.{id}.delete` | `worked-times-id-delete.ts:82` | `DELETE /api/worked-times/:id` |
| `unworked-times.{id}.delete` | `unworked-times-id-delete.ts:70` | `DELETE /api/unworked-times/:id` |

El contrato completo de los 17 comandos que sirve core está en
[`docs/apis/core.yaml`](../../apis/core.yaml) (AsyncAPI 2.6).

### api → Zitadel (HTTP)

| Llamada | Origen | Cuándo |
|---|---|---|
| `GET {IDENTITY_URL}/oauth/v2/keys` | `auth-helper.ts:26` | al arrancar y al no reconocer un `kid` |
| `GET {IDENTITY_URL}/oidc/v1/userinfo` | `auth-helper.ts:99` | helper disponible, hoy sin uso en rutas |
| token del service user | `@jiku/zitadel-auth` vía `bus/index.ts:47` | al conectar al bus, con auto-refresh |

### api → Storage (S3)

`PutObject`, `GetObject`, `DeleteObject`, `ListObjectsV2`, `HeadObject` y URLs pre-firmadas
desde `lib/utils/storage-service.ts`.

### web / opus-web → api

Sentido entrante, ya documentado en los análisis de esos servicios: `web` consume ~45 endpoints
con el token inyectado en el servidor; `opus-web` reenvía `/api/opus/*` mediante un proxy
catch-all.

## Información para consolidación del PRD

### Rol en el producto
Es el **centro del sistema**: los dos frontends solo hablan con ella, y es la única que traduce
intención de usuario a comandos de escritura. Cualquier feature nueva de datos la toca.

### Actores y sus roles
| Rol | Superficie |
|---|---|
| `admin` | todo, más imputar horas a terceros y editar asignación semanal |
| `user` | equipo interno: proyectos, requisitos, tareas, sus propias horas |
| `external-user` | solo `/api/opus/*`, y solo los proyectos concedidos por `user_project_permissions` |

### Conceptos con nombre distinto según la capa
Importante para el PRD, porque el vocabulario del producto no coincide con el del código:

| UI / producto | HTTP / base | Bus |
|---|---|---|
| Actor | `client` | `client` |
| Tarea | `objective` | `task` |
| Requisito | `requirement` | `requirement` |
| Etapa | `stage` — **eliminada** de la base, pero la web todavía manda `stageId` y la api lo reenvía | — |

### Reglas de negocio que viven en la api (no en core)
Son candidatas a requisitos explícitos del PRD:
- Ventana de carga de horas: día actual + 10 previos
- Solo `admin` imputa horas a otra persona
- No se modifican semanas pasadas de asignación
- Una incidencia no se resuelve sin tipo y conclusión
- Visibilidad automática de actividades: cambios de estado, título y descripción son
  `public`; el resto `internal`. Solo los comentarios permiten elegir
  (`lib/utils/visibility-helper.ts`)
- Adjuntos: 10 archivos, 10 MB, lista blanca de 13 extensiones

### Limitaciones conocidas que afectan al producto
Del propio repositorio (`documentation/known-limitations.md`), verificadas en el código:

1. **No se pueden crear usuarios desde el producto.** `POST /api/auth/present` es un no-op: era
   la única escritura que nunca se convirtió en comando, y con la api en solo-lectura ya no
   puede hacerlo. Consecuencia: quien autentica pero no está en `users` recibe 401
   `user_not_found` de todas las demás rutas. Hoy la única vía es insertarlo a mano.
2. **Las migraciones no construyen el esquema desde cero.** Las 95 asumen un esquema existente;
   ninguna crea `objectives`. Una instalación nueva necesita un dump previo.
3. **Un comando perdido es un comando perdido.** Sin JetStream: sin reintentos, sin transacción
   distribuida, y sin garantía de idempotencia.
4. **Los códigos de error no están catalogados.** No hay lista cerrada ni mapeo documentado
   `errorCode` → HTTP. `daily_limit_exceeded` lleva datos extra que la api **recupera parseando
   el mensaje** con un regex, porque el formato de respuesta del protocolo no tiene dónde
   ponerlos (`bus/protocol.ts:96-104`). Es explícitamente transitorio.
5. **Los mensajes de error son texto de interfaz.** Los fronts los muestran tal cual al usuario,
   así que son parte de la UI y no un apoyo de debugging. Están mezclados: algunos en inglés,
   otros en español.
6. **Deuda visible en el código:** `entityType: 'comment'` legado sin migrar (pendiente S-096),
   `stageId` que se sigue reenviando aunque la tabla ya no exista, adjuntos históricos con
   `entityType: 'stage'` que quedan sin proyecto contra el que verificar permisos y por eso no se
   autorizan, `PUT /api/week-assigned-times` escribiendo con el ORM, y tres tablas sin uso de las
   notificaciones por mail eliminadas (`objective_mail_threads`, `requirement_mail_threads`,
   `inbound_mail_threads`) que ninguna migración borra.

## Referencias a documentación generada

| Documento | Contenido |
|---|---|
| [`docs/architectures/api/`](../../architectures/api/) | Manifest, overview, índice y 12 convenciones custom |
| [`docs/apis/api.yaml`](../../apis/api.yaml) | OpenAPI 3.0 — los 61 endpoints |
| [`docs/db-schemas/jiku.md`](../../db-schemas/jiku.md) | Las 28 entidades, diagrama ER y DBML |
| [`docs/apis/core.yaml`](../../apis/core.yaml) | AsyncAPI del bus — el otro lado de cada comando |
