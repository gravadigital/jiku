---
flow: vinculacion-de-archivos
requirements: [ARC-08, ARC-09, ARC-10, ARC-11, ARC-12, ARC-13, ARC-14, ARC-24, ARC-25, REQ-32, TAR-27, REQ-33, TAR-13]
modules: [api.requirements, api.tasks, api.portal, api.files, core.requirements, core.tasks, core.files]
---

# Vinculación y desvinculación de archivos

Al crear o editar un requisito, una tarea o un comentario se mandan los ids de archivos ya subidos; core crea o ajusta los vínculos en la misma transacción que la entidad. Desvincular borra solo el vínculo.

| # | From → To | What happens | Operation / table | Rules |
|---|---|---|---|---|
| 1 | web / opus-web | El texto inserta los archivos como `[file:N]` y al guardar se envían los `fileIds` que referencia (hasta 10) | — | ARC-14, ARC-08 |
| 2 | web / opus-web → api.requirements, api.tasks, api.portal | Guarda la entidad o el comentario con `fileIds` | `POST /requirements`, `PATCH /requirements/{reqid}`, `POST /requirements/{reqid}/comments`, `PATCH /requirements/{reqid}/comments/{cid}`, `POST /objectives`, `PATCH /objectives/{id}`, `POST /objectives/{id}/comments`, `PATCH /objectives/{id}/comment/{cid}`, `POST /opus/requirements`, `POST /opus/requirements/{reqid}/comments` | ARC-08 |
| 3 | api → core | La api publica el comando de la entidad con los `fileIds` y el sobre de identidad | `requirements.new`, `requirements.{id}.edit`, `requirements.{id}.comment`, `requirements.{id}.comment.{cid}.edit`, `tasks.new`, `tasks.{id}.edit`, `tasks.{id}.comment`, `tasks.{id}.comment.{cid}.edit` | ARC-13 |
| 4 | core.requirements, core.tasks | Escribe la entidad o el comentario dentro de la transacción del comando | `requirements`, `requirement_activity`, `objectives`, `objective_activity` | REQ-33, TAR-13 |
| 5 | core.requirements, core.tasks → core.files | En altas y comentarios nuevos: quita ids repetidos y exige que cada archivo exista, esté activo y lo haya subido el actor | `files` | ARC-09, ARC-E5, ARC-E6, ARC-E7 |
| 6 | core.requirements, core.tasks → core.files | En ediciones, `fileIds` es el conjunto completo: borra los vínculos que faltan y valida solo los nuevos; si no viene, no toca nada | `attachments` | ARC-11 |
| 7 | core.files | Marca los archivos `uploaded` sin comprobar el almacenamiento y crea un vínculo por archivo con el tipo y el id de la entidad | `files`, `attachments` (`attachments.entity_id` = id de la entidad, `attachments.file_id` = `files.id`) | ARC-10, ARC-13 |
| 8 | core | Si cualquier vínculo falla, no queda ni la entidad ni el vínculo | — | REQ-32, TAR-27, ARC-08 |
| 9 | web → api.files | Desvincular un adjunto por su id de vínculo; la api verifica el acceso a la entidad (en tareas: `admin`, permiso sobre el proyecto, creador o responsable) | `DELETE /attachments/{id}` | ARC-24, ARC-25, ARC-E10, ARC-E14 |
| 10 | api.files → core.files | Publica el borrado del vínculo; el archivo y su objeto quedan | `attachments.{id}.delete`, `attachments` | ARC-12 |
