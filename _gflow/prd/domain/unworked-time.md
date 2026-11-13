---
entity: Ausencia
tables: [unworked_times]
describes: Minutos que una persona no trabajó un día, con su motivo
---

# Ausencia

## Atributos
| Atributo | Tipo | Obligatorio | Restricciones | Dato personal | Origen |
|---|---|---|---|---|---|
| fecha | fecha | sí | día `YYYY-MM-DD`; sin ventana de carga | no | inicial |
| minutos | duración | sí | entero mayor o igual a 1; con las horas trabajadas del día no supera el tope diario (INV-09) | no | inicial |
| motivo | enum | sí | `tramite`, `corte_servicios`, `vacaciones`, `dia_no_laborable`, `personal`, `medico`, `estudio`, `enfermedad`, `otro` | sí | inicial |
| persona | referencia | sí | Persona; si no se indica, la del usuario que carga; solo un administrador carga ausencias de otra persona | no | inicial |

## Relaciones
- Una Ausencia pertenece a 1 Persona.

## Baja
Se elimina (borrado físico): la borra su titular, o un administrador, mientras no hayan pasado diez días desde que se cargó. Una persona con ausencias no se puede borrar.
