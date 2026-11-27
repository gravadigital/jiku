---
flow: lectura-de-archivos
requirements: [ARC-16, ARC-17, ARC-18, ARC-19, ARC-20, ARC-21, ARC-22, ARC-23, ARC-30, CON-09, CON-11]
modules: [api.files, api.portal, core.files, core.settings, core.projects]
---

# Lectura de archivos: ver y descargar

Quien ve o descarga un adjunto, o un archivo por su id, recibe una redirección a un link firmado de lectura; los bytes bajan del almacenamiento directo al navegador.

| # | From → To | What happens | Operation / table | Rules |
|---|---|---|---|---|
| 1 | navegador → web / opus-web | El navegador abre la ruta propia del frontend, que reenvía a la api con el token de la sesión y devuelve la redirección sin seguirla | `/api/attachments/{id}/preview`, `/api/attachments/{id}/download`, `/api/files/{id}/preview` | — |
| 2 | web → api.files | Gestor: ver o descargar un adjunto por su id de vínculo | `GET /attachments/{id}/preview`, `GET /attachments/{id}/download` | ARC-18 |
| 3 | opus-web → api.portal | Portal: ver un adjunto por su ruta propia, que exige rol `user` o `external-user` | `GET /opus/attachments/{id}/preview` | ARC-23 |
| 4 | api.files → core.files, core.projects | La api lee el vínculo y verifica el acceso a la entidad: un interno pasa; un `external-user` necesita permiso sobre el proyecto de la entidad, sin mirar visibilidad | `attachments`, `requirements`, `objectives`, `requirement_activity`, `objective_activity`, `user_project_permissions` | ARC-20, ARC-21, ARC-E9, ARC-E10, ARC-E12 |
| 5 | api.files → core.files | Publica el pedido de descarga del archivo del vínculo con `inline` o `attachment` y el sobre de identidad | `files.{fileId}.request-download` (`attachments.file_id` → `{fileId}`) | CON-09 |
| 6 | web / opus-web → api.files | Archivo por id (`[file:N]`): la api no verifica nada y publica el mismo pedido con `inline` | `GET /files/{id}/preview` → `files.{fileId}.request-download` | ARC-19, ARC-20 |
| 7 | core.files → core.projects | Para un caller externo, core exige que algún vínculo del archivo sea de un proyecto con permiso o, sin vínculos, que lo haya subido él | `attachments`, `user_project_permissions` | ARC-22, CON-11, ARC-E13 |
| 8 | core.files → core.settings | Verifica que el archivo exista y esté activo, lee la vigencia del link de descarga y firma un `GET` con la disposición pedida; no comprueba que el objeto exista | `files`, `system_settings` | ARC-18, ARC-30, ARC-E11 |
| 9 | api.files → navegador | Responde 302 al link firmado con el tipo MIME y `X-Content-Type-Options: nosniff` | — | ARC-18 |
| 10 | navegador → almacenamiento S3 | El navegador baja el archivo directo del almacenamiento | — | ARC-30 |
| 11 | web / opus-web → api.files | Para mostrar la lista, el frontend pide los adjuntos de la entidad o uno por su id, con el mismo chequeo de acceso | `GET /attachments`, `GET /attachments/{id}`, `attachments`, `files`, `users` | ARC-16, ARC-17, ARC-E8 |
