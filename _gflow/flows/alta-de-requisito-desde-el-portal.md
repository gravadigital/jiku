---
flow: alta-de-requisito-desde-el-portal
requirements: [REQ-03, REQ-20, REQ-E2, REQ-E11, SUS-04, ADJ-03, ACC-11, ACC-12, ACC-E4, NOT-01, BUS-10]
modules: [api.opus, core.requirements, core.files, core.identity, core.notifications, core.events]
---

# Alta de un requisito desde el Portal de clientes

Un Cliente (o un Miembro del equipo) crea un requisito desde el modal «Nuevo requisito»: un único comando crea el requisito, sus suscripciones y sus vínculos de archivo, y encola el mail para los suscriptores.

| # | Desde → Hacia | Qué pasa | Operación / tabla | Reglas |
|---|---|---|---|---|
| 1 | navegador → opus-web | Antes de guardar, sube los archivos elegidos (flujo subida-y-vinculo-de-adjunto) y elige suscriptores entre los usuarios del proyecto | `GET /api/opus/projects/{projid}/users`, `POST /api/opus/attachments` | SUS-04 |
| 2 | navegador → opus-web → api | Envía el alta por el proxy del portal, que agrega el Bearer de la sesión | `POST /api/opus/requirements` vía `/api/opus/[...path]` | REQ-03 |
| 3 | api → PostgreSQL | Valida el cuerpo y que el proyecto exista | `projects` (rol de solo lectura) | REQ-E2 |
| 4 | api → core | Publica un solo comando con el creador = la persona del token, los suscriptores con el creador siempre incluido y los ids de archivo, más el sobre actor | `{instance}.{user-id}.jiku-commands.v1.requirements.new` | SUS-04, ACC-10 |
| 5 | core → core | Autoriza: `external-user` solo con sobre actor; para la clase `external` resuelve el proyecto del cuerpo y exige su permiso | `user_project_permissions` | ACC-11, ACC-12, ACC-E4, REQ-E11, GAR-31, GAR-32 |
| 6 | core → PostgreSQL | En la transacción crea el requisito (visibilidad pública por defecto), sus suscripciones sin repetir y vincula los archivos del creador | `requirements` (`id` → `requirement_subscriptors.requirement_id`, `attachments.entity_id`), `requirement_subscriptors`, `attachments`, `files` | INV-01, INV-03, ADJ-03, GAR-02, GAR-06, GAR-19 |
| 7 | core → PostgreSQL | Encola el mail de nuevo requisito para los suscriptores con email y permiso de proyecto, sin el creador, y confirma | `notification_outbox`; `COMMIT` | NOT-01, GAR-23, GAR-27 |
| 8 | core → `JIKU_EVENTS` | Publica el evento de alta | `{instance}.events.v1.requirement.created` | BUS-10, GAR-29 |
| 9 | api → opus-web | Relee la fila completa y responde | 201 con la fila de `requirements` | REQ-20 |
