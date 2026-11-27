---
prefix: DOC
name: Documentación
surfaces: [Gestor interno, Portal de clientes, Documento compartido]
covers: Documentos en markdown del módulo opcional de documentación - búsqueda, alta, edición con reserva y versiones, relaciones, adjuntos y links públicos desde el gestor, lectura de los documentos públicos en el portal y lectura anónima por link compartido
entities: [Proyecto, Cliente, Requisito, Tarea, Persona, Permiso de proyecto]
last_requirement: DOC-22
last_failure: DOC-E25
---

# DOC — Documentación

## Requirements
| ID | Requirement | Actor | Origin |
|---|---|---|---|
| DOC-01 | La documentación es un módulo opcional externo. Se detecta por su registro en el bus y se verifica con un ping cada 30 segundos (2 segundos de espera); su estado es «no instalado», «no disponible» o «disponible». Un registro inválido o con un protocolo no soportado cuenta como «no instalado» | — | initial |
| DOC-02 | Cualquier identidad con rol `admin`, `user` o `external-user` consulta el estado de los módulos y si los links públicos están habilitados (lo están cuando la instalación tiene configurada su URL pública). El gestor lo vuelve a consultar cada 60 segundos y oculta «Documentación» del menú cuando el módulo no está instalado | U-01, U-02, U-03 | initial |
| DOC-03 | Qué documento puede leer, editar, restringir o compartir cada persona lo decide el módulo de documentación con la identidad de la persona; la api solo exige rol `admin` o `user` en el gestor | — | initial |
| DOC-04 | La pantalla «Documentación» muestra los documentos propios y los editados recientemente, busca por texto (de 2 a 1000 caracteres, hasta 50 resultados) y sugiere proyectos y clientes (por nombre o código) y temas | U-01, U-02 | initial |
| DOC-05 | El equipo lista documentos filtrando por proyectos, requisito, tarea, clientes, carpeta, prefijo de ruta, temas, si tienen o no proyecto, cliente o tema, persona (creador o último editor), visibilidad (`internal`, `public`, `restricted`) o «mis proyectos activos», con orden por actualización, creación, título o ruta (por defecto la última actualización primero), paginado por cursor (hasta 200 por página) y, a pedido, el total. Cada documento trae los nombres de sus clientes y proyectos | U-01, U-02 | initial |
| DOC-06 | «Mis proyectos activos» son los proyectos en estado `activo` en los que participa la Persona del usuario; si no tiene ninguno, la lista vuelve vacía | — | initial |
| DOC-07 | El equipo crea un documento en markdown (hasta 256 KiB) con carpeta y nombre de archivo opcionales (si faltan, los decide el módulo); la api genera el identificador si no viene. La visibilidad `restricted` solo la puede elegir «la conducción» (la pantalla la ofrece solo al administrador) | U-01, U-02 | initial |
| DOC-08 | El equipo ve un documento con su contenido, relaciones, temas, reserva de edición y adjuntos, o una versión anterior por número | U-01, U-02 | initial |
| DOC-09 | Para editar se toma una reserva con un identificador de sesión: dura 120 segundos por defecto (entre 30 y 300 si se pide), la pantalla la renueva cada 60 segundos y la libera al salir de la página; si el pedido de liberación no llega, vence sola | U-01, U-02 | initial |
| DOC-10 | Guardar, mover, renombrar, borrar y cambiar relaciones exigen la versión sobre la que se editó. Si el contenido parece contener una clave o un token, se guarda igual y la pantalla avisa «Guardaste la versión {n}. Revisalo: parece contener una clave o un token.» | U-01, U-02 | initial |
| DOC-11 | El equipo consulta el historial de versiones y restaura una versión anterior como versión nueva | U-01, U-02 | initial |
| DOC-12 | El equipo agrega o quita relaciones de un documento con clientes, proyectos, requisitos y tareas (hasta 100 de cada uno) y recibe sugerencias de relaciones; el módulo agrega el cliente de cada proyecto relacionado | U-01, U-02 | initial |
| DOC-13 | El equipo adjunta archivos a un documento: pide la subida con nombre, tipo, tamaño (mínimo 1 byte) y checksum `sha256`, sube el archivo directo al almacenamiento y la confirma; la descarga redirige al archivo. El gestor ofrece un enlace estable `/docs/attachments/{id}` | U-01, U-02 | initial |
| DOC-14 | El equipo crea un link público de un documento: modo «última versión» o «versión fija», vencimiento de 7, 15, 30, 90 o 180 días (por defecto 30), con o sin adjuntos, una nota y la confirmación de la advertencia de secretos. El link y su token se muestran una sola vez («Copiá el link ahora: por seguridad, no lo vas a poder volver a ver.») | U-01, U-02 | initial |
| DOC-15 | El equipo lista los links de un documento por estado (`active`, `revoked`, `expired`) y los revoca | U-01, U-02 | initial |
| DOC-16 | El detalle de proyecto, de requisito y de tarea del gestor muestra la tarjeta de documentos relacionados | U-01, U-02 | initial |
| DOC-17 | En el portal, el tablero del proyecto y el detalle de un requisito público muestran «Documentación ({n})» con los documentos `public` del proyecto o del requisito, de a 5 con «Ver más»; la sección se oculta si el módulo no está instalado o no hay documentos | U-03, U-02 | initial |
| DOC-18 | En el portal se abre un documento `public` de solo lectura («Actualizado el DD/MM/AAAA»), con sus adjuntos | U-03, U-02 | initial |
| DOC-19 | Abrir un documento público o descargar su adjunto en el portal no verifica permiso sobre el proyecto: cualquier identidad con rol `external-user`, `user` o `admin` que conozca el identificador de un documento `public` lo lee | — | initial |
| DOC-20 | Un visitante abre un link compartido `/p/docs/{token}` sin autenticarse: recibe una página HTML con el título y el contenido que entrega el módulo, sin marca del producto, con cabeceras que impiden indexarla, cachearla y cargar recursos externos salvo imágenes; las imágenes y adjuntos se sirven por `/p/docs/{token}/attachments/{id}` redirigiendo al almacenamiento sin enviar el link como referencia | U-05 | initial |
| DOC-21 | Los links compartidos solo se sirven en el host de la URL pública configurada; en ese host cualquier otra ruta o método responde la página «Este link no está disponible», y `/p/docs` pedido en otro host también | — | initial |
| DOC-22 | Cada dirección IP puede pedir hasta 60 veces por minuto las rutas `/p/docs` (el conteo es por réplica de la api) | — | initial |

## Failure conditions
| ID | Condition | Result | Origin |
|---|---|---|---|
| DOC-E1 | El módulo no está instalado | 404 `module_not_installed` «El módulo docs no está instalado»; en el gestor `/docs` responde 404 y en el portal la sección no se muestra | initial |
| DOC-E2 | El módulo está instalado pero no responde | 503 `module_unavailable` «El módulo docs no está disponible en este momento»; el gestor muestra «La documentación no está disponible en este momento. Probá de nuevo en unos minutos.» | initial |
| DOC-E3 | Una ruta del gestor se pide sin rol `admin` ni `user` | 403 `access_denied` «Access denied» | initial |
| DOC-E4 | El identificador de un documento, carpeta, adjunto o link no tiene forma de ULID | 404 `document_not_found` «Documento no encontrado» (o `folder_not_found` «Carpeta no encontrada», `attachment_not_found` «Adjunto no encontrado», `share_not_found` «Link compartido no encontrado»), igual que uno inexistente y sin consultar el módulo | initial |
| DOC-E5 | Se guarda sobre una versión que ya no es la última | 409 `version_conflict` con la versión actual en `details` | initial |
| DOC-E6 | El documento está reservado por otra sesión, o se libera una reserva que no se tiene | 409 `document_locked` con quién lo tiene y hasta cuándo / 409 `lock_not_held` | initial |
| DOC-E7 | La persona no tiene permiso sobre el documento | 403 `permission_denied`; el gestor muestra «No tenés permiso para editar este documento.» o, al restringir, «Solo la conducción puede restringir un documento.» | initial |
| DOC-E8 | El contenido supera 256 KiB, o el cuerpo del pedido supera 768 KiB | 400 `content_too_large` («El documento supera los 256 KiB que se pueden guardar desde acá.») / 413 `payload_too_large` «El cuerpo de la solicitud supera el límite permitido» | initial |
| DOC-E9 | Una relación nombra un cliente, proyecto, requisito o tarea que no existe, o las propiedades del documento no son válidas | 400 `invalid_relation` / 400 `frontmatter_invalid` | initial |
| DOC-E10 | Se pide «mis proyectos activos» junto con un proyecto | 400 `invalid_fields` «Invalid field - {detalle}» | initial |
| DOC-E11 | Se crea un link público sin URL pública configurada | 404 `sharing_not_configured` «Los links compartidos no están configurados»; el gestor muestra «Compartir no está habilitado en esta instalación.» | initial |
| DOC-E12 | El vencimiento del link no es válido | 400 `share_expiry_invalid`; el gestor muestra «El vencimiento no es válido. Elegí entre 7 y 180 días.» | initial |
| DOC-E13 | El documento parece contener un secreto y no se confirmó la advertencia, o el módulo bloquea compartirlo | 400 `secret_warning_not_acknowledged` / 403 `sharing_blocked` | initial |
| DOC-E14 | Un adjunto tiene un tipo no permitido o supera el tamaño máximo | 400 `attachment_type_not_allowed` («Ese tipo de archivo no está permitido.») / 400 `attachment_too_large` («El archivo supera el tamaño máximo permitido.») | initial |
| DOC-E15 | El módulo no responde a tiempo | 504 `gateway_timeout` «La operación tardó demasiado» | initial |
| DOC-E16 | En el portal se pide la lista con proyecto y requisito a la vez o sin ninguno de los dos | 400 `invalid_fields` «Invalid field - {detalle}» | initial |
| DOC-E17 | En el portal el proyecto o el requisito no existe, o el requisito es `internal` | 404 `project_not_found` «Project not found» / 404 `requirement_not_found` «Requirement not found» | initial |
| DOC-E18 | En el portal un usuario de cliente lista documentos de un proyecto sin permiso | 403 `access_denied` «Access denied for this project.»; la pantalla muestra «No tenés acceso a la documentación de este proyecto.» | initial |
| DOC-E19 | En el portal se abre un documento que no es `public`, o un adjunto que no es de ese documento | 404 `document_not_found` «Documento no encontrado» / 404 `attachment_not_found` «Adjunto no encontrado»; la pantalla muestra «Este documento no existe o no está compartido con vos.» | initial |
| DOC-E20 | El token del link no tiene la forma esperada, no existe, venció o fue revocado, el adjunto no es del documento o el módulo no está instalado | 404 con la página «Este link no está disponible» / «Puede que haya vencido o que lo hayan revocado. Pedile un link nuevo a quien te lo compartió.», igual para cualquier causa | initial |
| DOC-E21 | Se superan los pedidos por minuto, o el módulo no está disponible o no responde | 429 «Demasiados intentos» / «Esperá un minuto y volvé a intentar.» · 503 «El documento no está disponible en este momento» / «Probá de nuevo en unos minutos.» | initial |
| DOC-E22 | Un parámetro o campo del pedido falta, sobra o no cumple su formato (lo valida la api o jiku-docs), o el cursor de paginación no es válido | 400 `invalid_fields` «Invalid field - {detalle}» / 400 `invalid_cursor` con el mensaje del módulo | initial |
| DOC-E23 | jiku-docs rechaza la escritura: el nombre de archivo no es válido, el checksum no coincide con el contenido, o la subida que se confirma no existe | 400 `file_name_invalid` / `checksum_mismatch` / `upload_not_found`, con el mensaje del módulo | initial |
| DOC-E24 | Se crea un documento, adjunto o link con un id que ya existe (por ejemplo, al reintentar después de un 504), o se mueve un documento a una ruta ocupada | 409 `already_exists` con el mensaje del módulo | initial |
| DOC-E25 | Falla inesperada en la api o en jiku-docs (por ejemplo, la base no responde, o el módulo devuelve un código que la api no traduce) | 500 `internal_error` «Internal error» (o el `code` del módulo sin traducir) | initial |

## Examples
- DOC-14: un link creado el 2026-11-27 con vencimiento de 30 días vence el 2026-12-27; a partir de entonces `/p/docs/{token}` responde la página de DOC-E20.
- DOC-19: Laura (usuaria de cliente) no tiene permiso sobre el proyecto P, pero con el identificador de un documento `public` relacionado a P lo abre en el portal; la lista de documentos de P, en cambio, le responde DOC-E18.
