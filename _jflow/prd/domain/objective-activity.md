---
entity: Actividad de tarea
tables: [objective_activity]
describes: Entrada del historial de una tarea: un cambio de campo registrado por el sistema o un comentario escrito por alguien
---

# Actividad de tarea

## Attributes
| Attribute | Type | Required | Constraints | Personal data | Origin |
|---|---|---|---|---|---|
| tarea | referencia | sí | a Tarea; sin clave foránea en la base | no | initial |
| tipo de actividad | enum | no | title, state, area, comment, description, person, priority, estimatedFinishDate, stageId; hoy se escriben title, description, state, area, priority, estimatedFinishDate y comment; stageId es legado de las etapas eliminadas | no | initial |
| valor anterior | texto | no | en un cambio, el valor previo del campo | no | initial |
| valor nuevo | texto | no | en un cambio, el valor nuevo; en un comentario, su texto | no | initial |
| visibilidad | enum | sí | public, internal; los cambios de estado, título y descripción son public, los de área, prioridad y fecha estimada internal; un comentario toma la que elige su autor (por omisión internal) y no se puede cambiar después | no | initial |
| autor | referencia | sí | a Usuario | no | initial |
| fecha de edición | fecha y hora | no | solo en comentarios; nula si nunca se editó | no | initial |
| editado por | referencia | no | a Usuario; su autor o un administrador | no | initial |

## Relationships
- Una Actividad de tarea pertenece a 1 Tarea.
- Un comentario tiene 0..N Adjuntos.

## Removal
Nunca: ningún comando la elimina. Los cambios de campo son inmutables; de un comentario solo cambian el texto y los adjuntos.
