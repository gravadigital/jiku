---
flow: escritura-por-el-bus
requirements: [CON-02, CON-03, CON-04, CON-05, CON-06, CON-07, CON-08, CON-09, CON-10, CON-11, CON-15, CON-19, CON-20, REQ-33, TAR-13, NOT-08]
modules: [api.access, core.identity, core.projects, core.notifications]
---

# Escritura por el bus: el recorrido de un comando

Toda escritura del producto es un comando a core: lo publica la api en nombre de una persona (con el sobre de identidad) o un conector o una persona directo en el bus. core autoriza, ejecuta todo en una transacción y responde.

| # | From → To | What happens | Operation / table | Rules |
|---|---|---|---|---|
| 1 | api / conector / persona → NATS | Publica el comando en el subject de comandos con su propia identidad como segundo segmento; el bus rechaza otra identidad o un método que la plantilla del rol no permite | `{instance}.{userId}.jiku-commands.v1.{método}` | CON-02, CON-05, CON-E1 |
| 2 | api → NATS | Si publica la api, el cuerpo lleva además el sobre de identidad armado con el token ya verificado; sin respuesta responde 503 y sin respuesta a tiempo 504 | el comando + sobre `actor` | CON-08 |
| 3 | NATS → core | Una réplica de core lo recibe por el grupo de cola; un cuerpo que no es JSON se rechaza | — | CON-E7 |
| 4 | core.identity | Solo el publicador de confianza puede traer sobre, y el sobre tiene que tener id y lista de roles; si viene, espeja el usuario del sobre | `users` | CON-08, CON-E4, CON-E5, ACC-19 |
| 5 | core.identity | Roles que deciden: los del sobre; sin sobre, el publicador de confianza pasa sin leer la base como conector; el resto, los roles guardados del usuario, leídos sin cache | `users.roles` | CON-04, CON-10, CON-E14 |
| 6 | core.identity | Autoriza el método con la unión de los roles (con sobre, `user` suma la suscripción y `external-user` tiene seis comandos) y resuelve la clase del caller, la más restrictiva | — | CON-03, CON-06, CON-09, CON-E2 |
| 7 | core | Busca el comando (método inexistente rechazado) y valida el cuerpo con su esquema | — | CON-E8 |
| 8 | core.identity → core.projects | Para un caller externo, exige permiso sobre el proyecto de la entidad que toca el comando | `user_project_permissions` | CON-11, CON-E9 |
| 9 | core.* | Abre la transacción y ejecuta: la autoría es el caller del subject o el id del sobre; el cuerpo no la puede cambiar | tablas del comando | CON-07, CON-E6 |
| 10 | core.* → core.notifications | Si el comando declaró avisos, los encola en la misma transacción | `notification_outbox` | NOT-08, CON-19 |
| 11 | core | Confirma si el resultado es éxito y deshace si no o si algo lanza: nunca queda media escritura | — | REQ-33, TAR-13 |
| 12 | core → NATS | Después de confirmar publica los eventos de dominio del comando; si falla, solo lo registra | `{instance}.events.v1.{tipo}` | CON-15 |
| 13 | core → publicador | Responde éxito con los datos del comando (por ejemplo el id) o falla con `errorCode`, `errorMessage` y, si aplica, `errorDetails`; repetir el comando lo ejecuta de nuevo | — | CON-20 |
| 14 | api → frontend | La api traduce el código de falla a estado HTTP, o relee la base para responder el recurso | — | — |
