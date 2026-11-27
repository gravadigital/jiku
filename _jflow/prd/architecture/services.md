# Services and modules

## Services

| Service | Type | Language | Surfaces | Exposes | Folder | Origin |
|---|---|---|---|---|---|---|
| api | service | node (TypeScript, Express) | Documento compartido | HTTP | services/api | initial |
| core | service | node (TypeScript) | — | NATS | services/core | initial |
| web | frontend | nextjs | Gestor interno | — | services/web | initial |
| opus-web | frontend | nextjs | Portal de clientes | — | services/opus-web | initial |
| models | library | node (TypeScript, Sequelize) | — | — | packages/models | initial |
| nats-protocol | library | node (TypeScript) | — | — | packages/nats-protocol | initial |
| zitadel-auth | library | node (TypeScript) | — | — | packages/zitadel-auth | initial |

## Modules

### api

| Module | Entities | Responsibility | Origin |
|---|---|---|---|
| access | — | Valida el token de acceso en toda ruta salvo las públicas, arma la identidad desde el token y responde a la presentación de la identidad | initial |
| clients | — | Lectura de clientes y sus proyectos; alta y edición publicando comandos a core | initial |
| projects | — | Lectura de proyectos, personas, personas de un proyecto y resumen de tareas por proyecto; alta y edición publicando comandos a core | initial |
| requirements | — | Lectura de requisitos, reporte, horas por requisito y sugerencias de etiquetas; alta, edición y comentarios publicando comandos a core | initial |
| tasks | — | Lectura de tareas; alta, edición y comentarios publicando comandos a core | initial |
| times | — | Lectura de horas trabajadas, ausencias, reportes, asignación semanal y horas por día; altas, bajas y guardado de la semana publicando comandos a core | initial |
| files | — | Permisos de subida y lectura de adjuntos y archivos; pide a core los links firmados y redirige al almacenamiento | initial |
| docs | — | Descubre el módulo de documentación en el registro del bus y le reenvía, con la identidad de la persona, las operaciones del gestor y del portal | initial |
| portal | — | Rutas del Portal de clientes bajo `/api/opus/*`: proyectos, requisitos públicos, usuarios, comentarios, suscripciones, adjuntos y documentos, con el permiso de proyecto del usuario de cliente | initial |
| public-docs | — | Sirve los links compartidos `/p/docs/{token}` sin autenticación, en el host público y con límite de pedidos | initial |

### core

| Module | Entities | Responsibility | Origin |
|---|---|---|---|
| clients | Cliente | Comandos de alta y edición de clientes y sus consultas | initial |
| projects | Proyecto, Permiso de proyecto | Comandos de alta y edición de proyectos y sus consultas. Los permisos de proyecto y las personas del proyecto los lee (para la compuerta de callers externos, las consultas y los destinatarios de notificaciones) pero ningún comando los escribe: se cargan directamente en la base | initial |
| people | Persona | Consultas de personas. Ningún comando escribe personas: se cargan directamente en la base | initial |
| identity | Usuario | Crea y actualiza el usuario como espejo de la identidad del proveedor, desde el evento de autenticación del bus y desde el sobre de identidad de la api; consultas de usuarios | initial |
| requirements | Requisito, Actividad de requisito | Comandos de alta, edición, resolución, comentarios y suscripciones de requisitos, con su actividad y sus eventos de dominio; consultas de requisitos y actividad | initial |
| tasks | Tarea, Actividad de tarea | Comandos de alta, edición y comentarios de tareas, con su actividad y sus eventos de dominio; consultas de tareas y actividad | initial |
| times | Horas trabajadas, Ausencia, Asignación semanal | Comandos de alta y baja de horas trabajadas y ausencias y de guardado de la asignación semanal, con la ventana de carga, el tope diario y la titularidad; consultas de horas | initial |
| files | Archivo, Adjunto | Política de subida, permisos de subida y lectura firmados contra el almacenamiento, vinculación y desvinculación de archivos; consultas de archivos y adjuntos | initial |
| notifications | Notificación pendiente | Encola las notificaciones de requisitos en la transacción del comando y las envía por SMTP en un proceso periódico, con reintentos | initial |
| settings | Configuración del sistema | Lee la configuración del sistema para los demás módulos y la expone en consultas. Ningún comando la escribe: se ajusta directamente en la base | initial |

## Interactions

| From → To | Purpose | Blocks | Origin |
|---|---|---|---|
| api.clients → core.clients | Publicar el alta y la edición de clientes como comandos | CLI | initial |
| api.projects → core.projects | Publicar el alta y la edición de proyectos como comandos | PRY | initial |
| api.requirements → core.requirements | Publicar alta, edición y comentarios de requisitos como comandos | REQ | initial |
| api.tasks → core.tasks | Publicar alta, edición y comentarios de tareas como comandos | TAR | initial |
| api.times → core.times | Publicar altas y bajas de horas y ausencias y el guardado de la semana como comandos | HOR, AUS, ASG | initial |
| api.files → core.files | Pedir permisos de subida, links firmados de lectura y desvinculaciones | ARC | initial |
| api.portal → core.requirements | Publicar alta, comentarios y suscripciones de requisitos del portal, con el sobre de identidad | POR | initial |
| api.portal → core.files | Pedir permisos de subida y links de lectura del portal | POR, ARC | initial |
| api.access → core.identity | Cada comando de la api lleva el sobre de identidad con el que core actualiza el usuario | ACC | initial |
| core.requirements → core.notifications | Encolar las notificaciones del cambio en la misma transacción | NOT, REQ, POR | initial |
| core.requirements → core.files | Vincular los archivos del requisito o comentario en la transacción del comando | REQ, ARC | initial |
| core.tasks → core.files | Vincular los archivos de la tarea o comentario en la transacción del comando | TAR, ARC | initial |
| core.files → core.settings | Leer la política de subida y la vigencia de los links | ARC | initial |
| core.notifications → core.settings | Leer el intervalo, el lote y los intentos máximos de envío | NOT | initial |
