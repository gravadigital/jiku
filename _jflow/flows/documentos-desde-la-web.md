---
flow: documentos-desde-la-web
requirements: [DOC-03, DOC-05, DOC-06, DOC-07, DOC-08, DOC-09, DOC-10, DOC-11, DOC-12, DOC-13, DOC-16, DOC-17, DOC-18, DOC-19]
modules: [api.docs, api.portal, core.clients, core.projects, core.requirements, core.tasks]
---

# Documentos desde el gestor y el portal

El equipo lista, crea, edita con reserva, versiona y adjunta archivos a documentos del módulo de documentación desde el gestor; el portal los lee en solo lectura. La api firma cada llamada con la identidad de la persona y el módulo decide los permisos.

| # | From → To | What happens | Operation / table | Rules |
|---|---|---|---|---|
| 1 | web → api.docs | Toda ruta del gestor exige el módulo listo y rol `admin` o `user`; los identificadores que no son ULID responden 404 sin llamar al módulo | `/docs/*` | DOC-03, DOC-E1, DOC-E2, DOC-E3, DOC-E4 |
| 2 | web → api.docs → jiku-docs | La tarjeta de una ficha o la pantalla «Documentación» lista documentos con filtros; con «mis proyectos activos» la api primero busca los proyectos `activo` de la Persona del usuario | `GET /docs/documents` → `documents.list`; `people`, `projects_persons`, `projects` | DOC-05, DOC-06, DOC-16 |
| 3 | api.docs → core.clients, core.projects, core.requirements, core.tasks | Completa los nombres de clientes, proyectos, requisitos y tareas relacionados con una lectura por tipo | `clients`, `projects`, `requirements`, `objectives` | DOC-05 |
| 4 | web → api.docs → jiku-docs | Abre un documento con contenido, relaciones, temas, reserva y adjuntos, o una versión anterior | `GET /docs/documents/{id}` → `documents.get`; `GET /docs/documents/{id}/versions` → `documents.versions.list` | DOC-08, DOC-11 |
| 5 | web → api.docs → jiku-docs | Crea un documento (hasta 256 KiB); la api genera el id si no viene | `POST /docs/documents` → `documents.new` | DOC-07, DOC-E8 |
| 6 | web → api.docs → jiku-docs | Para editar toma la reserva con un id de sesión generado por la web, como edición humana; la renueva cada 60 segundos | `POST /docs/documents/{id}/lock` → `documents.{id}.lock` | DOC-09, DOC-E6 |
| 7 | web → api.docs → jiku-docs | Guarda sobre la versión base; la api agrega el checksum del contenido y la marca de edición humana; otra versión o una reserva ajena responden 409 | `PUT /docs/documents/{id}` → `documents.{id}.update` | DOC-10, DOC-E5, DOC-E6 |
| 8 | web → api.docs → jiku-docs | Al salir de la página libera la reserva; si no llega, vence sola | `POST /docs/documents/{id}/unlock` → `documents.{id}.unlock` | DOC-09 |
| 9 | web → api.docs → jiku-docs | Mueve, borra, restaura una versión o cambia relaciones, siempre con la versión base | `documents.{id}.move`, `documents.{id}.delete`, `documents.{id}.restore`, `documents.{id}.relations.update`, `documents.suggest-relations` | DOC-10, DOC-11, DOC-12, DOC-E9 |
| 10 | web → api.docs → jiku-docs → navegador → S3 | Adjunta un archivo: pide la subida con checksum `sha256`, sube los bytes directo al almacenamiento y confirma | `POST /docs/attachments` → `attachments.request-upload`; `POST /docs/attachments/{id}/confirm` → `attachments.{id}.confirm` | DOC-13, DOC-E14 |
| 11 | web → api.docs → jiku-docs | Descargar un adjunto redirige al link firmado del módulo | `GET /docs/attachments/{id}` → `attachments.{id}.request-download` | DOC-13 |
| 12 | opus-web → api.portal → jiku-docs | El portal lista los documentos `public` de un proyecto o de un requisito público; un usuario de cliente necesita permiso sobre el proyecto | `GET /opus/docs/documents` → `documents.list`; `projects`, `requirements`, `user_project_permissions` | DOC-17, DOC-E16, DOC-E17, DOC-E18 |
| 13 | opus-web → api.portal → jiku-docs | Abre un documento o descarga un adjunto: la api lee el documento y responde 404 si no es `public` o el adjunto no es suyo; no verifica permiso sobre el proyecto | `GET /opus/docs/documents/{id}` → `documents.get`; `GET /opus/docs/documents/{documentId}/attachments/{id}` → `documents.get` + `attachments.{id}.request-download` | DOC-18, DOC-19, DOC-E19 |
| 14 | jiku-docs → api → frontend | Las fallas del módulo se traducen a estado HTTP; sin respuesta a tiempo, 504; sin respuesta, 503 y el módulo pasa a «no disponible» | — | DOC-E7, DOC-E15 |
