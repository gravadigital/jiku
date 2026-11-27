---
entity: Ausencia
tables: [unworked_times]
describes: Minutos de un día en que una persona no trabajó, con su motivo
---

# Ausencia

## Attributes
| Attribute | Type | Required | Constraints | Personal data | Origin |
|---|---|---|---|---|---|
| fecha | fecha | sí | día AAAA-MM-DD; sin ventana de carga | no | initial |
| minutos | duración | sí | entero, al menos 1 | no | initial |
| motivo | enum | sí | tramite, corte_servicios, vacaciones, dia_no_laborable, personal, medico, estudio, enfermedad, otro | sí (medico y enfermedad revelan datos de salud) | initial |
| persona | referencia | sí | a Persona; solo un administrador carga ausencias de otra persona | no | initial |

## Relationships
- Una Ausencia pertenece a 1 Persona; una Persona tiene 0..N Ausencias.

## Removal
Se elimina físicamente, solo por la persona dueña o un administrador. No se edita. La base rechaza borrar una Persona que tenga ausencias.
