---
flow: envio-de-notificaciones
requirements: [NOT-01, NOT-02, NOT-03, NOT-04, NOT-05, NOT-06, NOT-E1, NOT-E2, NOT-E3, BUS-08]
modules: [core.requirements, core.notifications, core.settings]
---

# Envío de notificaciones por email

Los comandos de requisitos declaran sus notificaciones; el despachador las encola en la transacción del comando y un ciclo periódico de core las envía por SMTP con reintentos.

| # | Desde → Hacia | Qué pasa | Operación / tabla | Reglas |
|---|---|---|---|---|
| 1 | core.requirements → core.notifications | El comando que tuvo éxito declara la notificación en su respuesta | `requirements.new` (`requirement.created`), `requirements.{id}.subscriptors.new` (`requirement.created` solo al nuevo suscriptor), `requirements.{id}.edit` y `requirements.{id}.resolve` (`requirement.resolved`, `requirement.reopened`), `requirements.{id}.comment` (`requirement.comment.created`) | NOT-01, NOT-02, NOT-03, NOT-04, NOT-05 |
| 2 | core.notifications → PostgreSQL | Resuelve los destinatarios: requisito público (y comentario público), sus suscriptores o el nuevo suscriptor, sin el actor, sin repetidos, con email y con permiso de proyecto sobre el proyecto | `requirements`, `requirement_subscriptors`, `users`, `user_project_permissions` | NOT-01, NOT-05 |
| 3 | core.notifications → PostgreSQL | Encola una fila por destinatario en la transacción del comando, con el link `{OPUS_URL}/projects/{projectId}/requirements/{requirementId}` | `notification_outbox` (`status` `pending`) | INV-19, NOT-06, GAR-23 |
| 4 | core → PostgreSQL | El commit del comando confirma las filas; un rollback no deja ninguna | `COMMIT` / `ROLLBACK` | BUS-08, GAR-27 |
| 5 | core.notifications → PostgreSQL | Cada **intervalo de envío de notificaciones** lee la configuración del envío; si falla, programa el ciclo siguiente a los 5 s | `system_settings` (`notification-dispatch-interval-seconds`, `notification-batch-size`, `notification-max-attempts`) | NOT-E3 |
| 6 | core.notifications → PostgreSQL | En una transacción toma hasta **lote de envío de notificaciones** filas pendientes vencidas, en orden | `SELECT … FROM notification_outbox WHERE status = 'pending' AND next_attempt_at <= NOW() ORDER BY next_attempt_at, id LIMIT … FOR UPDATE SKIP LOCKED` | NOT-06, GAR-30 |
| 7 | core.notifications → SMTP | Renderiza la plantilla (HTML y texto) y envía cada mail | SMTP (`SMTP_HOST`, `SMTP_FROM`) | NOT-06 |
| 8 | core.notifications → PostgreSQL | Éxito: marca enviada. Falla: suma un intento, guarda el error y posterga según el **backoff de notificaciones**; al llegar a **intentos de envío de notificaciones**, borra la fila y deja `[notifications] discard` en el log | `notification_outbox` (`status` → `sent`; `attempts`, `last_error`, `next_attempt_at`; `DELETE`) | NOT-E1, NOT-E2, GAR-30 |
| 9 | core.notifications → PostgreSQL | Confirma el lote; si el commit falla, los mails ya enviados se vuelven a enviar en el ciclo siguiente | `COMMIT` | GAR-30 |
