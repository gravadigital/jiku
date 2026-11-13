---
prefix: ASI
name: Asignación semanal
surfaces: [Gestión interna]
covers: Ver la matriz de asignación de capacidad por persona y proyecto de una semana y reemplazarla (solo admin, nunca semanas pasadas)
entities: [Asignación semanal, Persona, Proyecto]
last_requirement: ASI-08
last_failure: ASI-E6
---

# ASI — Asignación semanal

## Requisitos
| ID | Requisito | Actor | Origen |
|---|---|---|---|
| ASI-01 | Ver la asignación de una semana (lunes a viernes, identificada por su lunes): una matriz de proyectos activos o en análisis por personas habilitadas que cargan horas, con el porcentaje de capacidad y las horas de cada celda y los totales por proyecto y por persona | U-01, U-02 | inicial |
| ASI-02 | La capacidad semanal de una persona es las **horas por día** por 5 días; las horas de una celda son su porcentaje de esa capacidad, y lo que se guarda son los minutos redondeados | — | inicial |
| ASI-03 | Los proyectos de la matriz se agrupan en «Comerciales activos», «Internos activos» (activos de otro tipo) y «En análisis», en orden alfabético dentro de cada grupo | U-01, U-02 | inicial |
| ASI-04 | Una persona con más del 100 % asignado en la semana se resalta, sin mensaje ni bloqueo al guardar | U-01 | inicial |
| ASI-05 | Reemplazar la asignación de una semana: solo un `admin`; reemplaza todas las filas de esa semana, de todas las personas, por las enviadas; las celdas con 0 minutos se descartan y cada fila queda marcada como interna si su proyecto es de tipo `interno` | U-01 | inicial |
| ASI-06 | Una semana es editable si su lunes no es anterior al lunes de la semana actual (en UTC); en la pantalla, un `admin` edita la semana actual y las siguientes, y un domingo solo las siguientes | U-01 | inicial |
| ASI-07 | Si un `admin` abre una semana editable sin asignaciones y la anterior tiene, la pantalla precarga la anterior con el aviso «Valores precargados de la semana anterior», sin guardar hasta «Guardar» | U-01 | inicial |
| ASI-08 | Navegar a la semana anterior, la siguiente o volver a «Esta semana»; un Miembro del equipo ve la matriz completa de todas las personas, en solo lectura | U-01, U-02 | inicial |

## Condiciones de falla
| ID | Condición | Resultado | Origen |
|---|---|---|---|
| ASI-E1 | Quien reemplaza la asignación no es `admin` | 403 `caller_not_authorized` | inicial |
| ASI-E2 | La semana es anterior a la actual | 400 `invalid_date_range` («No se pueden modificar semanas pasadas») | inicial |
| ASI-E3 | La fecha de la semana no es un lunes `YYYY-MM-DD`, o una celda tiene minutos negativos | 400 `invalid_fields` | inicial |
| ASI-E4 | Un proyecto de la asignación no existe | 400 `project_not_found` («Proyecto no encontrado») | inicial |
| ASI-E5 | Una persona de la asignación no existe | 400 `person_not_found` («Persona no encontrada») | inicial |
| ASI-E6 | Falla la lectura de la semana o de las horas por día | Toast «Error al cargar las asignaciones de tiempo» y el aviso «No se pudieron cargar las asignaciones. Intentá de nuevo más tarde.» | inicial |

## Ejemplos
- ASI-02: con 6 **horas por día**, la capacidad semanal es 30 h. Una celda de 50 % son 15 h y se guardan 900 minutos; una de 33,3 % son 9,99 h y se guardan 599 minutos (redondeo de 599,4).
- ASI-04: una persona con 60 % en un proyecto y 50 % en otro suma 110 %: sus celdas y su total se resaltan y «Guardar» sigue habilitado.
- ASI-06: hoy es jueves 2026-11-12; el lunes actual es 2026-11-09. Se puede reemplazar la semana del 2026-11-09 y las siguientes; la del 2026-11-02 da `invalid_date_range`.
