# Servicios y módulos

## Servicios

| Servicio | Tipo | Lenguaje | Superficies | Expone | Carpeta | Origen |
|---|---|---|---|---|---|---|
| api | service | node (TypeScript, Express 5) | — | HTTP | api | inicial |
| core | service | node (TypeScript) | — | NATS | core | inicial |
| web | frontend | nextjs | Gestión interna | HTTP | web | inicial |
| opus-web | frontend | nextjs | Portal de clientes | HTTP | opus-web | inicial |
| models | library | node (TypeScript) | — | — | packages/models | inicial |
| nats-protocol | library | node (TypeScript) | — | — | packages/nats-protocol | inicial |
| zitadel-auth | library | node (TypeScript) | — | — | packages/zitadel-auth | inicial |

## Módulos

### api

La api no escribe datos de dominio: lee la base con el rol de solo lectura y publica cada escritura como comando a core. Sus módulos son los tags del contrato HTTP.

| Módulo | Entidades | Responsabilidad | Origen |
|---|---|---|---|
| clients | — | Lecturas de clientes y sus proyectos; publica `clients.new` y `clients.{id}.edit` | inicial |
| projects | — | Lecturas de proyectos, personas del proyecto y resumen de tareas por proyecto; publica `projects.new` y `projects.{id}.edit` | inicial |
| requirements | — | Lecturas de requisitos, reporte, sugerencias de etiquetas y horas por requisito; publica `requirements.new`, `requirements.{id}.edit`, `requirements.{id}.comment` y `requirements.{id}.comment.{cid}.edit` | inicial |
| objectives | — | Lecturas de tareas con sus horas; publica `tasks.new`, `tasks.{id}.edit`, `tasks.{id}.comment` y `tasks.{id}.comment.{cid}.edit` | inicial |
| worked-times | — | Lecturas y reportes de horas trabajadas; publica `worked-times.new` y `worked-times.{id}.delete` | inicial |
| unworked-times | — | Lecturas de ausencias y motivos; resuelve la persona del usuario y aplica el plazo de borrado; publica `unworked-times.new` y `unworked-times.{id}.delete` | inicial |
| week-assigned-times | — | Lectura de la asignación de una semana; publica `week-assigned-times.replace` | inicial |
| attachments | — | Pedido de subida, lista, previsualización y descarga (302 a URL firmada) y desvínculo de adjuntos; autoriza por entidad antes de publicar `files.request-upload`, `files.{fileId}.request-download` y `attachments.{id}.delete` | inicial |
| docs | — | Operaciones de documentación interna proxeadas al módulo jiku-docs por el bus, registro de módulos (`JIKU_MODULES`) y links públicos `/p/docs/*` con host exclusivo y rate limit | inicial |
| opus | — | Operaciones del Portal de clientes bajo `/api/opus/*`: proyectos, requisitos públicos, comentarios, suscripciones, adjuntos y documentación pública | inicial |
| other | — | `POST /api/auth/present`, personas, horas por día, módulos instalados | inicial |

### core

Único escritor de la base. Atiende los servicios `jiku-commands` (23 comandos) y `jiku-queries` (23 consultas) del bus, consume `{instance}.events.auth` y procesa la cola de notificaciones.

| Módulo | Entidades | Responsabilidad | Origen |
|---|---|---|---|
| clients | Cliente | Comandos `clients.new` y `clients.{id}.edit` | inicial |
| projects | Proyecto, Permiso de proyecto | Comandos `projects.new` y `projects.{id}.edit` (propiedades del proyecto); los permisos de proyecto y las personas del proyecto se cargan fuera del producto y core solo los lee | inicial |
| requirements | Requisito, Actividad de requisito, Suscripción a requisito | Comandos de requisitos: alta, edición (historial, reapertura, responsables), resolución, comentarios y su edición, suscriptores | inicial |
| tasks | Tarea, Actividad de tarea, Suscripción a tarea | Comandos de tareas: alta, edición (historial, responsables), comentarios y su edición; las suscripciones a tareas no las escribe ningún comando | inicial |
| times | Hora trabajada, Ausencia, Asignación semanal | Comandos `worked-times.*`, `unworked-times.*` y `week-assigned-times.replace`: ventana, tope diario, titularidad y semanas pasadas | inicial |
| files | Archivo, Adjunto | `files.request-upload` (política de archivos, URL firmada de subida), `files.{fileId}.request-download` (URL firmada de lectura), `attachments.{id}.delete` y el vínculo de archivos que usan los comandos de requisitos y tareas | inicial |
| identity | Usuario, Persona | Espejo de identidades en `users` (evento `{instance}.events.auth` y sobre actor de cada comando), sobre actor y publicador de confianza, compuertas de autorización (rol → método, clase de caller, permiso por entidad); las personas se cargan fuera del producto | inicial |
| notifications | Notificación pendiente | Destinatarios y escritura de la cola `notification_outbox` en la transacción del comando; ciclo de envío por SMTP con reintentos | inicial |
| settings | Ajuste del sistema | Lectura de `system_settings` (horas por día, política de archivos, envío de notificaciones); las filas las siembran las migraciones | inicial |
| queries | — | Las 23 consultas de `jiku-queries`: motor genérico de listado y lectura por id con SQL explícito sobre la conexión de solo lectura, recorte externo, cursor y presupuesto de bytes | inicial |
| events | — | Construcción y publicación de los 16 eventos de dominio en `JIKU_EVENTS` después del commit | inicial |

## Interacciones

| De → A | Para qué | Bloques | Origen |
|---|---|---|---|
| web → api | Todas las operaciones de Gestión interna, con el access token de la sesión, desde el servidor de Next | ACC, CLI, PRY, REQ, COM, TAR, HOR, ASI, ADJ, DOC, REP | inicial |
| opus-web → api | Operaciones del Portal de clientes (`/api/opus/*`, `/api/files/{id}/preview`, `/api/auth/present`) a través del proxy del portal | ACC, REQ, COM, SUS, ADJ, DOC | inicial |
| api.clients → core.clients | Alta y edición de clientes | CLI | inicial |
| api.projects → core.projects | Alta y edición de proyectos | PRY | inicial |
| api.requirements → core.requirements | Alta, edición y comentarios de requisitos | REQ, COM | inicial |
| api.opus → core.requirements | Alta, cambio de estado o prioridad, comentarios y suscripciones desde el portal | REQ, COM, SUS | inicial |
| api.objectives → core.tasks | Alta, edición y comentarios de tareas | TAR, COM | inicial |
| api.worked-times → core.times | Carga y borrado de horas trabajadas | HOR | inicial |
| api.unworked-times → core.times | Registro y borrado de ausencias | HOR | inicial |
| api.week-assigned-times → core.times | Reemplazo de la asignación de una semana | ASI | inicial |
| api.attachments → core.files | Ticket de subida, URL firmada de lectura y desvínculo | ADJ | inicial |
| api.opus → core.files | Ticket de subida y URL firmada de lectura desde el portal | ADJ | inicial |
| api.docs → jiku-docs | Consultas y comandos de documentación, ping del módulo, resolución de links públicos | DOC | inicial |
| api.opus → jiku-docs | Documentación pública de un proyecto o requisito | DOC | inicial |
| core.requirements → core.files | Vincular y desvincular archivos al crear o editar requisitos y comentarios | ADJ, REQ, COM | inicial |
| core.tasks → core.files | Vincular y desvincular archivos al crear o editar tareas y comentarios | ADJ, TAR, COM | inicial |
| core.requirements → core.notifications | Declarar las notificaciones de alta, resolución, reapertura, suscripción y comentario público | NOT | inicial |
| core.requirements → core.events | Eventos `requirement.*` después del commit | BUS | inicial |
| core.tasks → core.events | Eventos `task.*` después del commit | BUS | inicial |
| core.files → core.settings | Política de archivos y vida de las URL firmadas | ADJ | inicial |
| core.notifications → core.settings | Intervalo, lote e intentos del envío | NOT | inicial |
| core.times → core.identity | Persona vinculada al usuario que carga y titularidad | HOR | inicial |
| core.identity → core.projects | Permiso de proyecto de un Cliente sobre el proyecto de la entidad del comando | ACC | inicial |
| auth-callout → core.identity | Evento `{instance}.events.auth` por cada conexión autenticada al bus | ACC | inicial |
| conector → core.queries | Consultas genéricas por el bus | BUS | inicial |
| conector → core | Comandos directos por el bus | BUS | inicial |
| core.events → conector | Eventos de dominio leídos de `JIKU_EVENTS` | BUS | inicial |
