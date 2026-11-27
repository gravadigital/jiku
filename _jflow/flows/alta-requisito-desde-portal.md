---
flow: alta-requisito-desde-portal
requirements: [POR-10, POR-11, POR-12, POR-17, REQ-01, REQ-02, REQ-05, REQ-33, ARC-09, ARC-10, ARC-26, CON-09, CON-11, NOT-01, NOT-06, CON-15]
modules: [api.portal, api.files, core.requirements, core.projects, core.files, core.identity, core.notifications]
---

# Alta de requisito desde el portal de clientes

Un usuario de cliente (o un miembro del equipo) crea un requisito en un proyecto desde el portal, con archivos opcionales; queda suscripto y se avisa por email a los demás suscriptores.

| # | From → To | What happens | Operation / table | Rules |
|---|---|---|---|---|
| 1 | opus-web | Antes de pedir la subida, el portal rechaza archivos de más de 10 MiB o con extensión fuera de su propia lista | — | ARC-26 |
| 2 | opus-web → api.files → core.files | Por cada archivo pide un permiso de subida y sube los bytes directo al almacenamiento (ver flujo subida-de-archivos) | `POST /opus/attachments` → `files.request-upload` | `files.id` → `fileIds` del paso 4 |
| 3 | opus-web | El modal arma el alta: «Sin tipo» se envía como `otro`, prioridad por defecto `sin_prioridad` y los suscriptores elegidos | — | POR-10, POR-11 |
| 4 | opus-web → api.portal | El navegador llama al proxy del portal, que reenvía a la api con el token de acceso de la sesión | `POST /opus/requirements` | — |
| 5 | api.portal → core.projects | La api valida la forma (hasta 10 archivos) y responde 404 si el proyecto no existe; no chequea rol ni permiso | `projects` | POR-E7, POR-E8, POR-E9 |
| 6 | api.portal → core.requirements | Agrega al creador a los suscriptores, pone como creador al usuario del token y publica con el sobre de identidad | `requirements.new` | POR-12 |
| 7 | core.identity | core espeja el usuario del sobre y autoriza con sus roles: con sobre, `external-user` y `user` tienen este comando | `users` | CON-09 |
| 8 | core.requirements → core.projects | Para un caller `external-user`, exige permiso sobre el proyecto del alta; al equipo no se le verifica | `user_project_permissions` | POR-17, CON-11, POR-E10 |
| 9 | core.requirements | Crea el requisito con los valores por defecto (`analisis`, `public`) dentro de la transacción del comando | `requirements` | REQ-01, REQ-02 |
| 10 | core.requirements → core.files | Vincula los archivos subidos por el mismo creador y los marca subidos | `files`, `attachments` | ARC-09, ARC-10 |
| 11 | core.requirements → core.identity | Verifica que existan los usuarios suscriptores y los agrega sin repetir | `users`, `requirement_subscriptors` | REQ-05, POR-E11 |
| 12 | core.requirements → core.notifications | Encola un aviso de requisito nuevo por cada suscriptor que corresponda, excluido el creador | `notification_outbox` | NOT-01, NOT-06 |
| 13 | core.requirements | Si cualquier paso falla no queda nada; si no, confirma y después publica el evento de dominio | `requirement.created` | REQ-33, CON-15 |
| 14 | api.portal → opus-web | Relee el requisito y responde 201; el portal muestra «Elemento creado» | `requirements` | POR-10 |
