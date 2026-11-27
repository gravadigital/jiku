# Integration

## Persistence and infrastructure

| Component | Technology | Owner | Used by | Origin |
|---|---|---|---|---|
| Base de datos `jiku` | PostgreSQL 15, con la extensión `pg_trgm` | core (usuario dueño, único que escribe) | api (rol de solo lectura; corre las migraciones con su propio usuario), core (plano de consultas con el rol de solo lectura) | initial |
| Bus | NATS 2.10, cuentas y usuarios por JWT, autorización por auth-callout | core (atiende `jiku-commands` y `jiku-queries` con queue group) | api, core, conectores, jiku-docs, auth-callout | initial |
| Stream `JIKU_EVENTS` | NATS JetStream, subject `{instance}.events.{version}.>`, retención de 7 días | core (publica) | conectores (consumidores propios) | initial |
| Registro de módulos `JIKU_MODULES` | NATS JetStream KV, una clave por módulo | jiku-docs (escribe su clave) | api (lee y observa) | initial |
| Espacio de datos de conectores `JIKU_KV` | NATS JetStream KV, claves bajo `{instance}.{identidad}` | cada conector (su propio espacio) | conectores | initial |
| Almacenamiento de archivos | S3 compatible, un bucket con prefijo de clave por instalación | core (única credencial; firma los links) | navegador (sube y descarga con links firmados) | initial |
| Ingress | nginx-proxy con certificados de Let's Encrypt, un host por superficie (`web`, `opus-web`, `api` y el host público de documentos) | despliegue | web, opus-web, api | initial |
| Imágenes | Docker Hub: `jiku-api`, `jiku-core`, `jiku-web`, `jiku-opus-web` | `release.yml` y `dev-images.yml` | despliegue | initial |

## Communication

| From → To | Protocol | Type | Purpose | Origin |
|---|---|---|---|---|
| navegador → web | HTTPS | síncrono | Pantallas del Gestor interno; sus llamadas a la api salen del servidor de Next | initial |
| navegador → opus-web | HTTPS | síncrono | Pantallas del Portal de clientes; el proxy `/api/opus/*` reenvía a la api con el token de la sesión | initial |
| web → api | HTTP REST | síncrono | Lecturas y escrituras del gestor con el token de acceso de la persona | initial |
| opus-web → api | HTTP REST | síncrono | Rutas `/api/opus/*` del portal con el token de acceso de la persona | initial |
| navegador → api | HTTPS | síncrono | `GET /p/docs/{token}` del visitante con link compartido, sin autenticación | initial |
| api → base de datos | SQL | síncrono | Todas las lecturas del producto, con el rol de solo lectura | initial |
| api → core | NATS request/reply (`{instance}.{sub}.jiku-commands.v1.{comando}`) | síncrono | Toda escritura, como comando con el sobre de identidad de la persona; también los links firmados de archivos | initial |
| conector → core | NATS request/reply (`jiku-commands` y `jiku-queries`) | síncrono | Comandos y consultas publicados con la identidad del conector | initial |
| core → base de datos | SQL | síncrono | Escrituras en la transacción del comando (usuario dueño) y consultas del bus (rol de solo lectura) | initial |
| core → conectores | NATS JetStream (`JIKU_EVENTS`) | asíncrono | Eventos de dominio de requisitos y tareas, publicados después del commit | initial |
| auth-callout → core | NATS publish (`{instance}.events.auth`) | asíncrono | Evento de autenticación de cada conexión, con el que core actualiza el usuario | initial |
| api → jiku-docs | NATS request/reply (servicios `jiku-docs-commands` y `jiku-docs-queries`) | síncrono | Operaciones de documentación con la identidad de la persona, y ping de disponibilidad | initial |
| jiku-docs → core | NATS request/reply (`jiku-commands`, `jiku-queries`) | síncrono | El módulo de documentación publica comandos y consultas de core como conector; los archivos que sube nunca se vinculan a una entidad del producto | initial |
| navegador → almacenamiento | HTTPS con link firmado | síncrono | `PUT` de los bytes de un archivo y lectura por el redirect de la api | initial |
| core → almacenamiento | S3 API | síncrono | Firmar links de subida y de lectura | initial |
| core → servidor SMTP | SMTP | asíncrono | Envío de las notificaciones encoladas | initial |

## Events

| Event | Publishes | Consumes | Transition | Origin |
|---|---|---|---|---|
| `requirement.created` | core.requirements | conectores | Requisito: — → estado inicial (REQ-01, POR-10) | initial |
| `requirement.state.changed` | core.requirements | conectores | Requisito: cualquier estado → otro (REQ-09, POR-16) | initial |
| `requirement.updated` | core.requirements | conectores | Requisito: cambio de campos que no es de estado (REQ-06) | initial |
| `requirement.comment.created` | core.requirements | conectores | Actividad de requisito: — → comentario (REQ-20, POR-13) | initial |
| `requirement.comment.edited` | core.requirements | conectores | Actividad de requisito: comentario editado (REQ-21) | initial |
| `requirement.subscriptor.added` | core.requirements | conectores | Requisito: suscriptor agregado (REQ-05, POR-14) | initial |
| `requirement.subscriptor.removed` | core.requirements | conectores | Requisito: suscriptor quitado (POR-14) | initial |
| `requirement.assigned` | core.requirements | conectores | Requisito: cambio de responsables (REQ-07) | initial |
| `requirement.resolved` | core.requirements | conectores | Requisito: → `resuelto` (REQ-11, REQ-12) | initial |
| `requirement.reopened` | core.requirements | conectores | Requisito: `resuelto` → otro estado (REQ-13) | initial |
| `task.created` | core.tasks | conectores | Tarea: — → estado inicial (TAR-01) | initial |
| `task.state.changed` | core.tasks | conectores | Tarea: cualquier estado → otro (TAR-10) | initial |
| `task.updated` | core.tasks | conectores | Tarea: cambio de campos que no es de estado (TAR-07) | initial |
| `task.comment.created` | core.tasks | conectores | Actividad de tarea: — → comentario (TAR-14) | initial |
| `task.comment.edited` | core.tasks | conectores | Actividad de tarea: comentario editado (TAR-15) | initial |
| `task.assigned` | core.tasks | conectores | Tarea: cambio de responsables (TAR-09) | initial |
| `events.auth` (autenticación) | auth-callout | core.identity | Usuario: creado o actualizado con la identidad de la conexión (ACC-18) | initial |

## External integrations

| ID | System | Direction | Data | When | Source of truth | Reference | Origin |
|---|---|---|---|---|---|---|---|
| INT-01 | Zitadel (proveedor de identidad: OIDC, JWKS, userinfo, jwt-bearer) | entrada y salida | Identidad de las personas y de los usuarios de máquina (`sub`, nombre, usuario, email) y roles del proyecto; claves públicas para validar tokens | Al ingresar en web y opus-web, al validar cada token en la api (claves en cache, se vuelven a bajar ante una clave desconocida) y al obtener los tokens de máquina de api y core | Zitadel, para identidades y roles; la tabla `users` es un espejo | — | initial |
| INT-02 | Almacenamiento S3 compatible | salida | Bytes de los archivos, bajo `{prefijo}/f/{uuid}{extensión}` | Al firmar un permiso de subida o un link de lectura (core) y al subir o descargar (navegador) | El almacenamiento para los bytes; la tabla `files` para los metadatos | — | initial |
| INT-03 | Servidor SMTP | salida | Emails de notificación (HTML y texto) a los suscriptores | En cada ciclo del proceso de envío con filas pendientes | — | — | initial |
| INT-04 | jiku-docs (módulo opcional de documentación, por el bus, descubierto en el KV `JIKU_MODULES`) | entrada y salida | Documentos, versiones, relaciones, adjuntos de documentos y links compartidos | En cada operación de documentación del gestor y del portal, al abrir un link compartido, y en el ping periódico | jiku-docs, con su propia base | — | initial |
| INT-05 | NATS auth-callout (gravadigital/nats-zitadel-auth-callout) | entrada | Token de la conexión y rol que decide la plantilla de permisos; evento de autenticación | En cada conexión al bus | Zitadel para la identidad; `rules.yaml` y las plantillas del repositorio para los permisos | — | initial |
