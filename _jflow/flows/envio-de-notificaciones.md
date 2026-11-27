---
flow: envio-de-notificaciones
requirements: [NOT-01, NOT-02, NOT-03, NOT-04, NOT-05, NOT-06, NOT-07, NOT-08, CON-19]
modules: [core.requirements, core.notifications, core.identity, core.projects, core.settings]
---

# Notificaciones por email a los suscriptores de un requisito

Un cambio en un requisito público (alta, suscripción, resolución, reapertura o comentario público) deja avisos en la cola de salida dentro de su propia transacción; un proceso periódico de core los envía por SMTP con reintentos.

| # | From → To | What happens | Operation / table | Rules |
|---|---|---|---|---|
| 1 | core.requirements | El comando declara el aviso que corresponde: requisito nuevo a los suscriptores, requisito nuevo solo al usuario suscripto, resuelto o reabierto al cambiar de o hacia `resuelto`, comentario solo si el comentario y el requisito son públicos | `requirements.new`, `requirements.{id}.subscriptors.new`, `requirements.{id}.edit`, `requirements.{id}.resolve`, `requirements.{id}.comment` | NOT-01, NOT-02, NOT-03, NOT-04, NOT-05 |
| 2 | core.notifications → core.requirements, core.identity | Toma como candidatos a los suscriptores del requisito (o al usuario suscripto), excluye al autor si el comando vino con sobre, quita duplicados y descarta a los usuarios sin email | `requirement_subscriptors`, `users` | NOT-06, CON-19 |
| 3 | core.notifications → core.projects | Conserva solo a los que tienen permiso sobre el proyecto del requisito, y solo si el requisito es público | `user_project_permissions`, `requirements` | NOT-06 |
| 4 | core.notifications | Escribe una fila pendiente por destinatario en la transacción del comando; si el comando falla no queda ninguna | `notification_outbox` | NOT-08, NOT-E1 |
| 5 | core.notifications → core.settings | Cada ciclo (cada intervalo de envío configurado) lee el intervalo, el tamaño del lote y los intentos máximos; sin valor válido usa los de fábrica y si no puede leerlos no envía ese ciclo | `system_settings` | NOT-08, NOT-E5, NOT-E6 |
| 6 | core.notifications | Toma el lote de filas pendientes cuyo próximo intento ya llegó, en orden, bloqueándolas sin esperar a las que otra réplica ya tomó | `notification_outbox` | NOT-08 |
| 7 | core.notifications | Arma el mail en HTML y texto con la plantilla del tipo y el enlace al requisito en el portal | — | NOT-07 |
| 8 | core.notifications → servidor SMTP | Envía cada mail, de a uno | — | NOT-08 |
| 9 | core.notifications | Marca la fila enviada; si el envío falla, suma un intento y programa el siguiente con espera creciente, y al llegar a los intentos máximos borra la fila y lo registra | `notification_outbox` | NOT-E2, NOT-E3 |
| 10 | core.notifications | Confirma el ciclo; si falla al confirmar, todo vuelve a pendiente y los mails ya enviados se reenvían en otro ciclo (al menos una vez) | `notification_outbox` | NOT-08, NOT-E4 |
