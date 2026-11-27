---
entity: Horas trabajadas
tables: [worked_times]
describes: Minutos que una persona dedicó un día a un proyecto, imputados a una tarea o a un requisito
---

# Horas trabajadas

## Attributes
| Attribute | Type | Required | Constraints | Personal data | Origin |
|---|---|---|---|---|---|
| fecha | fecha | sí | día AAAA-MM-DD, guardado como medianoche UTC; solo el día actual y los días previos de la ventana de carga; la base lo admite nulo | no | initial |
| minutos | duración | sí | entero, al menos 1; la base lo admite nulo | no | initial |
| proyecto | referencia | sí | a Proyecto; la base lo admite nulo | no | initial |
| persona | referencia | sí | a Persona; por omisión, la Persona del usuario que carga; solo un administrador carga horas de otra persona; la base lo admite nulo | no | initial |
| tarea | referencia | no | a Tarea; excluyente con requisito | no | initial |
| requisito | referencia | no | a Requisito; excluyente con tarea; debe ser del mismo proyecto | no | initial |

## Relationships
- Unas Horas trabajadas pertenecen a 1 Persona y a 1 Proyecto, y a 0..1 Tarea o 0..1 Requisito, nunca a los dos.

## Removal
Se eliminan físicamente, solo dentro de la ventana de carga y solo por la persona dueña o un administrador. No se editan. Se eliminan en cascada si se borra la Persona o el Proyecto; si se borra la Tarea o el Requisito, quedan sin esa referencia.
