# Integración

## Persistencia e infraestructura

| Componente | Tecnología | Dueño | Usado por | Origen |
|---|---|---|---|---|
| Base de datos | PostgreSQL 15.4, una sola base compartida por api y core, accedida con Sequelize 6 | core | api, core | inicial |
| Rol dueño de la base | Rol de PostgreSQL con escritura (`DATABASE_USER`) | core | core (comandos, espejo de identidades, cola de notificaciones, roles del caller); api solo para las migraciones (`POSTGRESQL_MIGRATION_USER`) | inicial |
| Rol de solo lectura | Rol de PostgreSQL con solo `SELECT` (`DATABASE_READONLY_USER`); lo crea la instalación | core | api (todas sus lecturas); core (consultas del bus, con `statement_timeout`) | inicial |
| Migraciones | sequelize-cli, `api/db-upgrade/migrations/`, tabla `sequelize_meta`; parten de un esquema base cargado de un dump | api | api, al arrancar | inicial |
| Bus NATS | NATS 2.10 en modo operator: cuenta `GESTION` (servicios), cuenta `GESTION_AUTH` (callout) y `SYS`; JetStream solo para eventos y KV | deploy | api, core, conectores, jiku-docs, personas con cliente NATS | inicial |
| Stream `JIKU_EVENTS` | JetStream sobre `{instance}.events.v1.>`, retención por límites de **retención de eventos**, almacenamiento en archivo, una réplica, ventana de duplicados de 2 minutos | core | core (publica), conectores (leen) | inicial |
| Stream `JIKU_DOCS_EVENTS` | JetStream del módulo de documentación | jiku-docs | jiku-docs, conectores | inicial |
| KV `JIKU_MODULES` | JetStream KV: una clave por módulo opcional con su `ModuleRecord`; history 1, sin vencimiento, lectura directa | deploy (lo crea `create-modules-kv.sh`); cada módulo escribe su clave | api (lee y observa), jiku-docs (escribe `docs`), personas y conectores (leen) | inicial |
| KV `JIKU_KV` | JetStream KV con claves `<instance>.<user id>.<clave>` | deploy (lo crea `create-kv-space.sh`) | conectores, cada uno bajo su instancia y su id | inicial |
| Almacenamiento de archivos | Almacenamiento compatible con S3 (AWS, MinIO en local, Spaces, R2), clave de objeto `{prefijo}/f/{uuid}{extensión}`; solo core tiene sus credenciales | core | core (firma URLs), navegador (sube y descarga con URL firmada), api (descarga el HTML grande de un link público por URL firmada) | inicial |
| Servidor SMTP | SMTP saliente con nodemailer (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`) | core | core.notifications | inicial |
| Auth-callout | Imagen externa `gravadigital/nats-zitadel-auth-callout`, reglas `deploy/nats/auth-callout/rules.yaml` y una plantilla de permisos por rol | deploy | servidor NATS (cada conexión), core.identity (consume su evento) | inicial |
| Ingress | nginx-proxy y letsencrypt externos a la instalación | deploy | web, opus-web, api | inicial |

## Comunicación

| De → A | Protocolo | Tipo | Para qué | Origen |
|---|---|---|---|---|
| navegador → web | HTTPS | síncrono | Páginas, Server Actions y route handlers de descarga, previsualización y liberación de reserva de edición | inicial |
| navegador → opus-web | HTTPS | síncrono | Páginas, proxy `/api/opus/[...path]` y route handlers de previsualización y adjuntos de documentos | inicial |
| web → api | HTTP con `Authorization: Bearer` (access token de la sesión) | síncrono | Operaciones bajo `/api/*` de Gestión interna, desde el servidor de Next | inicial |
| opus-web → api | HTTP con `Authorization: Bearer` (access token de la sesión) | síncrono | `/api/opus/*`, `/api/files/{id}/preview` y `/api/auth/present` | inicial |
| navegador → api | HTTPS sin credencial | síncrono | Links públicos `GET /p/docs/{token}` y sus adjuntos, solo en el host de `JIKU_PUBLIC_URL` | inicial |
| api → PostgreSQL | SQL (rol de solo lectura) | síncrono | Todas las lecturas de la api | inicial |
| core → PostgreSQL | SQL (rol dueño y rol de solo lectura) | síncrono | Escrituras en una transacción por comando; consultas del bus sin transacción | inicial |
| api → core | NATS request/reply, subject `{instance}.{user-id}.jiku-commands.v1.{método}`, inbox `_INBOX.{hash16(user-id)}` | síncrono, con espera de **tiempo de espera de comandos** | Los 22 comandos que publica la api, con el sobre actor | inicial |
| conector → core | NATS request/reply (`jiku-commands`, `jiku-queries`) | síncrono | Comandos y consultas directos con la identidad del conector | inicial |
| persona → core | NATS request/reply (`jiku-queries`; `jiku-commands` para `admin` y `user`) | síncrono | Consultas y comandos directos con el token de la persona | inicial |
| api → jiku-docs | NATS request/reply, subjects `{instance}.{user-id}.jiku-docs-queries.v1.{método}` y `…jiku-docs-commands.v1.{método}`, ping `$SRV.PING.jiku-docs-queries` | síncrono | Documentación interna, del portal y links públicos | inicial |
| api → `JIKU_MODULES` | NATS KV (lectura, watch) | asíncrono | Estado del módulo de documentación, con ping cada **intervalo de chequeo de módulos** | inicial |
| core → `JIKU_EVENTS` | NATS JetStream publish en `{instance}.events.v1.{tipo}` | asíncrono, después del commit | Eventos de dominio | inicial |
| `JIKU_EVENTS` → conector | NATS JetStream (consumidor del conector) | asíncrono | Lectura de eventos de dominio | inicial |
| servidor NATS → auth-callout | NATS auth callout (cuenta `GESTION_AUTH`, cifrado con xkey) | síncrono | Autorizar cada conexión y mintear sus permisos | inicial |
| auth-callout → core | NATS publish en `{instance}.events.auth` (queue group `jiku-events`), sin ack | asíncrono | Espejo de la identidad que se conectó | inicial |
| navegador → almacenamiento | HTTPS con URL firmada | síncrono | `PUT` de los bytes al subir; `GET` al seguir el 302 de descarga o previsualización | inicial |
| core → SMTP | SMTP | asíncrono (cola de notificaciones) | Envío de notificaciones por email | inicial |
| web, opus-web → Zitadel | OIDC (Authorization Code + PKCE) | síncrono | Login; opus-web también lee `/oidc/v1/userinfo` si al perfil le falta nombre o email | inicial |
| api → Zitadel | HTTPS (`{IDENTITY_URL}/oauth/v2/keys`) | síncrono, al arrancar y ante un `kid` desconocido | Claves públicas para verificar access tokens | inicial |
| api, core → Zitadel | OAuth 2.0 JWT bearer grant (`{issuer}/oauth/v2/token`) | síncrono, con renovación periódica | Token del service user para conectarse al bus | inicial |

## Eventos

| Evento | Publica | Consume | Transición | Origen |
|---|---|---|---|---|
| `requirement.created` | core.requirements (`requirements.new`) | conectores | Requisito: (alta) → estado inicial | inicial |
| `requirement.state.changed` | core.requirements (`requirements.{id}.edit`, `requirements.{id}.resolve`) | conectores | Requisito: cualquiera → cualquiera | inicial |
| `requirement.updated` | core.requirements (`requirements.{id}.edit` con título o descripción) | conectores | — | inicial |
| `requirement.resolved` | core.requirements (`requirements.{id}.edit` hacia `resuelto`, `requirements.{id}.resolve`) | conectores | Requisito: cualquiera → resuelto | inicial |
| `requirement.reopened` | core.requirements (`requirements.{id}.edit` saliendo de `resuelto`) | conectores | Requisito: resuelto → cualquiera salvo cancelado | inicial |
| `requirement.assigned` | core.requirements (`requirements.{id}.edit` con otros responsables) | conectores | — | inicial |
| `requirement.comment.created` | core.requirements (`requirements.{id}.comment`) | conectores | Actividad de requisito: (alta) | inicial |
| `requirement.comment.edited` | core.requirements (`requirements.{id}.comment.{cid}.edit`) | conectores | — | inicial |
| `requirement.subscriptor.added` | core.requirements (`requirements.{id}.subscriptors.new`) | conectores | Suscripción a requisito: (alta) | inicial |
| `requirement.subscriptor.removed` | core.requirements (`requirements.{id}.subscriptors.{userId}.delete`) | conectores | Suscripción a requisito: (baja) | inicial |
| `task.created` | core.tasks (`tasks.new`) | conectores | Tarea: (alta) → estado inicial | inicial |
| `task.state.changed` | core.tasks (`tasks.{id}.edit`) | conectores | Tarea: cualquiera → cualquiera | inicial |
| `task.updated` | core.tasks (`tasks.{id}.edit`) | conectores | — | inicial |
| `task.assigned` | core.tasks (`tasks.{id}.edit` con otros responsables) | conectores | — | inicial |
| `task.comment.created` | core.tasks (`tasks.{id}.comment`) | conectores | Actividad de tarea: (alta) | inicial |
| `task.comment.edited` | core.tasks (`tasks.{id}.comment.{cid}.edit`) | conectores | — | inicial |
| `{instance}.events.auth` (`authenticated`, versión 2) | auth-callout | core.identity | Usuario: (alta) o reemplazo de nombre, usuario, email, roles y tipo | inicial |

## Integraciones externas

| ID | Sistema | Dirección | Datos | Cuándo | Fuente de verdad | Referencia | Origen |
|---|---|---|---|---|---|---|---|
| INT-01 | Zitadel (proveedor de identidad) | entrante | Identidades (sub, nombre, usuario, email), roles del proyecto en el claim del token, claves públicas (JWKS), tokens de personas y de service users | Login en cada superficie, verificación de cada pedido HTTP, cada conexión al bus, renovación del token de service user | Zitadel, para identidades y roles; `users` es un espejo | — | inicial |
| INT-02 | Módulo opcional jiku-docs | saliente (por el bus); el módulo se anuncia en `JIKU_MODULES` | Documentos, versiones, temas, carpetas, relaciones, reservas de edición, links compartidos y adjuntos de documentos | Cada operación de documentación y cada link público | jiku-docs: la documentación no está en la base del producto | — | inicial |
| INT-03 | Almacenamiento compatible con S3 | saliente (URLs firmadas que usa el navegador) | Bytes de los archivos adjuntos | Al subir (URL firmada `PUT`) y al previsualizar o descargar (URL firmada `GET`) | El almacenamiento, para los bytes; `files`, para los metadatos | — | inicial |
| INT-04 | Servidor SMTP | saliente | Mails de notificación a usuarios con permiso de proyecto | Cada ciclo de envío de la cola de notificaciones | — | — | inicial |
| INT-05 | Conectores (sistemas externos con rol `internal-app`) | bidireccional | Consultas y comandos por el bus; eventos de dominio; su espacio clave-valor | Cuando el conector publica o lee | Jiku | — | inicial |
| INT-06 | Auth-callout de NATS (componente externo) | entrante | Decisión de autorización de cada conexión al bus y evento de autenticación con la identidad | Cada conexión al bus | Zitadel, a través del callout | — | inicial |
