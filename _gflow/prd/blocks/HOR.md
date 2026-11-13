---
prefix: HOR
name: Horas y ausencias
surfaces: [Gestión interna]
covers: Carga y borrado de horas trabajadas (ventana, tope diario, titularidad), ausencias con motivo y su borrado, y las consultas de horas y ausencias de una persona
entities: [Hora trabajada, Ausencia, Persona, Proyecto, Tarea, Requisito]
last_requirement: HOR-15
last_failure: HOR-E14
---

# HOR — Horas y ausencias

## Requisitos
| ID | Requisito | Actor | Origen |
|---|---|---|---|
| HOR-01 | Cargar horas trabajadas de un día: minutos (al menos 1) y proyecto obligatorios, y opcionalmente una tarea o un requisito, nunca los dos | U-01, U-02 | inicial |
| HOR-02 | Si la carga de horas o de una ausencia no indica la persona, se imputa a la persona vinculada al usuario que carga | U-01, U-02 | inicial |
| HOR-03 | Solo un `admin` carga o borra horas y ausencias de otra persona; una persona sin usuario vinculado no es de nadie, así que solo un `admin` la opera | U-01 | inicial |
| HOR-04 | Las horas solo se cargan y se borran para días entre hoy menos la **ventana de carga de horas** y hoy, ambos incluidos, contados en UTC | — | inicial |
| HOR-05 | Las horas trabajadas de una persona en un día no pueden superar el **tope diario de minutos**; la suma cuenta solo horas trabajadas, no ausencias | — | inicial |
| HOR-06 | El requisito al que se imputan horas tiene que ser del proyecto indicado; de la tarea solo se verifica que exista | — | inicial |
| HOR-07 | Registrar una ausencia: día, minutos (al menos 1) y motivo (`tramite`, `corte_servicios`, `vacaciones`, `dia_no_laborable`, `personal`, `medico`, `estudio`, `enfermedad`, `otro`), sin límite de días hacia atrás ni hacia adelante | U-01, U-02 | inicial |
| HOR-08 | Las ausencias de una persona en un día, sumadas a sus horas trabajadas de ese día, no pueden superar el **tope diario de minutos** | — | inicial |
| HOR-09 | Una ausencia solo se borra dentro del **plazo de borrado de ausencias**, contado desde que se registró (no desde el día de la ausencia) | U-01, U-02 | inicial |
| HOR-10 | La pantalla de carga ofrece los últimos **días hábiles de carga** (lunes a viernes; arranca en hoy, o en el viernes anterior si es fin de semana), cada uno con un semáforo «sin carga», «carga parcial» o «carga completa» según la suma de horas y ausencias del día contra las **horas por día** | U-01, U-02 | inicial |
| HOR-11 | En modo «Presente» se elige el destino entre los proyectos activos o en análisis, los requisitos de los que la persona es responsable (no cancelados, y los resueltos solo dentro de la **vigencia de destinos cerrados**) y sus tareas activas o finalizadas dentro de la misma vigencia; el tiempo se elige en horas de 0 a las **horas por día** o un valor libre, más minutos de a 10 | U-01, U-02 | inicial |
| HOR-12 | En modo «Ausente» se elige el motivo y el tiempo; al registrarla la pantalla vuelve a «Presente» | U-01, U-02 | inicial |
| HOR-13 | Un `admin` elige en la pantalla de carga a cualquier persona habilitada; los demás ven y cargan solo lo propio | U-01 | inicial |
| HOR-14 | La lista del día muestra cada carga («Presente → proyecto → requisito → tarea» o «Ausente → motivo») con sus minutos y el total del día, y permite borrar cada una previa confirmación; las cargas no se editan | U-01, U-02 | inicial |
| HOR-15 | Consultar las horas de una persona en un día, sus ausencias en un día o agrupadas por día en un rango, y la lista fija de motivos de ausencia | U-01, U-02 | inicial |

## Condiciones de falla
| ID | Condición | Resultado | Origen |
|---|---|---|---|
| HOR-E1 | La persona indicada no existe, o el usuario que carga no tiene persona vinculada | 400 `person_not_found` | inicial |
| HOR-E2 | Un usuario que no es `admin` carga horas de otra persona | 403 `access_denied` («Solo podés cargar tus propias horas») | inicial |
| HOR-E3 | Un usuario que no es `admin` registra una ausencia de otra persona | 403 `access_denied` («Solo podés cargar tus propias ausencias») | inicial |
| HOR-E4 | Un usuario que no es `admin` borra horas o una ausencia de otra persona | 403 `access_denied` («Solo podés eliminar tus propios registros») | inicial |
| HOR-E5 | El proyecto indicado no existe | 400 `project_not_found` («Proyecto no encontrado») | inicial |
| HOR-E6 | La tarea indicada no existe | 400 `objective_not_found` («Objetivo no encontrado») | inicial |
| HOR-E7 | El requisito indicado no existe | 400 `requirement_not_found` («Requisito no encontrado») | inicial |
| HOR-E8 | El requisito es de otro proyecto | 400 `requirement_project_mismatch` («El requisito no pertenece al proyecto indicado») | inicial |
| HOR-E9 | Se cargan horas fuera de la ventana | 400 `invalid_date_range` («Solo se pueden cargar horas del día actual y los 10 días previos») | inicial |
| HOR-E10 | Se borran horas de un día fuera de la ventana | 400 `invalid_date_range` («Solo se pueden eliminar registros del día actual y los 10 días previos») | inicial |
| HOR-E11 | La carga supera el tope diario | 400 `daily_limit_exceeded` («Se superaría el máximo de 24 horas (1440 minutos). Minutos disponibles: N»), con `remainingMinutes` | inicial |
| HOR-E12 | Horas con tarea y requisito a la vez, minutos menores que 1, fecha con otro formato o motivo fuera de la lista | 400 `invalid_fields` | inicial |
| HOR-E13 | Se borra un registro de horas o una ausencia que no existe | 404 `worked_time_not_found` / 404 `unworked_time_not_found` | inicial |
| HOR-E14 | Se borra una ausencia registrada antes del plazo | 400 `deadline_exceeded` («Solo se pueden eliminar registros creados en los últimos 10 días») | inicial |

## Ejemplos
- HOR-04: hoy es 2026-11-12 (UTC). Se cargan y borran horas del 2026-11-02 al 2026-11-12; el 2026-11-01 y el 2026-11-13 dan `invalid_date_range`. A las 22:00 del 12 en Argentina ya es 13 en UTC: la ventana va del 2026-11-03 al 2026-11-13.
- HOR-05: la persona tiene 1200 min trabajados el día y 600 min de ausencia. Cargar 240 min más de horas se acepta (1200 + 240 = 1440); cargar 241 da `daily_limit_exceeded` con 240 minutos disponibles. La ausencia no cuenta.
- HOR-08: la misma persona con 1200 min trabajados y 200 de ausencia no puede registrar otra ausencia de 60 min (1200 + 200 + 60 = 1460 > 1440): disponibles 40.
- HOR-09: una ausencia del día 2026-10-01 registrada el 2026-11-05 se puede borrar hasta el 2026-11-15; una del 2026-11-10 registrada el 2026-10-20 ya no.
