---
flow: subida-de-archivos
requirements: [ARC-01, ARC-02, ARC-03, ARC-04, ARC-05, ARC-07, ARC-26, ARC-27, ARC-28, ARC-29, CON-09]
modules: [api.files, api.portal, core.files, core.settings]
---

# Subida de archivos con link firmado

Quien va a adjuntar un archivo pide primero un permiso de subida; core registra el archivo como pendiente y firma un link, y el navegador sube los bytes directo al almacenamiento. El archivo queda sin vincular hasta que una operación lo vincula (ver vinculacion-de-archivos).

| # | From → To | What happens | Operation / table | Rules |
|---|---|---|---|---|
| 1 | web / opus-web | El gestor solo rechaza un archivo vacío; el portal rechaza además por tamaño y extensión con su propia lista | — | ARC-26, ARC-27 |
| 2 | web / opus-web → api.files | Pide el permiso con nombre, tipo MIME, tamaño y checksum opcional, sin mencionar la entidad (el gestor desde el servidor; el portal por su proxy) | `POST /attachments`, `POST /opus/attachments` | ARC-01, ARC-02, ARC-E1 |
| 3 | api.files → core.files | La api valida la forma (no chequea rol), pone como quien sube al usuario del token y publica con el sobre de identidad; con sobre, también `external-user` tiene este comando | `files.request-upload` | CON-09 |
| 4 | core.files → core.settings | Lee el tamaño máximo, las extensiones y los tipos MIME permitidos y la vigencia del link de subida; sin configuración usa los valores de fábrica | `system_settings` | ARC-04 |
| 5 | core.files | Rechaza si el tamaño declarado supera el máximo o si la extensión o el tipo MIME no están permitidos | — | ARC-04, ARC-05, ARC-E2, ARC-E3 |
| 6 | core.files | Decide la ubicación del objeto, crea el archivo `pending`, activo, a nombre de quien sube, y firma un `PUT` que fija solo el tipo MIME; falta de configuración del almacenamiento termina en error interno | `files` | ARC-02, ARC-07, ARC-E4 |
| 7 | core.files → api.files → navegador | Responde id, link de subida y vigencia; la api responde 201 sin releer la base | `files.id` → `fileIds` de la operación que vincula | ARC-01 |
| 8 | navegador → almacenamiento S3 | Sube los bytes con `PUT` al link firmado, sin pasar por la api ni por el bus; el almacenamiento no limita el tamaño real | — | ARC-03, ARC-05 |
| 9 | navegador | Si el `PUT` responde 403 el gestor informa que el link venció y permite reintentar | — | ARC-28 |
| 10 | core.files | Si el archivo nunca se vincula queda `pending` para siempre: nada lo borra | `files` | ARC-29 |
