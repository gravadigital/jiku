---
flow: sincronizacion-de-identidades
requirements: [ACC-18, ACC-19, CON-01, CON-02, CON-04]
modules: [core.identity]
---

# Sincronización de identidades al conectarse al bus

Cada vez que una identidad (persona, conector o servicio) se conecta al bus, el auth-callout la autoriza y avisa a core, que copia su usuario y sus roles; esos roles son los que core lee después para autorizar.

| # | From → To | What happens | Operation / table | Rules |
|---|---|---|---|---|
| 1 | cliente del bus → NATS | La identidad se conecta con las credenciales sentinel (sin permisos propios) y un token del proveedor de identidad | — | CON-01 |
| 2 | NATS → auth-callout | El auth-callout valida el token, lee los roles del proyecto y completa el perfil con la información de usuario del proveedor | — | CON-01 |
| 3 | auth-callout | Elige la primera regla de rol que coincide (`docs`, `internal-app`, `core`, `admin`, `user`, `external-user`) y emite los permisos de su plantilla, con publicación limitada a subjects bajo la identidad propia; sin regla, la conexión se rechaza | — | CON-01, CON-02 |
| 4 | auth-callout → core.identity | Publica el evento de autenticación (versión 2) con id, nombre, usuario, email, roles y la regla elegida; no es durable | `{instance}.events.auth` | — |
| 5 | core.identity | Una réplica de core lo recibe por su grupo de cola y lo valida: versión, instancia igual a la propia, id, y email obligatorio salvo para las reglas `internal-app`, `core` y `docs`; si no es válido se descarta con log | `{instance}.events.auth` | ACC-18 |
| 6 | core.identity | En una transacción crea o actualiza el usuario reemplazando nombre, usuario, email, roles y tipo (servicio para `internal-app`, `core` y `docs`; persona para el resto) | `users` | ACC-18 |
| 7 | core.identity | Confirma; si el manejo falla, deshace y el evento se pierde hasta la próxima conexión | `users` | — |
| 8 | api → core.identity | Camino paralelo: cada comando que la api publica en nombre de una persona trae el sobre; core crea o actualiza ese usuario con los roles y solo los datos de perfil presentes | `users` | ACC-19 |
| 9 | core (comandos y consultas directas) → core.identity | Al autorizar a un caller directo, core lee sus roles guardados en ese momento, sin cache | `users.roles` | CON-04 |
