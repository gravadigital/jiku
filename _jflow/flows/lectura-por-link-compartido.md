---
flow: lectura-por-link-compartido
requirements: [DOC-14, DOC-15, DOC-20, DOC-21, DOC-22, ACC-15]
modules: [api.docs, api.public-docs]
---

# Lectura de un documento por link compartido

Un miembro del equipo crea un link público de un documento; cualquier visitante lo abre sin autenticarse en el host público de la instalación y ve una página HTML con el documento.

| # | From → To | What happens | Operation / table | Rules |
|---|---|---|---|---|
| 1 | web → api.docs | Crea el link con modo, vencimiento, adjuntos, nota y la confirmación de la advertencia de secretos; sin URL pública configurada responde 404 sin llamar al módulo | `POST /docs/documents/{id}/shares` | DOC-14, DOC-E11 |
| 2 | api.docs → jiku-docs | Publica la creación con la identidad de la persona; el módulo devuelve el link y su token, que se muestran una sola vez | `shares.new` | DOC-14, DOC-E12, DOC-E13 |
| 3 | web → api.docs → jiku-docs | Lista los links del documento por estado y revoca uno | `GET /docs/documents/{id}/shares` → `shares.list`; `DELETE /docs/shares/{id}` → `shares.{id}.revoke` | DOC-15 |
| 4 | visitante → api.public-docs | Abre el link sin token de acceso: en el host público solo se sirve `/p/docs`; cualquier otra ruta, o `/p/docs` en otro host, responde la página «Este link no está disponible» | `GET /p/docs/{token}` | ACC-15, DOC-21 |
| 5 | api.public-docs | Agrega cabeceras que impiden indexar, cachear y cargar recursos externos salvo imágenes; aplica el límite de 60 pedidos por minuto por IP y réplica | — | DOC-20, DOC-22, DOC-E21 |
| 6 | api.public-docs → jiku-docs | Con un token de forma válida pide el documento compartido sin identidad de persona | `shares.resolve` | DOC-20, DOC-E20 |
| 7 | jiku-docs → api.public-docs → visitante | Responde la página HTML con el título y el contenido (o lo descarga del link que entrega el módulo); cualquier error del módulo da la misma página de no disponible, y un módulo caído o lento, la de servicio no disponible | — | DOC-20, DOC-E20, DOC-E21 |
| 8 | visitante → api.public-docs → jiku-docs | Las imágenes y adjuntos de la página se piden por el mismo link y redirigen al link firmado del almacenamiento | `GET /p/docs/{token}/attachments/{id}` → `shares.attachment` | DOC-20 |
