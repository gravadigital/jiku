---
flow: descarga-de-adjunto
requirements: [ADJ-05, ADJ-06, ADJ-07, ADJ-E6, ADJ-E8, ADJ-E9, ADJ-E10, ACC-12, ACC-13]
modules: [api.attachments, api.opus, core.files, core.settings, core.identity]
---

# Previsualización o descarga de un adjunto

La api autoriza el acceso a la entidad del adjunto, core firma una URL de lectura y el navegador sigue un 302 hasta el almacenamiento. La api nunca maneja los bytes.

| # | Desde → Hacia | Qué pasa | Operación / tabla | Reglas |
|---|---|---|---|---|
| 1 | navegador → web u opus-web | Abre el adjunto; el route handler de Next valida la sesión y llama a la api con `redirect: 'manual'` | web: `/api/attachments/{id}/preview` o `/download`, `/api/files/{id}/preview`; opus-web: `/api/attachments/{id}/preview`, `/api/files/{id}/preview` | — |
| 2 | web u opus-web → api | Pide la redirección con el Bearer de la sesión | `GET /api/attachments/{id}/preview`, `GET /api/attachments/{id}/download`, `GET /api/opus/attachments/{id}/preview` (solo `user` o `external-user`) o `GET /api/files/{id}/preview` | ACC-13, ADJ-E6 |
| 3 | api → PostgreSQL | Lee el vínculo y su archivo, resuelve el proyecto de la entidad y verifica el acceso del usuario (un Cliente, con permiso de proyecto); por id de archivo no hay autorización por entidad | `attachments`, `files`, `user_project_permissions` (rol de solo lectura) | ADJ-05, ADJ-07, ADJ-E8, ADJ-E9, GAR-43 |
| 4 | api → core | Pide la URL de lectura con el sobre actor | `{instance}.{user-id}.jiku-commands.v1.files.{fileId}.request-download` con `disposition` `inline` o `attachment` (`fileId` = `attachments.file_id`) | ACC-10 |
| 5 | core → PostgreSQL | Para un Cliente exige que algún vínculo vigente del archivo esté en un proyecto con permiso, o que sea un archivo sin vincular subido por él; exige `retention_status` `active` | `files`, `attachments`, `user_project_permissions` | ACC-12, ADJ-E10, GAR-32 |
| 6 | core → api | Firma una URL `GET` que vence a la **vida de la URL de descarga** | `{ downloadUrl, expiresIn, fileName, mimeType, fileSize }` | ADJ-06 |
| 7 | api → web u opus-web | Responde 302 con `Location` = `downloadUrl`; `file_not_found` responde 404 | 302 | ADJ-06, ADJ-E10 |
| 8 | web u opus-web → navegador | Propaga el 302 con `X-Content-Type-Options: nosniff` | 302 | — |
| 9 | navegador → almacenamiento | Sigue la redirección; la pantalla previsualiza imágenes y PDF | `GET downloadUrl` | ADJ-06 |
