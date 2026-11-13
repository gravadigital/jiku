---
flow: escritura-por-el-bus
requirements: [ACC-08, ACC-10, ACC-11, ACC-12, ACC-14, BUS-06, BUS-08, BUS-09, BUS-10, BUS-E1, BUS-E2, BUS-E8, BUS-E9, ACC-E3, ACC-E4, ACC-E5, ACC-E8]
modules: [api.clients, api.projects, api.requirements, api.objectives, api.worked-times, api.unworked-times, api.week-assigned-times, api.attachments, api.opus, core.identity, core.clients, core.projects, core.requirements, core.tasks, core.times, core.files, core.notifications, core.events]
---

# Escritura: de una operación HTTP a un comando de core

Toda escritura del producto: la api valida el pedido y publica un comando con el sobre actor; core lo autoriza, lo ejecuta en una transacción con sus notificaciones y, después del commit, publica sus eventos. Un conector entra directo en el paso 4, con su propia identidad y sin sobre.

| # | Desde → Hacia | Qué pasa | Operación / tabla | Reglas |
|---|---|---|---|---|
| 1 | web u opus-web → api | El servidor de Next envía la operación con el access token de la sesión | Por ejemplo `POST /api/requirements`, `PATCH /api/objectives/{id}`, `POST /api/opus/requirements` | ACC-08, GAR-36 |
| 2 | api → api | Verifica el token contra las claves de Zitadel y valida el cuerpo con el esquema de la ruta; algunas rutas leen la base antes (existencia del proyecto, permiso de proyecto, visibilidad pública) | Rol de solo lectura | ACC-E1, ACC-E8, GAR-28, GAR-55 |
| 3 | api → core | Publica el comando con el sobre actor (`id`, `roles`, `name`, `username`, `email` del token), que pisa cualquier `actor` del cuerpo, y espera la respuesta | `{instance}.{user-id}.jiku-commands.v1.{método}`, por ejemplo `requirements.new`, `tasks.{id}.edit`; inbox `_INBOX.{hash16(user-id)}` | ACC-10, GAR-35 |
| 4 | NATS → core | El servidor entrega el mensaje a una sola réplica (queue group `jiku-commands`); core descarta el JSON mal formado y los métodos desconocidos | Servicio micro `jiku-commands` | BUS-E1, BUS-E2, GAR-52 |
| 5 | core → core | Valida el sobre actor: solo del publicador de confianza, con id y roles, y autoría igual al actor | `CORE_TRUSTED_PUBLISHER_ID` | ACC-E5, GAR-34 |
| 6 | core → PostgreSQL | Espeja el actor en su propia transacción (mejor esfuerzo) | `users` | ACC-14, GAR-26 |
| 7 | core → core | Autoriza el método por los roles del sobre (sin sobre, por `users.roles`; el publicador de confianza sin sobre queda exento) y valida el cuerpo con el esquema del comando | Mapa rol → método | ACC-11, ACC-E3, GAR-31, GAR-55 |
| 8 | core → PostgreSQL | Abre la transacción del comando; para un Cliente resuelve el proyecto de la entidad y exige su permiso | `user_project_permissions` | ACC-12, ACC-E4, GAR-27, GAR-32 |
| 9 | core → PostgreSQL | El comando aplica sus reglas y escribe con el rol dueño, dentro de la transacción | Tablas del módulo (por ejemplo `requirements`, `people_requirements`, `requirement_activity`, `attachments`) | BUS-08 |
| 10 | core → PostgreSQL | Si la respuesta es `success`, resuelve los destinatarios de las notificaciones declaradas y las encola en la misma transacción | `notification_outbox` | INV-19, GAR-23 |
| 11 | core → PostgreSQL | Confirma si la respuesta es `success`; revierte ante `failure` o una excepción (`internal_error`) | `COMMIT` / `ROLLBACK` | BUS-08, BUS-E8, GAR-27 |
| 12 | core → `JIKU_EVENTS` | Después del commit publica los eventos de dominio del comando, con un `correlationId` por comando; un fallo se registra y el evento se pierde | `{instance}.events.v1.{tipo}`, por ejemplo `requirement.created` | BUS-10, GAR-29 |
| 13 | core → api | Responde `{ status, errorCode?, errorMessage?, errorDetails?, data? }` | Reply | — |
| 14 | api → web u opus-web | Traduce el `errorCode` a un estado HTTP; sin respuesta 503 `service_unavailable`, vencido el **tiempo de espera de comandos** 504 `gateway_timeout` (el comando pudo haberse ejecutado); si tuvo éxito, relee la fila con el rol de solo lectura y la devuelve | `data.id` → lectura de la fila creada | BUS-09, BUS-E9 |
