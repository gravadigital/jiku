---
flow: subida-y-vinculo-de-adjunto
requirements: [ADJ-01, ADJ-02, ADJ-03, ADJ-04, ADJ-10, ADJ-11, ADJ-E1, ADJ-E2, ADJ-E3, ADJ-E4, ADJ-E5, ADJ-E11, ADJ-E12]
modules: [api.attachments, api.opus, api.requirements, api.objectives, core.files, core.settings, core.requirements, core.tasks]
---

# Subida de un archivo y vínculo con una entidad

El navegador pide un ticket de subida, sube los bytes directo al almacenamiento con la URL firmada y, al guardar el requisito, la tarea o el comentario, el comando vincula los archivos en su transacción.

| # | Desde → Hacia | Qué pasa | Operación / tabla | Reglas |
|---|---|---|---|---|
| 1 | navegador → web u opus-web | La pantalla valida el archivo antes de pedir nada (vacío en Gestión interna; tamaño y extensión en el portal) | — | ADJ-10, ADJ-E12 |
| 2 | web u opus-web → api | Pide el ticket con nombre, tipo MIME, tamaño y checksum opcional | `POST /api/attachments` (Gestión interna) o `POST /api/opus/attachments` (portal, por el proxy `/api/opus/[...path]`) | ADJ-01, ADJ-E5 |
| 3 | api → core | Publica el pedido de subida con el sobre actor | `{instance}.{user-id}.jiku-commands.v1.files.request-upload` | ACC-10 |
| 4 | core → PostgreSQL | Lee la política vigente | `system_settings` (`file-max-size-bytes`, `file-allowed-extensions`, `file-allowed-mime-types`, `upload-url-ttl-seconds`) | ADJ-02, ADJ-E1, ADJ-E2, GAR-50 |
| 5 | core → PostgreSQL | Registra el archivo a nombre del actor con una clave de almacenamiento nueva | `files` (`byte_status` `pending`, `retention_status` `active`, `uploaded_by` = actor) | INV-12, GAR-15, GAR-16 |
| 6 | core → api | Firma una URL `PUT` que vence a la **vida de la URL de subida** y responde | `{ id, uploadUrl, expiresIn }` | — |
| 7 | api → navegador | Devuelve el ticket | 201 `{ fileId, uploadUrl, expiresIn }` | — |
| 8 | navegador → almacenamiento | Sube los bytes directo con la URL firmada; si venció, la pantalla pide reintentar | `PUT uploadUrl` | ADJ-E11 |
| 9 | web u opus-web → api | Al guardar la entidad, envía los ids de archivo (`[file:N]` en el texto) | `fileIds` en `POST /api/requirements`, `PATCH /api/requirements/{reqid}`, `POST /api/objectives`, `PATCH /api/objectives/{id}`, comentarios y `POST /api/opus/requirements` | ADJ-03, ADJ-04 |
| 10 | api → core | Publica el comando de la entidad | `requirements.new`, `requirements.{id}.edit`, `requirements.{id}.comment`, `tasks.new`, `tasks.{id}.edit`, `tasks.{id}.comment` y sus ediciones de comentario | — |
| 11 | core → PostgreSQL | En la transacción del comando valida cada archivo: existe, `retention_status` `active` y `uploaded_by` = actor; hasta **archivos por entidad** | `files` | INV-15, ADJ-E3, ADJ-E4, ADJ-E5, GAR-19 |
| 12 | core → PostgreSQL | Sincroniza los vínculos de la entidad (conserva, crea los nuevos, borra los que faltan) y marca los archivos como subidos sin verificar el almacenamiento | `attachments` (`file_id` = `files.id`, `entity_type`, `entity_id`); `files.byte_status` → `uploaded` | INV-13, INV-14, INV-16, GAR-17, GAR-18, GAR-20 |
| 13 | core → PostgreSQL | Confirma junto con la escritura de la entidad, o revierte todo | `COMMIT` / `ROLLBACK` | BUS-08, GAR-27 |
| 14 | — | Un archivo que nunca se vincula queda `pending` sin limpieza | `files` | ADJ-11 |
