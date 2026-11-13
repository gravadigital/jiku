---
prefix: REP
name: Reportes
surfaces: [Gestión interna]
covers: Reporte de requisitos con exportación CSV, horas por requisito, resumen de tareas por proyecto con minutos y la visualización de horas por persona y por proyecto
entities: [Requisito, Tarea, Hora trabajada, Proyecto]
last_requirement: REP-08
last_failure: REP-E4
---

# REP — Reportes

## Requisitos
| ID | Requisito | Actor | Origen |
|---|---|---|---|
| REP-01 | Ver el reporte de requisitos: todos los que cumplen los filtros, sin paginar, con id, tipo, título, proyecto, creador, fecha de creación, de inicio (entrada a `desarrollo`) y de resolución, horas trabajadas, tipo de resolución, conclusión y comentario de resolución; filtros por texto (el id exacto si es un número, o el título), rango de fechas de creación y proyecto, que no quedan en la URL | U-01, U-02 | inicial |
| REP-02 | Exportar a CSV (`reporte-requisitos.csv`) lo que muestra el reporte: UTF-8 con BOM, separador coma, fechas `DD/MM/AAAA`, horas «Xh Ym» y etiquetas en español | U-01, U-02 | inicial |
| REP-03 | Ver las horas trabajadas en un requisito: el total y el desglose por persona, sumando las horas cargadas al requisito y a sus tareas | U-01, U-02 | inicial |
| REP-04 | Resumen de tareas por proyecto: los proyectos activos o en análisis con sus tareas activas o en revisión, los minutos trabajados en total, en el mes en curso y por tarea | U-01, U-02 | inicial |
| REP-05 | Reporte de horas por persona en un rango: persona → proyecto → requisito y tarea, con las ausencias de la persona como un proyecto más, «Ausencia» (código `AUS`) | U-01, U-02 | inicial |
| REP-06 | Reporte de horas por proyecto en un rango: proyecto → requisito → tarea → persona, y aparte las horas cargadas solo al proyecto, por persona; y el total de minutos de un proyecto en un rango | U-01, U-02 | inicial |
| REP-07 | La visualización de horas elige el período (esta semana, por defecto; semana pasada; este mes; mes pasado; rango personalizado), la vista por persona o por proyecto y los tipos de proyecto (filtro local que, con algún tipo elegido, deja afuera las ausencias); muestra total de horas, personas, proyectos y promedio por persona, y una tabla desplegable ordenada por minutos | U-01, U-02 | inicial |
| REP-08 | Todo Miembro del equipo ve los reportes de horas de todas las personas | U-02 | inicial |

## Condiciones de falla
| ID | Condición | Resultado | Origen |
|---|---|---|---|
| REP-E1 | Rango de fechas o parámetros inválidos | 400 `invalid_fields` | inicial |
| REP-E2 | El proyecto del total no existe | 404 `project_not_found` | inicial |
| REP-E3 | El requisito de las horas no existe | 404 `requirement_not_found` | inicial |
| REP-E4 | Falla la carga de un reporte | La pantalla muestra «Ocurrió un error al cargar el reporte» (requisitos), el toast «Error al cargar los datos del reporte» (horas) o «No se pudieron cargar las horas» (horas de un requisito) | inicial |
