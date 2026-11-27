---
prefix: AUS
name: Ausencias
surfaces: [Gestor interno]
covers: Registro y borrado de ausencias por persona y día con su motivo, el tope diario compartido con las horas trabajadas y la consulta y el reporte de ausencias
entities: [Ausencia, Horas trabajadas, Persona]
last_requirement: AUS-10
last_failure: AUS-E9
---

# AUS — Ausencias

## Requirements
| ID | Requirement | Actor | Origin |
|---|---|---|---|
| AUS-01 | Una persona del equipo registra una ausencia propia: fecha (`YYYY-MM-DD`), minutos (entero, mínimo 1) y motivo obligatorios. Si no indica la persona, se toma la Persona vinculada a su usuario. Responde 201 con el registro | U-02 | initial |
| AUS-02 | El administrador registra ausencias a nombre de cualquier persona (la elige en el selector «Persona» de la pantalla de carga) | U-01 | initial |
| AUS-03 | Los motivos son: Trámite (`tramite`), Cortes de servicios (`corte_servicios`), Vacaciones (`vacaciones`), Día no laborable (`dia_no_laborable`), Personal (`personal`), Médico (`medico`), Estudio (`estudio`), Enfermedad (`enfermedad`) y Otro (`otro`). Cualquier identidad autenticada consulta la lista | — | initial |
| AUS-04 | Tope diario compartido: las horas trabajadas más las ausencias ya registradas de la persona ese día, más la ausencia nueva, no pueden superar 1440 minutos | — | initial |
| AUS-05 | Las ausencias no tienen ventana de fechas: se registran para cualquier fecha, pasada o futura. La pantalla solo ofrece los días de su selector (HOR-08) | — | initial |
| AUS-06 | Una persona borra una ausencia propia, y el administrador la de cualquiera, siempre que el registro se haya creado en los últimos 10 días (cuenta la fecha de creación del registro, no la fecha de la ausencia) | U-01, U-02 | initial |
| AUS-07 | Cualquier identidad autenticada consulta las ausencias de cualquier persona en un día, de la más reciente a la más antigua, con su motivo | — | initial |
| AUS-08 | Cualquier identidad autenticada consulta el reporte de ausencias de cualquier persona en un rango de fechas: por día, el total de minutos y cada ausencia con su motivo, ordenado por fecha | — | initial |
| AUS-09 | En la pantalla «Horas Trabajadas» el «Modo de asistencia» alterna entre «Presente» y «Ausente»; en «Ausente» se elige el «Motivo de ausencia» y el tiempo con los mismos botones que las horas. Al registrar se avisa «Ausencia registrada exitosamente» y la pantalla vuelve a «Presente» | U-01, U-02 | initial |
| AUS-10 | Las ausencias cuentan para el estado de carga de cada día (HOR-09) y se borran desde la lista del día con confirmación («Eliminar ausencia»), avisando «Ausencia eliminada» | U-01, U-02 | initial |

## Failure conditions
| ID | Condition | Result | Origin |
|---|---|---|---|
| AUS-E1 | No se indicó la persona y el usuario no tiene una Persona vinculada | 400 `person_not_found` «No se encontró una persona vinculada al usuario autenticado» | initial |
| AUS-E2 | La persona indicada no existe | 400 `person_not_found` «Person not found» | initial |
| AUS-E3 | Alguien sin rol `admin` registra una ausencia a otra persona, o a una persona sin usuario vinculado | 403 `access_denied` «Solo podés cargar tus propias ausencias» | initial |
| AUS-E4 | La ausencia haría superar el tope diario compartido | 400 `daily_limit_exceeded` «Se superaría el máximo de 24 horas (1440 minutos). Minutos disponibles: {N}», con `remainingMinutes` = N | initial |
| AUS-E5 | Falta la fecha, los minutos o el motivo, la fecha no tiene la forma `YYYY-MM-DD`, los minutos son menores que 1 o el motivo no es uno de la lista | 400 `invalid_fields` «Invalid field - {detalle}» | initial |
| AUS-E6 | Se borra una ausencia que no existe | 404 `unworked_time_not_found` «Registro de tiempo no trabajado no encontrado» | initial |
| AUS-E7 | Se borra una ausencia creada hace más de 10 días | 400 `deadline_exceeded` «Solo se pueden eliminar registros creados en los últimos 10 días» | initial |
| AUS-E8 | Alguien sin rol `admin` borra una ausencia de otra persona | 403 `access_denied` «Solo podés eliminar tus propios registros» | initial |
| AUS-E9 | Dos registros simultáneos de la misma persona y día superan juntos el tope diario | Los dos se guardan: el tope se verifica antes de insertar y sin bloqueo | initial |

## Examples
- AUS-04: la persona tiene 900 minutos trabajados y 300 de ausencia el 2026-11-20; registrar otra ausencia de 300 responde AUS-E4 con «Minutos disponibles: 240».
- AUS-05: el 2026-11-27 se puede registrar una ausencia por `vacaciones` para el 2026-12-15 (por la api; la pantalla no ofrece ese día).
- AUS-06: una ausencia del 2026-10-01 registrada el 2026-11-20 se puede borrar hasta el 2026-11-30; una ausencia del 2026-11-26 registrada el 2026-11-10 ya no se puede borrar (AUS-E7).
