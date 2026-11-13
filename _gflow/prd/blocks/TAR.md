---
prefix: TAR
name: Tareas
surfaces: [Gestión interna]
covers: Alta (simple y múltiple), edición, responsables con líder, estados, prioridad 0 a 5, área, búsqueda, vínculo con un requisito, detalle y las vistas por proyecto y por responsable
entities: [Tarea, Proyecto, Persona, Requisito, Actividad de tarea]
last_requirement: TAR-13
last_failure: TAR-E7
---

# TAR — Tareas

## Requisitos
| ID | Requisito | Actor | Origen |
|---|---|---|---|
| TAR-01 | Dar de alta una tarea con título, proyecto (en análisis o activo) y al menos un responsable obligatorios, y opcionalmente descripción, fecha de finalización estimada, área (`diseño`, `desarrollo` por defecto, `gestion`, `investigacion`), visibilidad, requisito vinculado y archivos; la pantalla la crea en estado `activo`, prioridad 0 y visibilidad interna por defecto | U-01, U-02 | inicial |
| TAR-02 | Dar de alta varias tareas a la vez: cada formulario se clona o se borra, y al guardar se crea una tarea por formulario; si una falla, las demás quedan creadas. Si el alta vino desde un requisito, al terminar vuelve a ese requisito | U-01, U-02 | inicial |
| TAR-03 | El requisito vinculado a una tarea tiene que ser del mismo proyecto; cambiar el proyecto en el alta limpia el requisito elegido | — | inicial |
| TAR-04 | Responsables de una tarea: una lista de personas cuya primera es el líder; editarla reemplaza la lista y conserva las asignaciones que siguen | U-01, U-02 | inicial |
| TAR-05 | Editar una tarea: título, requisito (o ninguno), responsables, área, estado, prioridad, visibilidad, fecha estimada y descripción; el proyecto no se cambia; si la edición no envía la descripción o la fecha estimada, quedan vacías | U-01, U-02 | inicial |
| TAR-06 | Estados de una tarea: `backlog`, `activo`, `en_revision`, `finalizado`, `cancelado`; cualquier estado se alcanza desde cualquier otro; al entrar a `finalizado` se registra la fecha de cierre y al salir se borra | — | inicial |
| TAR-07 | La prioridad de una tarea es un número de 0 a 5 (0 sin prioridad … 4 urgente; 5 se trata como urgente) | — | inicial |
| TAR-08 | Cambiar el estado de una tarea en el lugar desde la tabla y las tarjetas, y su fecha estimada desde la tarjeta, sin confirmación | U-01, U-02 | inicial |
| TAR-09 | Listar tareas con filtros por texto, estados (por defecto `activo`), proyecto, responsable y área, ordenadas por creación, paginadas, con responsables (líder primero) y minutos trabajados en total, por persona y por registro | U-01, U-02 | inicial |
| TAR-10 | La fecha de cierre de una tarea se muestra como días hábiles que faltan o desde que venció («Vence hoy», «Vencido hace …», «Falta …»), o «Cerrado hace …» si está finalizada; las finalizadas y canceladas no se marcan vencidas, y se resaltan las que tienen **días de aviso de vencimiento** o menos | U-01, U-02 | inicial |
| TAR-11 | Ver el detalle de una tarea: prioridad, estado, proyecto, área, visibilidad, creador, requisito vinculado, fechas de inicio, estimada, de cierre y de última actualización, horas trabajadas, equipo (líder primero), descripción, historial, comentarios y documentación | U-01, U-02 | inicial |
| TAR-12 | Ver las tareas por proyecto: el resumen de REP-04 agrupado por proyecto, con las horas del mes de cada uno y acceso a crear una tarea en ese proyecto | U-01, U-02 | inicial |
| TAR-13 | Ver las tareas por responsable: las tareas activas agrupadas por persona (una tarea aparece en cada responsable), ordenadas por fecha estimada ascendente con las que no tienen fecha al final | U-01, U-02 | inicial |

## Condiciones de falla
| ID | Condición | Resultado | Origen |
|---|---|---|---|
| TAR-E1 | Alta o edición sin título, proyecto, área, estado o responsables, o con prioridad fuera de 0 a 5 | 400 `invalid_fields`; la pantalla muestra «Este campo es requerido», «Elegí un proyecto», «Elegí al menos un responsable» y «Revisá que no haya campos incompletos» | inicial |
| TAR-E2 | El proyecto indicado no existe | 400 `project_not_found` | inicial |
| TAR-E3 | Un responsable no existe, o la lista repite una persona | 400 `person_not_found` | inicial |
| TAR-E4 | El requisito vinculado es de otro proyecto | 400 `requirement_project_mismatch` («Requirement does not belong to the specified project») | inicial |
| TAR-E5 | Ver o editar una tarea que no existe | 400 `objective_not_found` | inicial |
| TAR-E6 | Falla el cambio de estado o de fecha en el lugar | Se revierte y aparece el toast «Hubo un error al cambiar el estado» / «Hubo un error al cambiar la fecha de finalización» | inicial |
| TAR-E7 | Falla el alta o la edición | Toast con el mensaje del error, o «Error al crear algunas tareas» / «Hubo un error al editar la tarea» | inicial |
