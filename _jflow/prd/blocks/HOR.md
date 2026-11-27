---
prefix: HOR
name: Horas trabajadas
surfaces: [Gestor interno]
covers: Carga y borrado de horas trabajadas por persona y día imputadas a proyecto, requisito o tarea, con ventana de carga y tope diario, y los reportes de horas por persona y por proyecto
entities: [Horas trabajadas, Ausencia, Persona, Proyecto, Requisito, Tarea, Configuración del sistema]
last_requirement: HOR-20
last_failure: HOR-E21
---

# HOR — Horas trabajadas

## Requirements
| ID | Requirement | Actor | Origin |
|---|---|---|---|
| HOR-01 | Una persona del equipo carga horas trabajadas para sí misma: fecha, minutos (entero, mínimo 1) y proyecto obligatorios, y opcionalmente un requisito o una tarea (nunca los dos). Si no indica la persona, se toma la Persona vinculada a su usuario. Responde 201 con el registro, su proyecto (id, nombre, código), tarea (id, título) y requisito (id, título) | U-02 | initial |
| HOR-02 | El administrador carga horas a nombre de cualquier persona: en la pantalla elige la «Persona» con un buscador entre las personas habilitadas | U-01 | initial |
| HOR-03 | Ventana de carga: solo se aceptan fechas entre el día actual y los 10 días previos, los dos bordes incluidos, calculados en UTC. Rige para todos los roles, administrador incluido; una fecha futura se rechaza | — | initial |
| HOR-04 | Tope diario: la suma de horas trabajadas ya cargadas por la persona ese día más la carga nueva no puede superar 1440 minutos. El tope cuenta solo horas trabajadas, no ausencias | — | initial |
| HOR-05 | Si la carga indica un requisito, el requisito tiene que pertenecer al proyecto indicado. Si indica una tarea, solo se verifica que la tarea exista: no se verifica que pertenezca al proyecto | — | initial |
| HOR-06 | Una persona borra un registro de horas propio cuya fecha esté dentro de la ventana de carga (HOR-03); el administrador borra el de cualquier persona, también dentro de la ventana. Responde 200 «Registro eliminado» | U-01, U-02 | initial |
| HOR-07 | El equipo consulta las horas cargadas por cualquier persona en un día, de la más reciente a la más antigua, con proyecto, tarea y requisito de cada registro | U-01, U-02 | initial |
| HOR-08 | La pantalla «Horas Trabajadas» muestra un selector con los últimos 8 días hábiles (lunes a viernes, según la fecha local del navegador), con el último día hábil elegido por defecto | U-01, U-02 | initial |
| HOR-09 | Cada día del selector se marca «carga completa» cuando las horas trabajadas más las ausencias del día alcanzan **horas por día** × 60 minutos, «carga parcial» cuando hay algo cargado por debajo de eso y «sin carga» cuando no hay nada | — | initial |
| HOR-10 | En modo «Presente» el destino se elige en un buscador «Proyecto / Requisito / Tarea» que ofrece los proyectos en estado `activo` o `analisis`, los requisitos de los que la persona es responsable (no cancelados; los resueltos solo si se finalizaron en los últimos 7 días) y las tareas de las que es responsable (en estado `activo`, o `finalizado` en los últimos 7 días), con el proyecto de cada una | U-01, U-02 | initial |
| HOR-11 | La carga se imputa al nivel más específico elegido: tarea, si no requisito, si no solo el proyecto | — | initial |
| HOR-12 | El tiempo se elige con botones de horas de 0 a **horas por día** (con opción de otro valor) y de minutos 0, 10, 20, 30, 40 y 50; se muestra «Total seleccionado: {h}h {m}min». «Cargar horas» se habilita con un total mayor que cero, un destino elegido y una persona resuelta. Al cargar se avisa «Horas cargadas exitosamente» | U-01, U-02 | initial |
| HOR-13 | La lista del día muestra cada registro como «Presente → {proyecto} → {requisito} → {tarea}» y cada ausencia como «Ausente → {motivo}», con un botón «Borrar» que pide confirmación («Eliminar registro»); sin registros muestra «No hay cargas para este día» | U-01, U-02 | initial |
| HOR-14 | Reporte por persona: para un rango de fechas, minutos de cada persona agrupados por proyecto y, dentro del proyecto, por tarea o requisito (con el requisito de la tarea, si tiene). Las ausencias del rango se suman a cada persona como un proyecto «Ausencia» de código `AUS` | U-01, U-02 | initial |
| HOR-15 | Reporte por proyecto: para un rango de fechas, minutos de cada proyecto agrupados por tarea o requisito y, dentro de cada uno, por persona; las horas cargadas al proyecto sin tarea ni requisito se listan como personas del proyecto. No incluye ausencias | U-01, U-02 | initial |
| HOR-16 | La pantalla «Visualización de Horas» elige el período entre «Esta semana» (lunes a domingo), «Semana pasada», «Este mes», «Mes pasado» y «Rango personalizado», y la vista «Por persona» o «Por proyecto». Muestra las tarjetas «Total horas», «Personas», «Proyectos» y «Promedio / persona», y en la vista por persona el detalle de ausencias por motivo | U-01, U-02 | initial |
| HOR-17 | El reporte se filtra por tipo de proyecto en la pantalla; con el filtro activo los totales se recalculan con los proyectos que quedan y el proyecto «Ausencia» queda afuera | U-01, U-02 | initial |
| HOR-18 | El equipo consulta el total de minutos cargados a un proyecto en un rango de fechas (0 si no hay cargas) | U-01, U-02 | initial |
| HOR-19 | El equipo consulta las **horas por día** configuradas | U-01, U-02 | initial |
| HOR-20 | Un usuario de cliente que entra a las pantallas de horas es redirigido a «Proyectos» | — | initial |

## Failure conditions
| ID | Condition | Result | Origin |
|---|---|---|---|
| HOR-E1 | La persona indicada no existe, o no se indicó y el usuario no tiene una Persona vinculada | 400 `person_not_found` «Person not found» | initial |
| HOR-E2 | Alguien sin rol `admin` carga horas a otra persona, o a una persona sin usuario vinculado | 403 `access_denied` «Solo podés cargar tus propias horas» | initial |
| HOR-E3 | El proyecto no existe | 400 `project_not_found` «Proyecto no encontrado» | initial |
| HOR-E4 | La tarea no existe | 400 `objective_not_found` «Objetivo no encontrado» | initial |
| HOR-E5 | El requisito no existe | 400 `requirement_not_found` «Requisito no encontrado» | initial |
| HOR-E6 | El requisito pertenece a otro proyecto | 400 `requirement_project_mismatch` «El requisito no pertenece al proyecto indicado» | initial |
| HOR-E7 | La fecha está fuera de la ventana de carga | 400 `invalid_date_range` «Solo se pueden cargar horas del día actual y los 10 días previos» | initial |
| HOR-E8 | La carga haría superar el tope diario | 400 `daily_limit_exceeded` «Se superaría el máximo de 24 horas (1440 minutos). Minutos disponibles: {N}», con `remainingMinutes` = N | initial |
| HOR-E9 | La carga indica tarea y requisito a la vez | 400 `invalid_fields` «"value" contains a conflict between optional exclusive peers [taskId, requirementId]» | initial |
| HOR-E10 | Falta la fecha, el proyecto o los minutos, la fecha no es ISO o los minutos son menores que 1 | 400 `invalid_fields` «Invalid field - {detalle}» | initial |
| HOR-E11 | Se borra un registro que no existe | 404 `worked_time_not_found` «Registro no encontrado» | initial |
| HOR-E12 | Alguien sin rol `admin` borra un registro de otra persona | 403 `access_denied` «Solo podés eliminar tus propios registros» | initial |
| HOR-E13 | Se borra un registro cuya fecha está fuera de la ventana de carga | 400 `invalid_date_range` «Solo se pueden eliminar registros del día actual y los 10 días previos» | initial |
| HOR-E14 | Las consultas de horas, los reportes o la configuración se piden sin rol `user` ni `admin` | 403 `access_denied` «Access denied» | initial |
| HOR-E15 | Un reporte pide `dateTo` anterior a `dateFrom`, o falta alguna de las dos | 400 `invalid_fields` «Invalid field - {detalle}» | initial |
| HOR-E16 | El total por proyecto se pide para un proyecto que no existe | 404 `project_not_found` «Project not found» | initial |
| HOR-E17 | Un usuario sin rol `admin` cuya Persona no se encuentra por su usuario abre la pantalla de carga | La pantalla consulta con persona 0, no muestra cargas y «Cargar horas» queda deshabilitado, sin aviso | initial |
| HOR-E18 | Dos cargas simultáneas de la misma persona y día superan juntas el tope diario | Las dos se guardan: el tope se verifica antes de insertar y sin bloqueo | initial |
| HOR-E19 | Falla inesperada al leer horas, reportes o las **horas por día**, o al ejecutar la carga o el borrado en core (por ejemplo, la base no responde, o el total por proyecto se pide con un id de proyecto no numérico) | 500 `internal_error` «Internal error» («Internal server error» si falla la lectura del proyecto) | initial |
| HOR-E20 | Carga o borrado de horas sin respuesta de core: nadie atiende el comando, o la respuesta no llega a tiempo | 503 `service_unavailable` «El servicio no está disponible en este momento» (no se hizo); 504 `gateway_timeout` «La operación tardó demasiado» (pudo haberse hecho) | initial |
| HOR-E21 | Las horas de una persona en un día, o sus tareas o requisitos para cargar horas, se piden sin `personId` entero, o las horas del día sin `date` en formato ISO | 400 `invalid_fields` «Invalid field - {detalle}» | initial |

## Examples
- HOR-03: hoy es 2026-11-27 (UTC). Se aceptan fechas del 2026-11-17 al 2026-11-27; el 2026-11-16 y el 2026-11-28 se rechazan (HOR-E7).
- HOR-03 / HOR-08: un lunes 2026-11-23 el selector muestra 23, 20, 19, 18, 17, 16, 13 y 12 de noviembre; la ventana va del 13 al 23, así que cargar en el 12 responde HOR-E7. Un martes pasa lo mismo con el día más antiguo del selector; de miércoles a viernes los 8 días caen dentro de la ventana.
- HOR-04: la persona ya tiene 1200 minutos trabajados el día; cargar 300 responde HOR-E8 con «Minutos disponibles: 240». Una ausencia de 480 minutos ese mismo día no cuenta para este tope.
- HOR-09: con **horas por día** = 6, un día con 240 minutos trabajados y 120 de ausencia (360) queda «carga completa»; uno con 300 queda «carga parcial».
- HOR-14: Ana tiene 600 minutos en el proyecto X y 480 de ausencia en el período; el reporte por persona muestra para Ana el proyecto X (600) y «Ausencia» `AUS` (480), total 1080.
