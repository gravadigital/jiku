---
prefix: ADJ
name: Archivos adjuntos
surfaces: [Gestión interna, Portal de clientes]
covers: Pedir la subida de un archivo con URL firmada y política de tamaño y tipo, vincularlo a requisitos, tareas y comentarios, listarlo, previsualizarlo o descargarlo por redirección y desvincularlo
entities: [Archivo, Adjunto, Ajuste del sistema]
last_requirement: ADJ-11
last_failure: ADJ-E12
---

# ADJ — Archivos adjuntos

## Requisitos
| ID | Requisito | Actor | Origen |
|---|---|---|---|
| ADJ-01 | Pedir la subida de un archivo con nombre (hasta 255 caracteres), tipo MIME (hasta 100), tamaño (al menos 1 byte) y checksum opcional: si cumple la política, queda registrado como pendiente a nombre de quien lo sube y se devuelve su id y una URL firmada de subida que vence a la **vida de la URL de subida**; el navegador sube los bytes directo al almacenamiento | U-01, U-02, U-03 | inicial |
| ADJ-02 | Política de archivos: tamaño hasta el **tamaño máximo de archivo**, extensión entre las **extensiones permitidas** (sin distinguir mayúsculas) y tipo MIME exacto entre los **tipos MIME permitidos**, las dos cosas; se lee de los ajustes del sistema en cada pedido y un valor ausente o ilegible usa el de fábrica | — | inicial |
| ADJ-03 | Al crear o editar un requisito, una tarea o un comentario se vinculan hasta **archivos por entidad** archivos, solo subidos por quien vincula y vigentes; en la edición la lista es el conjunto completo: vincula los nuevos y desvincula los que faltan | U-01, U-02, U-03 | inicial |
| ADJ-04 | En el texto (markdown) los archivos se referencian como `[file:N]` (imagen: `![file:N]`) o `[attach:N]`, y se muestran como tarjetas al final del contenido, con nombre, tamaño y descarga | U-01, U-02, U-03 | inicial |
| ADJ-05 | Listar los adjuntos vigentes de una entidad (proyecto, requisito, tarea o comentario) con los datos de su archivo: un usuario interno ve los de cualquier entidad; un Cliente, los de entidades de proyectos donde tiene permiso | U-01, U-02, U-03 | inicial |
| ADJ-06 | Previsualizar (en línea) o descargar un adjunto: tras autorizar como en ADJ-05, responde con una redirección a una URL firmada de lectura que vence a la **vida de la URL de descarga**; la pantalla previsualiza solo imágenes y PDF | U-01, U-02, U-03 | inicial |
| ADJ-07 | Previsualizar un archivo por su id de archivo, sin autorización por entidad: cualquier token válido lo obtiene; por el bus, un Cliente obtiene la descarga de un archivo si algún vínculo vigente está en un proyecto donde tiene permiso o si es un archivo propio sin vincular | — | inicial |
| ADJ-08 | Desvincular un adjunto: se borra el vínculo y el archivo se conserva. Un usuario interno desvincula cualquiera, salvo en tareas, donde puede un `admin`, el creador, un responsable o quien tiene permiso de proyecto; un Cliente no puede desvincular (core le rechaza el comando aunque tenga permiso de proyecto). La confirmación anuncia «Se va a eliminar el archivo {nombre} en 7 días» | U-01, U-02, U-03 | inicial |
| ADJ-09 | La sección «Archivos Adjuntos» del proyecto permite subir archivos a un `admin` o `user`, pero ningún comando los vincula al proyecto: quedan pendientes y la lista del proyecto muestra solo los vínculos que ya existen | U-01, U-02 | inicial |
| ADJ-10 | El portal valida antes de subir que el archivo pese hasta 10 MB y tenga una de sus extensiones (jpg, jpeg, png, gif, webp, pdf, doc, docx, xls, xlsx, ppt, pptx), y sube de a uno con barra de progreso; Gestión interna solo valida que no esté vacío y sube en cola, con reintento de los que fallan | U-01, U-02, U-03 | inicial |
| ADJ-11 | Los archivos que nunca se vinculan quedan pendientes indefinidamente: no hay retención ni limpieza | — | inicial |

## Condiciones de falla
| ID | Condición | Resultado | Origen |
|---|---|---|---|
| ADJ-E1 | El archivo supera el tamaño máximo | 400 `file_too_large` («El archivo supera el tamaño máximo permitido») | inicial |
| ADJ-E2 | La extensión o el tipo MIME no están permitidos | 400 `file_type_not_allowed` («Tipo de archivo no permitido»); la pantalla muestra «Ese tipo de archivo no está permitido» | inicial |
| ADJ-E3 | Se vincula un archivo subido por otra persona | 403 `file_not_owned` («Solo se pueden vincular archivos subidos por uno mismo»); la pantalla muestra «No podés adjuntar un archivo que subió otra persona» | inicial |
| ADJ-E4 | Se vincula un archivo que no existe o que ya no está vigente | 400 `invalid_fields` («Alguno de los archivos no existe» / «Alguno de los archivos ya no está disponible») | inicial |
| ADJ-E5 | Más archivos que el máximo por entidad, o tamaño menor que 1 | 400 `invalid_fields` | inicial |
| ADJ-E6 | El id de adjunto o de archivo no es un entero | 400 `invalid_id` | inicial |
| ADJ-E7 | Listar sin tipo o id de entidad, con un tipo desconocido o con un id no entero | 400 `invalid_query` / `invalid_entity_type` / `invalid_entity_id` | inicial |
| ADJ-E8 | El adjunto no existe | 404 `not_found` («Attachment not found») | inicial |
| ADJ-E9 | Quien pide no tiene acceso a la entidad del adjunto | 403 `access_denied` | inicial |
| ADJ-E10 | El archivo no existe o no está vigente al pedir la descarga | 404 `file_not_found` («Archivo no encontrado»); la pantalla muestra «El archivo no está disponible» | inicial |
| ADJ-E11 | La URL de subida venció antes de subir los bytes | La pantalla muestra «La URL de subida venció. Volvé a intentarlo.» (Gestión interna) o «La URL de subida venció. Intentá de nuevo.» (portal) | inicial |
| ADJ-E12 | Archivo vacío o fuera de la validación del portal | La pantalla muestra «El archivo "{nombre}" está vacío», «El archivo supera el tamaño máximo permitido» o «Ese tipo de archivo no está permitido» sin enviarlo | inicial |
