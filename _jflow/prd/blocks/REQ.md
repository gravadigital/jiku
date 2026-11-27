---
prefix: REQ
name: Requisitos
surfaces: [Gestor interno]
covers: Alta, edición, estados y resolución de requisitos por el equipo interno, con responsables, etiquetas, comentarios, reporte y horas trabajadas por requisito
entities: [Requisito, Actividad de requisito, Proyecto, Persona, Usuario, Tarea, Horas trabajadas, Archivo, Adjunto]
last_requirement: REQ-38
last_failure: REQ-E18
---

# REQ — Requisitos

## Requirements
| ID | Requirement | Actor | Origin |
|---|---|---|---|
| REQ-01 | El equipo crea un requisito en un proyecto existente con título y descripción obligatorios y, opcionales, tipo (`funcionalidad`, `mejora`, `incidencia`, `otro` o sin tipo), prioridad, estado inicial, visibilidad, responsables, fecha estimada de cierre, etiquetas, alcance, solución técnica, criterios de aceptación, suscriptores y archivos. El creador queda registrado como el usuario que hizo la llamada | U-01, U-02 | initial |
| REQ-02 | Sin valores explícitos, el requisito nace con prioridad `sin_prioridad`, estado `analisis` y visibilidad `public`. El formulario del gestor propone estado `analisis` y visibilidad `public`, y ofrece solo proyectos en estado `analisis` o `activo` | — | initial |
| REQ-03 | El alta responde 201 con el requisito creado, su proyecto (id, nombre) y sus responsables (id, nombre, apellido, `isLeader`) | U-01, U-02 | initial |
| REQ-04 | Los responsables se guardan en el orden recibido; el primero de la lista queda como líder (`isLeader` verdadero) y los demás sin marca de líder | — | initial |
| REQ-05 | Los suscriptores indicados en el alta (`subscriberUserIds`, ids de usuario) se agregan al requisito; un id repetido se cuenta una sola vez. Después del alta, la suscripción se administra solo desde el Portal de clientes (bloque POR): el gestor interno no la ofrece | U-01, U-02 | initial |
| REQ-06 | El equipo edita cualquier campo del requisito en forma parcial: un campo ausente no se toca. Responde 200 con el requisito releído, su proyecto y sus responsables | U-01, U-02 | initial |
| REQ-07 | Si la edición trae la lista de responsables, la reemplaza completa: se borran los anteriores y se crean los nuevos con el primero como líder | — | initial |
| REQ-08 | Las etiquetas son una lista de pares `{clave, valor}`; al editarlas se reemplaza la lista entera | — | initial |
| REQ-09 | Las transiciones de estado son libres: cualquiera de los siete estados (`analisis`, `planificacion`, `en_cola`, `desarrollo`, `revision`, `resuelto`, `cancelado`) es alcanzable desde cualquier otro | — | initial |
| REQ-10 | Al entrar por primera vez a `planificacion`, `desarrollo` o `revision` se registra la fecha de esa primera entrada (`scheduledAt`, `inProgressAt`, `inReviewAt`); volver a entrar no la cambia | — | initial |
| REQ-11 | Cada entrada a `resuelto` registra la fecha de finalización (`finishedAt`), reescribiéndola si el requisito se reabrió y volvió a resolverse. Salir de `resuelto` no la borra | — | initial |
| REQ-12 | Pasar a `resuelto` un requisito de tipo `incidencia` exige tipo de resolución (`error_interno`, `fuera_de_alcance`, `error_externo`, `discutible`, `otro`) y conclusión, tomados de la misma edición o, si no vienen, de los ya guardados. El tipo que cuenta es el que el requisito tenía antes de la edición. Para los demás tipos la resolución es opcional | — | initial |
| REQ-13 | Al reabrir un requisito (salir de `resuelto` hacia un estado distinto de `cancelado`) se limpian juntos el tipo de resolución, la conclusión y el comentario de resolución, salvo los valores que la misma edición traiga explícitos. Pasar de `resuelto` a `cancelado` conserva la resolución | — | initial |
| REQ-14 | Cada cambio de título, descripción o estado queda en la actividad del requisito como entrada pública con valor anterior, valor nuevo y autor. Los cambios de los demás campos (tipo, prioridad, fecha estimada, etiquetas, resolución, responsables, visibilidad, alcance, solución técnica, criterios) no dejan entrada en la actividad | — | initial |
| REQ-15 | En el detalle, la tarjeta de estado muestra el avance por Análisis, Planificación, En cola, Desarrollo y Revisión, y ofrece «Pasar a {estado}» hacia el siguiente: para `incidencia` se saltea En cola; desde Revisión no hay siguiente; desde Resuelto o Cancelado el siguiente es Desarrollo. Permite guardar alcance, solución técnica, criterios de aceptación y fecha estimada de cierre junto con la transición | U-01, U-02 | initial |
| REQ-16 | La tarjeta «Resolución» ofrece «Resolver» (pasa a `resuelto`, con tipo, conclusión y comentario de resolución en la misma escritura cuando el requisito es `incidencia`), «Cancelar» (pasa a `cancelado`) y, con el requisito cerrado, «Reabrir» (pasa a `desarrollo`). Los campos de resolución se muestran solo para `incidencia`; al reabrir, el gestor los propone de nuevo con los valores previos hasta recargar la página | U-01, U-02 | initial |
| REQ-17 | La fecha de finalización que muestra la tarjeta «Resolución» es la de la última entrada de la actividad que pasó el estado a `resuelto` | — | initial |
| REQ-18 | En el encabezado del detalle se editan en línea el título, el tipo y la prioridad; el formulario «Editar» permite cambiar todos los campos, incluido el estado y la visibilidad | U-01, U-02 | initial |
| REQ-19 | La visibilidad del requisito es `public` o `internal`. El equipo interno ve todos los requisitos, de cualquier visibilidad; un requisito `internal` no se muestra en el Portal de clientes | — | initial |
| REQ-20 | El equipo agrega un comentario a un requisito con visibilidad `public` o `internal` (por defecto `internal`) y hasta **máximo de archivos por operación** archivos. Responde 201 con la entrada de actividad creada | U-01, U-02 | initial |
| REQ-21 | El autor de un comentario lo edita (texto y conjunto completo de archivos); un `admin` edita el de cualquiera. La edición registra fecha y autor de la edición y no cambia la visibilidad del comentario. Responde 200 `comment_updated` "Comment Updated". El gestor ofrece editar comentarios ajenos solo a `admin` | U-01, U-02 | initial |
| REQ-22 | El listado de requisitos filtra por proyecto, uno o varios estados (separados por coma), tipo, prioridad, creador, fecha estimada de cierre, etiqueta (`clave:valor`) y texto en el título (sin distinguir mayúsculas), pagina de a 20 por defecto (hasta 100) y ordena siempre por fecha de alta descendente. Cada fila trae proyecto y responsables | U-01, U-02 | initial |
| REQ-23 | Con `count=true` el listado devuelve solo la cantidad de requisitos que cumplen los filtros | U-01, U-02 | initial |
| REQ-24 | Con `include=totalMinutes` cada requisito del listado trae los minutos trabajados totales: los cargados directo al requisito más los cargados a sus tareas | U-01, U-02 | initial |
| REQ-25 | La pantalla «Requisitos» filtra por defecto los estados `planificacion`, `en_cola`, `desarrollo` y `revision`, pagina de a 15 y muestra la columna «Hs. Trab.» | U-01, U-02 | initial |
| REQ-26 | El detalle de un requisito trae proyecto, creador (id, nombre, email, tipo de identidad), responsables con marca de líder, toda su actividad (pública e interna) con el usuario que la hizo, y las tareas vinculadas con sus responsables. El orden de la actividad no está garantizado | U-01, U-02 | initial |
| REQ-27 | Desde el detalle, «nueva tarea» abre el alta de tareas con el proyecto y el requisito ya elegidos | U-01, U-02 | initial |
| REQ-28 | Las horas trabajadas de un requisito suman los minutos cargados directo al requisito y los cargados a sus tareas, agrupados por persona (id, nombre, apellido, minutos) de mayor a menor, con el total | U-01, U-02 | initial |
| REQ-29 | Las sugerencias de etiquetas de un proyecto devuelven, por cada clave usada en los requisitos de ese proyecto, la lista de valores distintos; con `keyQuery` se quedan las claves que contienen ese texto (distinguiendo mayúsculas) | U-01, U-02 | initial |
| REQ-30 | El «Reporte de Requisitos» lista todos los requisitos que cumplen los filtros, sin paginar: texto (si es solo dígitos busca por id, si no por título sin distinguir mayúsculas), rango de fecha de alta (desde las 00:00 del día inicial hasta las 23:59:59.999 del final, en UTC) y proyecto | U-01, U-02 | initial |
| REQ-31 | Cada fila del reporte trae id, título, tipo, estado, creador, fecha de alta, fecha de entrada a desarrollo, fecha de finalización, minutos trabajados totales (directos más los de sus tareas), tipo, conclusión y comentario de resolución, y proyecto | U-01, U-02 | initial |
| REQ-32 | Los archivos del requisito se vinculan con `fileIds` en el alta; en la edición `fileIds` es el conjunto completo que debe quedar vinculado (los que faltan se desvinculan, `[]` desvincula todos, ausente no toca nada). El gestor arma ese conjunto con los archivos referenciados en la descripción | U-01, U-02 | initial |
| REQ-33 | El alta, la edición y el comentario de un requisito son atómicos: si falla cualquier parte (responsables, suscriptores, archivos) no queda ni el requisito, ni sus responsables, ni ningún vínculo | — | initial |
| REQ-34 | Listar, ver el detalle, ver las horas trabajadas, el reporte, las sugerencias de etiquetas y editar comentarios exigen rol `user` o `admin`. Crear, editar y comentar no lo chequean en la api: lo decide core según el rol | — | initial |
| REQ-35 | Un usuario `external-user` con permiso sobre el proyecto puede crear un requisito por la ruta interna con cualquier estado, visibilidad, responsables y suscriptores | U-03 | initial |
| REQ-36 | Un usuario `external-user` con permiso sobre el proyecto puede comentar por la ruta interna un requisito `internal` y elegir visibilidad `internal` para su comentario | U-03 | initial |
| REQ-37 | El gestor no muestra los mensajes de validación del formulario de requisito: solo marca «(obligatorio)» junto a la descripción | — | initial |
| REQ-38 | Un comentario `public` en un requisito `public` dispara la notificación de comentario a los suscriptores; el alta, la resolución y la reapertura disparan las suyas (detalle en NOT) | — | initial |

## Failure conditions
| ID | Condition | Result | Origin |
|---|---|---|---|
| REQ-E1 | Falta título, descripción o proyecto, o un campo no cumple su formato o valor permitido | 400 `invalid_fields` "Invalid field - {detalle}" | initial |
| REQ-E2 | El proyecto del alta no existe | 404 `project_not_found` "Project not found" | initial |
| REQ-E3 | El requisito no existe (editar, comentar, editar comentario, detalle, horas trabajadas) | 404 `requirement_not_found` "Requirement not found" | initial |
| REQ-E4 | Algún responsable no existe, o la lista trae un id repetido | 400 `invalid_responsible_person` "Responsible person does not exist" | initial |
| REQ-E5 | Algún suscriptor del alta no existe | 404 `user_not_found` "User not found" | initial |
| REQ-E6 | Pasar a `resuelto` una `incidencia` sin tipo de resolución o sin conclusión (ni en la edición ni guardados) | 400 `resolution_required` "Se requiere tipo y conclusión para resolver un requisito" | initial |
| REQ-E7 | Editar un comentario ajeno sin ser `admin` | 403 `comment_not_owned` "Solo el autor del comentario puede editarlo" | initial |
| REQ-E8 | El comentario a editar no existe en ese requisito | 400 `comment_not_found` "Comentario no encontrado" | initial |
| REQ-E9 | La entrada de actividad a editar no es un comentario | 400 `activity_not_editable` "La actividad no es un comentario editable" | initial |
| REQ-E10 | Más de **máximo de archivos por operación** archivos en una operación | 400 `invalid_fields` "Invalid field - {detalle}" | initial |
| REQ-E11 | Listar, ver detalle, horas, reporte o sugerencias, o editar un comentario, sin rol `user` ni `admin` | 403 `access_denied` "Access denied" | initial |
| REQ-E12 | Editar un requisito con un rol que core no autoriza (p. ej. `external-user` por la ruta interna) | 403 `caller_not_authorized` "El caller no está autorizado a ejecutar este método" | initial |
| REQ-E13 | `external-user` crea o comenta un requisito de un proyecto sobre el que no tiene permiso | 403 `access_denied` "No tenés permiso sobre esta entidad" | initial |
| REQ-E14 | Edición con `estimatedFinishDate: null` (la api no lo acepta) o con `tags: null` (la api lo acepta y core lo rechaza): la fecha estimada y las etiquetas no se pueden vaciar con `null` | 400 `invalid_fields` "Invalid field - {detalle}" / 400 `invalid_fields` "\"tags\" must be an array" | initial |
| REQ-E15 | Id de requisito no numérico, o `priority` del listado fuera del enum | 500 `internal_error` "Internal error" | initial |
| REQ-E16 | Filtro `tag` cuyo valor contiene comilla simple: se incrusta sin parametrizar en la consulta | Altera la consulta SQL; si queda inválida, 500 `internal_error` "Internal error" | initial |
| REQ-E17 | El bus no responde a tiempo, o no está disponible | 504 `gateway_timeout` "La operación tardó demasiado" / 503 `service_unavailable` "El servicio no está disponible en este momento" | initial |
| REQ-E18 | Falla inesperada al leer requisitos, su reporte, las sugerencias de etiquetas o las horas trabajadas, o al ejecutar el alta, la edición o un comentario en core (por ejemplo, la base no responde) | 500 `internal_error` «Internal error» («Internal server error» si falla la lectura previa al alta) | initial |

## Examples
- REQ-09/REQ-10: un requisito en `analisis` pasa a `desarrollo` el 03/03 (registra `inProgressAt` = 03/03), vuelve a `planificacion` el 05/03 (registra `scheduledAt` = 05/03) y regresa a `desarrollo` el 10/03: `inProgressAt` sigue siendo 03/03.
- REQ-11: resuelto el 01/04 (`finishedAt` = 01/04), reabierto el 02/04 (`finishedAt` sigue 01/04) y resuelto de nuevo el 08/04: `finishedAt` = 08/04.
- REQ-12: una `incidencia` con tipo de resolución `error_interno` y conclusión ya guardados pasa a `resuelto` sin mandarlos: se acepta. Una `funcionalidad` sin resolución pasa a `resuelto`: se acepta. Una `incidencia` que en la misma edición cambia a `mejora` y pasa a `resuelto` sin resolución: se rechaza con REQ-E6, porque cuenta el tipo previo.
- REQ-13: un requisito `resuelto` con tipo `discutible`, conclusión y comentario pasa a `desarrollo`: los tres quedan vacíos. Si pasa a `desarrollo` mandando `resolutionComment: "seguimiento"`, queda ese comentario y los otros dos vacíos. Si pasa a `cancelado`, conserva los tres.
- REQ-14: una edición que cambia título y prioridad deja una sola entrada de actividad (`title`); una que solo cambia la prioridad no deja ninguna.
- REQ-24/REQ-28/REQ-31: el requisito 7 tiene 120 minutos cargados directo por Ana y su tarea 30 tiene 60 minutos de Ana y 90 de Luis: total 270; por persona Ana 180, Luis 90.
- REQ-30: `search=42` devuelve solo el requisito 42; `search=login` devuelve los que tienen «login» en el título; `createdFrom=2026-03-01&createdTo=2026-03-31` incluye los creados entre el 01/03 00:00 y el 31/03 23:59:59.999 UTC.
- REQ-15: una `incidencia` en `planificacion` ofrece «Pasar a Desarrollo»; una `mejora` en `planificacion` ofrece «Pasar a En cola».
