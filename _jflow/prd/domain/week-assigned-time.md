---
entity: Asignación semanal
tables: [week_assigned_times]
describes: Minutos planificados para una persona en un proyecto durante una semana laboral (lunes a viernes)
---

# Asignación semanal

## Attributes
| Attribute | Type | Required | Constraints | Personal data | Origin |
|---|---|---|---|---|---|
| semana desde | fecha | sí | un lunes, de la semana actual o una posterior; se guarda como medianoche; la base lo admite nulo | no | initial |
| semana hasta | fecha | sí | el viernes de esa semana (lunes más 4 días); la base lo admite nulo | no | initial |
| minutos | duración | sí | entero, al menos 1 (una asignación de 0 minutos no se guarda); la base lo admite nulo | no | initial |
| proyecto | referencia | sí | a Proyecto; la base lo admite nulo | no | initial |
| persona | referencia | sí | a Persona; la base lo admite nulo | no | initial |
| interna | booleano | sí | se deriva del tipo del proyecto (interno); la base lo admite nulo | no | initial |

## Derived attributes
| Attribute | Calculation rule | Origin |
|---|---|---|
| semana hasta | semana desde más 4 días | initial |
| interna | verdadero si el tipo del proyecto es interno al momento de guardar | initial |

## Relationships
- Una Asignación semanal pertenece a 1 Persona y a 1 Proyecto.

## Removal
No se crean ni se eliminan una por una: la semana entera (todas las personas y proyectos) se reemplaza de una vez, y una lista vacía la vacía. Las semanas pasadas no se modifican. Se eliminan en cascada si se borra la Persona o el Proyecto.
