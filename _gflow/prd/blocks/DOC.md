---
prefix: DOC
name: Documentación
surfaces: [Gestión interna, Portal de clientes]
covers: El módulo opcional de documentación (jiku-docs) visto desde el producto - estado del módulo, búsqueda, documentos con versiones y reserva de edición, compartir por link, la documentación pública del portal y los links públicos sin autenticación
entities: [Proyecto, Requisito, Tarea, Cliente]
last_requirement: DOC-13
last_failure: DOC-E25
---

# DOC — Documentación

## Requisitos
| ID | Requisito | Actor | Origen |
|---|---|---|---|
| DOC-01 | La documentación es un módulo opcional que se anuncia en el registro de módulos del bus; el producto conoce su estado (no instalado, incompatible, no disponible, disponible) leyendo el registro y verificándolo cada **intervalo de chequeo de módulos**; incompatible se trata como no instalado, y una llamada sin respuesta lo marca no disponible | — | inicial |
| DOC-02 | Consultar los módulos instalados, su estado y si permiten compartir; las dos superficies lo vuelven a consultar cada 60 s | U-01, U-02, U-03 | inicial |
| DOC-03 | Sin el módulo instalado, la documentación no aparece en ninguna superficie: ni el menú, ni los paneles de proyecto, requisito y tarea, y sus pantallas responden «no encontrado» | U-01, U-02, U-03 | inicial |
| DOC-04 | Buscar documentos en Gestión interna: listado con filtros por proyecto, cliente, tema, persona, requisito, tarea, visibilidad, sin proyecto, sin cliente, sin tema y mis proyectos activos, orden, conteo y paginado por cursor; búsqueda de texto de 2 a 1000 caracteres; sugerencias de proyectos (primero los activos del usuario), clientes, personas y temas | U-01, U-02 | inicial |
| DOC-05 | Ver un documento en su versión actual o en una anterior, con sus vínculos a clientes, proyectos, requisitos y tareas, su historial de versiones y las relaciones sugeridas (por ejemplo, el proyecto para un documento sin proyecto) | U-01, U-02 | inicial |
| DOC-06 | Crear un documento con título, cliente, proyecto, temas y visibilidad (repetir el alta no lo duplica); editarlo contra la versión en que se basó, con una reserva de edición de **duración de la reserva de edición** que la pantalla renueva cada 60 s y libera al salir; moverlo, restaurar una versión anterior como versión nueva, borrarlo y cambiar sus vínculos (hasta 100 por pedido) | U-01, U-02 | inicial |
| DOC-07 | Visibilidad de un documento: interno, visible para el cliente o restringido; solo un `admin` crea un documento restringido o le cambia esa visibilidad, y un documento restringido no se comparte | U-01, U-02 | inicial |
| DOC-08 | Adjuntar archivos a un documento: se pide la subida con checksum SHA-256, se sube directo al almacenamiento y se confirma; se descargan por redirección | U-01, U-02 | inicial |
| DOC-09 | Compartir un documento por link (si el módulo lo permite y hay un host público configurado): vence según los **vencimientos de links compartidos**, con nota opcional y con o sin adjuntos; el link se muestra una sola vez; se listan los links del documento con estado, accesos y último acceso, y se revocan | U-01, U-02 | inicial |
| DOC-10 | Guardar o compartir un documento que parece contener una clave o un token avisa; para compartirlo hay que confirmar «Compartir igual» | U-01, U-02 | inicial |
| DOC-11 | En el portal, ver la documentación pública de un proyecto o de un requisito (sección «Documentación (n)», de a 5 con «Ver más»), abrir un documento público en markdown de solo lectura y descargar sus adjuntos | U-03, U-02, U-01 | inicial |
| DOC-12 | Abrir un link compartido sin autenticarse, solo en el host público configurado: muestra en HTML de solo lectura la última versión del documento y sus adjuntos por redirección, con a lo sumo **límite de pedidos de links públicos** por dirección IP; cualquier error responde la misma página | U-05 | inicial |
| DOC-13 | Toda operación de documentación interna exige el rol `admin` o `user`, y las del portal `admin`, `user` o `external-user`, con permiso de proyecto para un Cliente | — | inicial |

## Condiciones de falla
| ID | Condición | Resultado | Origen |
|---|---|---|---|
| DOC-E1 | El módulo no está instalado o es incompatible | 404 `module_not_installed` («El módulo docs no está instalado») | inicial |
| DOC-E2 | El módulo no responde | 503 `module_unavailable` («El módulo docs no está disponible en este momento»); la pantalla muestra «La documentación no está disponible en este momento. Probá de nuevo en unos minutos.» | inicial |
| DOC-E3 | El documento, la carpeta, el adjunto o el link no existe, o su id no tiene formato ULID | 404 `document_not_found` / `folder_not_found` / `attachment_not_found` / `share_not_found` | inicial |
| DOC-E4 | Se guarda o restaura sobre una versión que ya no es la actual | 409 `version_conflict`; la pantalla conserva el texto y muestra la versión ajena para comparar | inicial |
| DOC-E5 | Otra persona tiene la reserva de edición | 409 `document_locked`, con quién y hasta cuándo; la pantalla muestra «{nombre} lo está editando hasta las HH:mm. Podés leerlo mientras tanto.» | inicial |
| DOC-E6 | Quien no es `admin` crea, restringe o quita la restricción de un documento, o edita uno que no le corresponde | 403 `permission_denied`; la pantalla muestra «Solo la conducción puede restringir un documento.» | inicial |
| DOC-E7 | Se comparte sin host público configurado | 404 `sharing_not_configured` («Los links compartidos no están configurados») | inicial |
| DOC-E8 | Se comparte un documento restringido | 403 `sharing_blocked` | inicial |
| DOC-E9 | Se comparte un documento con posible secreto sin confirmar | 400 `secret_warning_not_acknowledged` | inicial |
| DOC-E10 | Se pide una versión que ya fue compactada | 404 `version_pruned`, con las versiones más cercanas | inicial |
| DOC-E11 | El contenido o los vínculos no son válidos | 400 `frontmatter_invalid` / `invalid_relation` / `content_too_large` | inicial |
| DOC-E12 | En el portal, el documento no es público o no existe, o se piden a la vez (o ninguno) proyecto y requisito | 404 `document_not_found`; 400 `invalid_fields` | inicial |
| DOC-E13 | Un link público inválido, vencido o revocado, demasiados pedidos o el módulo caído | La misma página HTML con 404, 429 o 503 | inicial |
| DOC-E14 | Llamada al módulo sin persona identificada | 401 `unauthorized` | inicial |
| DOC-E15 | En el portal, el requisito o el proyecto del filtro de documentos no existe | 404 `requirement_not_found` / `project_not_found` | inicial |
| DOC-E16 | jiku-docs no responde a tiempo, o informa que la base cortó la consulta | 504 `gateway_timeout` / `query_timeout` | inicial |
| DOC-E17 | Se crea un documento, un adjunto o un link con un id que ya existe, o se mueve a una ruta ocupada | 409 `already_exists` | inicial |
| DOC-E18 | jiku-docs rechaza la entrada: cursor inválido, búsqueda semántica sin configurar o nombre de archivo inválido | 400 `invalid_cursor` / `semantic_search_not_configured` / `file_name_invalid` | inicial |
| DOC-E19 | Al confirmar un adjunto, el checksum no coincide con lo subido | 400 `checksum_mismatch` | inicial |
| DOC-E20 | Se libera una reserva de edición que quien la pide no tiene | 409 `lock_not_held` | inicial |
| DOC-E21 | Se confirma un adjunto cuya subida jiku-docs no encuentra | 400 `upload_not_found` | inicial |
| DOC-E22 | Se pide subir a un documento un adjunto de tipo no permitido o demasiado grande | 400 `attachment_type_not_allowed` / `attachment_too_large` | inicial |
| DOC-E23 | Se comparte con un vencimiento fuera de los **vencimientos de links compartidos** | 400 `share_expiry_invalid` | inicial |
| DOC-E24 | jiku-docs rechaza la operación porque la carpeta no está vacía | 409 `folder_not_empty` | inicial |
| DOC-E25 | Una dependencia de jiku-docs no responde: su core, o el almacenamiento de adjuntos sin configurar | 503 `upstream_unavailable` / `attachments_not_configured`, con el código y el mensaje del módulo | inicial |
