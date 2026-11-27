---
prefix: ARC
name: Archivos y adjuntos
surfaces: [Gestor interno, Portal de clientes]
covers: Subir archivos directo al almacenamiento con un link firmado, vincularlos a requisitos, tareas y comentarios, verlos, descargarlos y desvincularlos
entities: [Archivo, Adjunto, Configuración del sistema, Requisito, Actividad de requisito, Tarea, Actividad de tarea, Proyecto, Permiso de proyecto, Usuario]
last_requirement: ARC-30
last_failure: ARC-E16
---

# ARC — Archivos y adjuntos

## Requirements
| ID | Requirement | Actor | Origin |
|---|---|---|---|
| ARC-01 | Quien sube un archivo pide primero un permiso de subida con nombre (hasta 255 caracteres), tipo MIME (hasta 100), tamaño en bytes (al menos 1) y, opcional, un checksum; recibe 201 con el id del archivo, un link firmado de subida y su vigencia en segundos | U-01, U-02, U-03 | initial |
| ARC-02 | El archivo se crea en estado de bytes `pending`, activo, a nombre de quien lo pidió, sin estar vinculado a ninguna entidad. Pedir el permiso nunca menciona la entidad a la que se va a adjuntar | — | initial |
| ARC-03 | Los bytes van del navegador directo al almacenamiento con un `PUT` al link firmado: no pasan por la api ni por el bus. El link vale **vigencia del link de subida** | U-01, U-02, U-03 | initial |
| ARC-04 | Se acepta un archivo si su tamaño declarado no supera el **tamaño máximo de archivo**, su extensión (sin distinguir mayúsculas) está en las **extensiones de archivo permitidas** y su tipo MIME está en los **tipos MIME permitidos**; los dos chequeos son obligatorios. Los valores se leen de la configuración del sistema y, sin ella, se usan los de fábrica | — | initial |
| ARC-05 | El tamaño se controla sobre el valor declarado al pedir el permiso: el almacenamiento no limita el tamaño real del `PUT`, y el link firma solo el tipo MIME | — | initial |
| ARC-06 | Las extensiones y tipos permitidos de fábrica incluyen `.svg` / `image/svg+xml` | — | initial |
| ARC-07 | La ubicación del objeto la decide el sistema: `{prefijo}/f/{uuid}{extensión}`, sin la entidad ni el nombre original; el nombre original se guarda aparte. El checksum se guarda tal como lo declara el cliente, sin verificarlo | — | initial |
| ARC-08 | Un archivo se vincula a una entidad al crear o editar esa entidad, o al crear o editar un comentario, mandando sus ids en `fileIds`, hasta **máximo de archivos por operación** por operación. El vínculo se crea en la misma transacción que la entidad: si algo falla, no queda ni la entidad ni el vínculo | U-01, U-02, U-03 | initial |
| ARC-09 | Solo se vinculan archivos subidos por quien hace la operación, existentes y activos; un id repetido se vincula una vez | — | initial |
| ARC-10 | Al vincular, el archivo pasa a estado de bytes `uploaded` sin comprobar que el objeto exista en el almacenamiento | — | initial |
| ARC-11 | Al editar una entidad o comentario, `fileIds` es el conjunto completo que debe quedar vinculado: los nuevos se vinculan, los que faltan se desvinculan, `[]` desvincula todos y si no viene no se toca nada | — | initial |
| ARC-12 | Desvincular borra el vínculo y nunca el archivo: el archivo puede seguir vinculado a otras entidades y su objeto queda en el almacenamiento | — | initial |
| ARC-13 | Los archivos se vinculan a requisitos, comentarios de requisito, tareas y comentarios de tarea. Los tipos de entidad `project`, `stage`, `comment` y los terminados en `_draft` existen en el modelo pero ninguna operación crea vínculos de esos tipos | — | initial |
| ARC-14 | En el gestor, los archivos se insertan en la descripción o el comentario como `[file:N]` (o `![file:N]` si es imagen) y al guardar se mandan los `fileIds` que el texto referencia; el texto también reconoce `[attach:N]` (id de vínculo) | U-01, U-02 | initial |
| ARC-15 | El detalle de un proyecto muestra «Archivos Adjuntos» con sus vínculos de tipo `project` y un cargador para `admin` y `user`. El cargador sube el archivo pero no lo vincula al proyecto, así que no aparece en la lista | U-01, U-02 | initial |
| ARC-16 | La lista de adjuntos de una entidad (`entityType` y `entityId` obligatorios) devuelve sus vínculos activos, del más nuevo al más viejo, con nombre, tamaño, tipo MIME, ubicación en el almacenamiento, estado de bytes y quién lo subió (id, nombre, email). El gestor los muestra de a 3 con «Ver más» | U-01, U-02, U-03 | initial |
| ARC-17 | Un adjunto se consulta por su id de vínculo con los mismos datos | U-01, U-02, U-03 | initial |
| ARC-18 | Ver un adjunto redirige (302) a un link firmado de lectura que lo muestra en el navegador (`inline`); descargarlo redirige a uno que lo baja (`attachment`). El link vale **vigencia del link de descarga**. La respuesta lleva el tipo MIME, `X-Content-Type-Options: nosniff` y, en `HEAD`, el tamaño | U-01, U-02, U-03 | initial |
| ARC-19 | Un archivo también se ve por su id de archivo (`[file:N]`), en el navegador y con el mismo redirect | U-01, U-02, U-03 | initial |
| ARC-20 | Para un usuario interno (`admin` o `user`), ver, listar y descargar adjuntos no tiene más chequeo que estar autenticado; ver un archivo por id alcanza para cualquier archivo activo, vinculado o no | — | initial |
| ARC-21 | Para un `external-user`, ver, listar y descargar adjuntos exige permiso sobre el proyecto de la entidad (requisito, tarea, sus comentarios o el proyecto); no se mira la visibilidad del requisito, la tarea ni el comentario, así que alcanza adjuntos de requisitos y comentarios internos y de tareas | U-03 | initial |
| ARC-22 | Para un `external-user`, ver un archivo por id exige que alguno de sus vínculos sea de una entidad de un proyecto sobre el que tiene permiso, o, si el archivo no tiene vínculos, haberlo subido él | U-03 | initial |
| ARC-23 | El Portal de clientes ve adjuntos por una ruta propia (`/api/opus/attachments/{id}/preview`) que exige rol `user` o `external-user` y el mismo chequeo por entidad | U-02, U-03 | initial |
| ARC-24 | Desvincular un adjunto (por id de vínculo) responde 200 `attachment_unlinked` "Archivo desvinculado". En un adjunto de tarea puede hacerlo un `admin`, quien tiene permiso sobre el proyecto, el creador de la tarea o un responsable; en los demás tipos, cualquier usuario interno | U-01, U-02 | initial |
| ARC-25 | El gestor ofrece desvincular adjuntos de tareas al `admin`, al creador o a un responsable de la tarea, y los demás a `admin` y `user` | U-01, U-02 | initial |
| ARC-26 | Desde el Portal de clientes un `external-user` pide permisos de subida y vincula archivos a los requisitos y comentarios que crea; el portal rechaza antes de pedir el permiso un archivo de más de 10 MiB («El archivo supera el tamaño máximo permitido») o con extensión fuera de jpg, jpeg, png, gif, webp, pdf, doc, docx, xls, xlsx, ppt, pptx («Ese tipo de archivo no está permitido») | U-03 | initial |
| ARC-27 | El gestor solo rechaza en el navegador un archivo vacío: «El archivo "{nombre}" está vacío»; tipo y tamaño los decide el servidor. Traduce `file_not_owned` a «No podés adjuntar un archivo que subió otra persona», `file_too_large` a «El archivo supera el tamaño máximo permitido» y `file_type_not_allowed` a «Ese tipo de archivo no está permitido» | U-01, U-02 | initial |
| ARC-28 | Si el `PUT` al almacenamiento responde 403, el gestor informa «La URL de subida venció. Volvé a intentarlo.»; ante otro error, «Hubo un error al subir el archivo» o «Error de red al subir el archivo», y permite reintentar los que fallaron | U-01, U-02 | initial |
| ARC-29 | Nada borra archivos: un archivo `pending` nunca vinculado, o desvinculado de todo, queda para siempre en la base y en el almacenamiento | — | initial |
| ARC-30 | Un archivo vinculado cuyo `PUT` nunca se hizo entrega igual un link firmado de lectura; el error aparece recién al abrir el link | — | initial |

## Failure conditions
| ID | Condition | Result | Origin |
|---|---|---|---|
| ARC-E1 | Falta nombre, tipo MIME o tamaño en el permiso de subida, o no cumplen su formato | 400 `invalid_fields` "Invalid field - {detalle}" | initial |
| ARC-E2 | El tamaño declarado supera el **tamaño máximo de archivo** | 400 `file_too_large` "El archivo supera el tamaño máximo permitido" | initial |
| ARC-E3 | La extensión o el tipo MIME no están permitidos | 400 `file_type_not_allowed` "Tipo de archivo no permitido" | initial |
| ARC-E4 | Falta la configuración del almacenamiento | 500 `internal_error` "Internal error" | initial |
| ARC-E5 | Algún archivo a vincular no existe | 400 `invalid_fields` "Alguno de los archivos no existe" | initial |
| ARC-E6 | Algún archivo a vincular no está activo | 400 `invalid_fields` "Alguno de los archivos ya no está disponible" | initial |
| ARC-E7 | Algún archivo a vincular lo subió otra persona | 403 `file_not_owned` "Solo se pueden vincular archivos subidos por uno mismo" | initial |
| ARC-E8 | Listar adjuntos sin `entityType` o sin `entityId` / con un `entityType` desconocido / con `entityId` no numérico | 400 `invalid_query` "entityType and entityId are required" / 400 `invalid_entity_type` "entityType must be one of: {tipos}" / 400 `invalid_entity_id` "entityId must be a valid integer" | initial |
| ARC-E9 | Id de vínculo o de archivo no numérico | 400 `invalid_id` "Attachment ID must be a valid integer" / "File ID must be a valid integer" | initial |
| ARC-E10 | El vínculo no existe | 404 `not_found` "Attachment not found" | initial |
| ARC-E11 | El archivo a ver no existe o no está activo | 404 `file_not_found` "Archivo no encontrado" | initial |
| ARC-E12 | Un `external-user` sin permiso sobre la entidad lista, consulta, ve o descarga un adjunto | 403 `access_denied` "You do not have permission to view attachments of this entity" / "…to view this attachment" / "…to preview this attachment" / "…to download this attachment" | initial |
| ARC-E13 | Un `external-user` ve por id un archivo que no alcanza; un `admin` sin rol `user` usa la ruta de adjuntos del portal | 403 `access_denied` "No tenés permiso sobre esta entidad" / 403 `access_denied` "Access denied" | initial |
| ARC-E14 | Desvincular sin permiso sobre la entidad (`external-user`, o usuario interno ajeno a la tarea) / un `external-user` con permiso intenta desvincular | 403 `access_denied` "No tenés permiso para desvincular este archivo" / 403 `caller_not_authorized` "El caller no está autorizado a ejecutar este método" | initial |
| ARC-E15 | Falla inesperada al listar, consultar, descargar, ver o desvincular un adjunto, o al pedir el permiso de subida (por ejemplo, la base no responde, o core devuelve un error interno) | 500 `internal_error` «Failed to list attachments» / «Failed to get attachment» / «Failed to download attachment» / «Failed to preview attachment» / «Failed to delete attachment», o «Internal error» si lo devuelve core | initial |
| ARC-E16 | Permiso de subida, descarga, vista de un archivo o desvinculación sin respuesta de core: nadie atiende el comando, o la respuesta no llega a tiempo | 503 `service_unavailable` «El servicio no está disponible en este momento» (no se hizo); 504 `gateway_timeout` «La operación tardó demasiado» (pudo haberse hecho) | initial |

## Examples
- ARC-04: `informe.PDF` con `application/pdf` y 2 MB se acepta; `informe.pdf` declarado como `application/zip` se rechaza (ARC-E3); `foto.heic` con `image/jpeg` se rechaza por la extensión.
- ARC-05: se pide permiso para `video.png` declarando 1 000 bytes y `image/png`; el `PUT` sube 500 MB con `Content-Type: image/png` y el almacenamiento lo acepta.
- ARC-09/ARC-E7: Ana sube el archivo 15 y Luis intenta adjuntarlo a su comentario: se rechaza y el comentario no se crea.
- ARC-11: el requisito 7 tiene vinculados los archivos 1 y 2; una edición con `fileIds: [2, 3]` deja 2 y 3 (1 se desvincula, el archivo 1 sigue existiendo); con `fileIds: []` no queda ninguno; sin `fileIds` siguen 1 y 2.
- ARC-21: un `external-user` con permiso sobre el proyecto 4 lista los adjuntos de un requisito `internal` del proyecto 4 y los recibe.
- ARC-22: un `external-user` sube el archivo 20 y no lo vincula: puede verlo por id. Lo vincula a un comentario de un requisito del proyecto 4, sobre el que tiene permiso: lo sigue viendo. Si pierde el permiso sobre el proyecto 4, deja de verlo aunque lo haya subido él, porque el archivo ya tiene vínculos.
