---
flow: documentacion
requirements: [DOC-01, DOC-02, DOC-03, DOC-04, DOC-05, DOC-06, DOC-09, DOC-11, DOC-12, DOC-13, DOC-E1, DOC-E2, DOC-E3, DOC-E13, DOC-E14]
modules: [api.docs, api.opus, api.other]
---

# Documentación por el módulo jiku-docs y link público

La api no guarda documentación: conoce el estado del módulo por el registro del bus y le reenvía cada operación en nombre de la persona. Un link compartido se abre sin autenticarse en el host público, con rate limit.

| # | Desde → Hacia | Qué pasa | Operación / tabla | Reglas |
|---|---|---|---|---|
| 1 | jiku-docs → `JIKU_MODULES` | El módulo se anuncia escribiendo su clave con su `ModuleRecord` (`module`, `serviceName`, `protocol`, `registeredAt`) | KV `JIKU_MODULES`, clave `docs` | DOC-01 |
| 2 | api → `JIKU_MODULES` y jiku-docs | Al arrancar lee la clave, la observa y cada **intervalo de chequeo de módulos** hace ping; calcula el estado en memoria de la réplica (no instalado, incompatible, no disponible, disponible) | watch de `JIKU_MODULES`; `$SRV.PING.jiku-docs-queries` | DOC-01 |
| 3 | web u opus-web → api | Consulta los módulos instalados; sin el módulo, la documentación no aparece | `GET /api/modules`, `GET /api/opus/modules` | DOC-02, DOC-03 |
| 4 | web → api | Opera sobre la documentación interna | Por ejemplo `GET /api/docs/documents`, `GET /api/docs/documents/{id}`, `PUT /api/docs/documents/{id}`, `POST /api/docs/documents/{id}/shares` | DOC-04, DOC-05, DOC-06, DOC-09, DOC-13 |
| 5 | api → api | Exige el módulo disponible (`module_not_installed`, `module_unavailable`), el rol (`admin` o `user`; en el portal, también `external-user` con permiso de proyecto) y un actor verificado; valida los ids ULID antes de armar el subject | — | DOC-13, DOC-E1, DOC-E2, DOC-E3, DOC-E14, GAR-42 |
| 6 | api → jiku-docs | Publica con el sobre actor del token | `{instance}.{user-id}.jiku-docs-queries.v1.documents.list` y demás consultas; `{instance}.{user-id}.jiku-docs-commands.v1.documents.{id}.update` y demás comandos | DOC-13 |
| 7 | api → PostgreSQL | Completa la respuesta con los nombres de clientes, proyectos, requisitos, tareas y personas referidos | `clients`, `projects`, `requirements`, `objectives`, `people` (rol de solo lectura) | DOC-05 |
| 8 | opus-web → api | El portal pide solo documentos públicos de un proyecto o de un requisito; un documento no público responde 404 | `GET /api/opus/docs/documents`, `GET /api/opus/docs/documents/{id}`, `GET /api/opus/docs/documents/{documentId}/attachments/{id}` | DOC-11, GAR-44 |
| 9 | navegador → api | Abre un link compartido sin credencial, solo en el host de `JIKU_PUBLIC_URL`; cabeceras de solo lectura y log con el token enmascarado | `GET /p/docs/{token}` | DOC-12, GAR-41 |
| 10 | api → api | Aplica el **límite de pedidos de links públicos** por dirección IP y valida el formato del token | `jds_` más 43 caracteres | DOC-12, DOC-E13, GAR-40 |
| 11 | api → jiku-docs | Resuelve el link | `{instance}.{user-id}.jiku-docs-queries.v1.shares.resolve` (CRED-07) | DOC-12 |
| 12 | api → almacenamiento | Si el HTML supera 256 KiB, lo descarga de la URL firmada que devolvió el módulo (hasta 5 MiB, 10 s) | `GET htmlUrl` | DOC-12 |
| 13 | api → navegador | Responde el HTML de solo lectura; ante link inválido, vencido o revocado, exceso de pedidos o módulo caído, la misma página con 404, 429 o 503 | HTML | DOC-E13 |
| 14 | navegador → api → jiku-docs | Un adjunto del link se resuelve y redirige a su URL firmada | `GET /p/docs/{token}/attachments/{id}` → `shares.attachment` → 302 | DOC-12 |
