---
prefix: TAR
name: Tareas
surfaces: [Gestor interno]
covers: Alta, edición, estados, comentarios y actividad de las tareas de un proyecto, y sus vistas en tabla, por proyecto y por responsable
entities: [Tarea, Actividad de tarea, Proyecto, Persona, Requisito, Horas trabajadas, Archivo, Adjunto]
last_requirement: TAR-30
last_failure: TAR-E12
---

# TAR — Tareas

## Requirements
| ID | Requirement | Actor | Origin |
|---|---|---|---|
| TAR-01 | El equipo crea una tarea con título, estado, área, prioridad (número de 0 a 5), proyecto y lista de responsables obligatorios y, opcionales, descripción, fecha estimada de finalización, visibilidad y requisito vinculado. El creador queda registrado como el usuario que hizo la llamada. Responde 201 con la tarea y los `personIds` enviados | U-01, U-02 | initial |
| TAR-02 | Los estados de una tarea son `backlog`, `activo`, `finalizado`, `cancelado` y `en_revision`; las áreas, `diseño`, `desarrollo`, `gestion` e `investigacion`; la visibilidad, `public` (por defecto) o `internal` | — | initial |
| TAR-03 | Los responsables se guardan en el orden recibido; el primero queda como líder. La api acepta una lista vacía; el formulario del gestor exige al menos uno | — | initial |
| TAR-04 | Una tarea se vincula a un requisito solo si el requisito es del mismo proyecto que la tarea; en la edición, `requirementId: null` la desvincula | — | initial |
| TAR-05 | La prioridad se guarda como el número recibido (0 a 5); 0 = sin prioridad, 1 = baja, 2 = media, 3 = alta, 4 y 5 = urgente | — | initial |
| TAR-06 | La pantalla «Nueva tarea» crea varias tareas a la vez (una llamada por tarea) y llega con proyecto y requisito ya elegidos cuando se abre desde un requisito; ofrece proyectos en estado `activo` o `analisis` y los requisitos del proyecto elegido (hasta 100). Avisa «Tareas creadas con éxito» o «Error al crear algunas tareas» | U-01, U-02 | initial |
| TAR-07 | El equipo edita una tarea mandando título, estado, área, prioridad y responsables (obligatorios) y, opcionales, descripción, fecha estimada, visibilidad y requisito vinculado. Responde 200 `objective_updated` "Objective Updated" | U-01, U-02 | initial |
| TAR-08 | En la edición, una descripción o una fecha estimada que no vienen se guardan vacías | — | initial |
| TAR-09 | Si la edición trae responsables, los que no están en la lista se quitan y los de la lista quedan con el primero como líder | — | initial |
| TAR-10 | Las transiciones de estado son libres: cualquier estado es alcanzable desde cualquier otro | — | initial |
| TAR-11 | Al pasar una tarea a `finalizado` desde otro estado se registra la fecha de finalización (`finishedAt`); al salir de `finalizado` se borra. Una tarea creada directamente en `finalizado` queda sin fecha de finalización | — | initial |
| TAR-12 | Cada cambio real de título, descripción, estado, área, prioridad o fecha estimada deja una entrada en la actividad con valor anterior, nuevo y autor. Las de estado, título y descripción son públicas; las de área, prioridad y fecha estimada, internas. Un valor que queda vacío no deja entrada, salvo la fecha estimada. Los cambios de responsables, visibilidad y requisito vinculado no dejan entrada | — | initial |
| TAR-13 | La edición y el alta son atómicas: si falla la vinculación de archivos o un responsable, no queda ningún cambio | — | initial |
| TAR-14 | El equipo comenta una tarea con visibilidad `public` o `internal` (por defecto `internal`) y hasta **máximo de archivos por operación** archivos. Responde 201 con la entrada de actividad. El gestor avisa «Comentario agregado exitosamente» y rechaza un comentario vacío con «El comentario no puede estar vacío» | U-01, U-02 | initial |
| TAR-15 | El autor de un comentario lo edita (texto y conjunto completo de archivos); un `admin` edita el de cualquiera. Se registran fecha y autor de la edición; la visibilidad no cambia. Responde 200 `comment_updated` "Comment Updated". El gestor ofrece editar comentarios ajenos solo a `admin` | U-01, U-02 | initial |
| TAR-16 | El listado de tareas filtra por texto en el título (sin distinguir mayúsculas), uno o varios estados (separados por coma), área, responsable, proyecto y nombre de proyecto (contiene, sin distinguir mayúsculas); ordena por cualquier campo (`campo` ascendente, `-campo` descendente; por defecto `-createdAt`) | U-01, U-02 | initial |
| TAR-17 | El listado pagina con `page` y `limit`: un `limit` de 1 a 30 se respeta; uno mayor que 30, o ausente, devuelve hasta 200 tareas | — | initial |
| TAR-18 | Cada tarea del listado trae su proyecto, sus responsables con marca de líder, los minutos trabajados totales, los minutos agrupados por persona y el detalle de cada carga de horas | U-01, U-02 | initial |
| TAR-19 | Con `count` presente (cualquier valor, incluido `false`) el listado devuelve solo la cantidad de tareas que cumplen los filtros | U-01, U-02 | initial |
| TAR-20 | El filtro por responsable trae solo las tareas de esa persona y, en cada una, solo a esa persona entre los responsables; el parámetro `visibilityLevel` se acepta y se ignora | — | initial |
| TAR-21 | La pantalla «Tareas» muestra la tabla con filtros (área, responsable, proyecto, texto, estado; por defecto `activo`), orden `-createdAt` y 20 por página, y el botón «Nueva tarea» | U-01, U-02 | initial |
| TAR-22 | El detalle de una tarea trae proyecto, creador, toda la actividad (pública e interna) con su autor, responsables con marca de líder, las cargas de horas y los minutos trabajados totales | U-01, U-02 | initial |
| TAR-23 | «Tareas por proyecto» lista los proyectos en estado `activo` o `analisis` que tienen tareas en `activo` o `en_revision`, por nombre de proyecto y, dentro de cada uno, por fecha estimada; con los minutos trabajados de cada tarea y los minutos totales y del mes calendario en curso de cada proyecto | U-01, U-02 | initial |
| TAR-24 | En «Tareas por proyecto» se cambian en línea el estado y la fecha de finalización estimada de una tarea, con los avisos «Se cambió el estado de la tarea a {estado}» y «Se cambió la fecha de finalización de la tarea» | U-01, U-02 | initial |
| TAR-25 | «Tareas por responsable» agrupa las tareas en estado `activo` por cada persona responsable, ordenadas por nombre y apellido; una tarea sin responsables no aparece | U-01, U-02 | initial |
| TAR-26 | Si falla la consulta, «Tareas por proyecto» y «Tareas por responsable» muestran la página vacía en vez de un error | — | initial |
| TAR-27 | Los archivos de una tarea y de sus comentarios se vinculan con `fileIds`: en el alta y al comentar se agregan; en la edición `fileIds` es el conjunto completo que debe quedar vinculado | U-01, U-02 | initial |
| TAR-28 | Listar, ver el detalle, crear, editar y comentar tareas, y ver «Tareas por proyecto», no chequean rol en la api: cualquier usuario autenticado, incluido `external-user`, lee las tareas con su actividad interna. Las escrituras las autoriza core solo para `user` y `admin`. Editar un comentario exige rol `user` o `admin` | — | initial |
| TAR-29 | El formulario de edición valida título, área, prioridad (0 a 5), responsables, proyecto, visibilidad y estado con «Este campo es requerido», «Elegí un proyecto», «Elegí un área», «Elegí un estado» y «* Campos incompletos»; avisa «Tarea editada con éxito» | U-01, U-02 | initial |
| TAR-30 | Cambiar estado, título, descripción o responsables de una tarea, y comentarla, publica el evento de dominio correspondiente (detalle en CON) | — | initial |

## Failure conditions
| ID | Condition | Result | Origin |
|---|---|---|---|
| TAR-E1 | Falta un campo obligatorio, o un campo no cumple su formato o valor permitido | 400 `invalid_fields` "Invalid field - {detalle}" | initial |
| TAR-E2 | Se manda `stageId` al crear o editar (la api lo acepta y core no) | 400 `invalid_fields` "\"stageId\" is not allowed" | initial |
| TAR-E3 | Prioridad mayor que 5 o negativa al crear | 400 `invalid_fields` "\"priorityValue\" must be less than or equal to 5" (o el mínimo) | initial |
| TAR-E4 | El proyecto del alta no existe | 400 `project_not_found` "Project not found" | initial |
| TAR-E5 | Algún responsable no existe, o la lista trae un id repetido | 400 `person_not_found` "Person not found" | initial |
| TAR-E6 | El requisito vinculado no existe o es de otro proyecto | 400 `requirement_project_mismatch` "Requirement does not belong to the specified project" | initial |
| TAR-E7 | La tarea no existe (detalle, editar, comentar, editar comentario) | 400 `objective_not_found` "Objective not found" | initial |
| TAR-E8 | El comentario a editar no existe en esa tarea | 400 `comment_not_found` "Comentario no encontrado" | initial |
| TAR-E9 | La entrada de actividad a editar no es un comentario | 400 `activity_not_editable` "La actividad no es un comentario editable" | initial |
| TAR-E10 | Editar un comentario ajeno sin ser `admin` | 403 `comment_not_owned` "Solo el autor del comentario puede editarlo" | initial |
| TAR-E11 | Crear, editar o comentar con un rol que core no autoriza (p. ej. `external-user`); editar un comentario sin rol `user` ni `admin` | 403 `caller_not_authorized` "El caller no está autorizado a ejecutar este método" / 403 `access_denied` "Access denied" | initial |
| TAR-E12 | Orden por un campo inexistente o id de tarea no numérico | 500 `internal_error` "Internal error" | initial |

## Examples
- TAR-05: el gestor manda prioridad 5: se guarda 5 y se lee como 5; en el bus viaja como `urgente`, igual que el 4.
- TAR-08/TAR-12: una tarea con descripción «Ajustar login» y fecha estimada 2026-05-10 se edita mandando solo título, estado, área, prioridad y responsables: queda sin descripción y sin fecha; la actividad registra el cambio de fecha (de 2026-05-10 a vacío) y no registra el de descripción.
- TAR-11: una tarea `activo` pasa a `finalizado` el 12/05 (`finishedAt` = 12/05), vuelve a `en_revision` el 13/05 (`finishedAt` vacío) y a `finalizado` el 15/05 (`finishedAt` = 15/05).
- TAR-12: una edición que cambia el estado de `activo` a `en_revision` y el área de `desarrollo` a `diseño` deja dos entradas: `state` pública y `area` interna.
- TAR-17: `limit=20` devuelve hasta 20 tareas; `limit=50` devuelve hasta 200.
- TAR-18: la tarea 30 tiene cargas de Ana (60 y 30 minutos) y de Luis (90): minutos totales 180; por persona Ana 90, Luis 90; detalle con las tres cargas.
- TAR-23: con el mes en curso marzo, un proyecto con 600 minutos cargados en total y 120 en marzo muestra 600 totales y 120 del mes.
