---
prefix: ASG
name: Asignación semanal
surfaces: [Gestor interno]
covers: Grilla semanal persona × proyecto con el porcentaje de capacidad asignado, su conversión a minutos y el reemplazo de la semana completa por el administrador
entities: [Asignación semanal, Persona, Proyecto, Configuración del sistema]
last_requirement: ASG-11
last_failure: ASG-E8
---

# ASG — Asignación semanal

## Requirements
| ID | Requirement | Actor | Origin |
|---|---|---|---|
| ASG-01 | El equipo consulta una semana por su lunes: recibe las asignaciones de esa semana, las personas habilitadas que deben cargar horas y los proyectos en estado `activo` o `analisis` | U-01, U-02 | initial |
| ASG-02 | La pantalla «Asignación de Tiempo» muestra una grilla con un proyecto por fila y una persona por columna («{nombre} {inicial del apellido}.»), con totales por proyecto y por persona, y navega entre semanas | U-01, U-02 | initial |
| ASG-03 | Cada celda muestra el porcentaje de la capacidad semanal de la persona y su equivalente en horas: la capacidad semanal es **horas por día** × 5 días; las horas = porcentaje / 100 × **horas por día** × 5 | — | initial |
| ASG-04 | Los proyectos se agrupan en «Comerciales activos» (estado `activo` y tipo `comercial`), «Internos activos» (los demás activos) y «En análisis», y dentro de cada grupo se ordenan por nombre | — | initial |
| ASG-05 | El administrador edita los porcentajes de la semana en curso o de semanas futuras y los guarda con «Guardar», habilitado solo cuando hay cambios. Cada porcentaje se convierte a minutos redondeando porcentaje / 100 × capacidad semanal en minutos. Al guardar se avisa «Cambios guardados correctamente» | U-01 | initial |
| ASG-06 | Guardar reemplaza todas las asignaciones de esa semana, de todas las personas, por las enviadas: las asignaciones en 0 minutos no se guardan. Cada asignación guarda la semana desde el lunes hasta el viernes y si el proyecto es interno (tipo `interno`) | — | initial |
| ASG-07 | Solo se aceptan semanas que empiezan un lunes y que no sean anteriores a la semana en curso (calculada en UTC) | — | initial |
| ASG-08 | La pantalla toma como editable la semana en curso de lunes a sábado y las futuras; un domingo la semana que termina ya no es editable en la pantalla | — | initial |
| ASG-09 | Una persona cuyo total supera el 100 % se marca como sobreasignada; no impide guardar | — | initial |
| ASG-10 | Si el administrador abre una semana editable sin asignaciones, la grilla se precarga con las de la semana anterior y avisa «Valores precargados de la semana anterior»; no se guardan hasta que pulsa «Guardar» | U-01 | initial |
| ASG-11 | Quien no es administrador ve la grilla en solo lectura. Un usuario de cliente que entra a la pantalla es redirigido a «Proyectos» | U-02 | initial |

## Failure conditions
| ID | Condition | Result | Origin |
|---|---|---|---|
| ASG-E1 | Alguien sin rol `admin` guarda una semana | 403 `caller_not_authorized` «El caller no está autorizado a ejecutar este método» | initial |
| ASG-E2 | La semana es anterior a la semana en curso | 400 `invalid_date_range` «No se pueden modificar semanas pasadas» | initial |
| ASG-E3 | La fecha de inicio no es un lunes o no tiene la forma `YYYY-MM-DD` | 400 `invalid_fields` «"dateFrom" contains an invalid value» (o el mensaje de forma de la validación) | initial |
| ASG-E4 | Alguna asignación con minutos mayores que 0 nombra un proyecto que no existe | 400 `project_not_found` «Proyecto no encontrado» | initial |
| ASG-E5 | Alguna asignación con minutos mayores que 0 nombra una persona que no existe | 400 `person_not_found` «Persona no encontrada» | initial |
| ASG-E6 | Falta la semana o la lista de asignaciones, o alguna asignación tiene minutos negativos o le falta persona o proyecto | 400 `invalid_fields` «Invalid field - {detalle}» | initial |
| ASG-E7 | La semana se consulta sin rol `user` ni `admin`, o sin la fecha de inicio | 403 `access_denied` «Access denied» / 400 `invalid_fields` «Invalid field - {detalle}» | initial |
| ASG-E8 | No se pueden cargar las asignaciones o las **horas por día** | La pantalla avisa «Error al cargar las asignaciones de tiempo» y muestra «No se pudieron cargar las asignaciones. Intentá de nuevo más tarde.»; si falla el guardado avisa el mensaje recibido o «Error al guardar los cambios» | initial |

## Examples
- ASG-03 / ASG-05: con **horas por día** = 6 la capacidad semanal es 30 h (1800 minutos). Asignar 50 % guarda 900 minutos (15 h); 33,3 % guarda 599 minutos y la celda muestra 10,0 h.
- ASG-06: la semana del lunes 2026-11-30 tiene 12 asignaciones; el administrador guarda la grilla con 3 celdas en 0 % y el resto igual: quedan 9 filas, todas con desde 2026-11-30 y hasta 2026-12-04.
- ASG-08: el domingo 2026-11-29 la pantalla no deja editar la semana del 2026-11-23, pero la api la acepta, porque en UTC esa sigue siendo la semana en curso.
