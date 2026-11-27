---
entity: Actividad de requisito
tables: [requirement_activity]
describes: Entrada del historial de un requisito: un cambio de campo registrado por el sistema o un comentario escrito por alguien
---

# Actividad de requisito

## Attributes
| Attribute | Type | Required | Constraints | Personal data | Origin |
|---|---|---|---|---|---|
| requisito | referencia | sí | a Requisito | no | initial |
| tipo de actividad | enum | sí | state, comment, type, priority, estimatedFinishDate, tag, resolution, title, description; hoy solo se escriben title, description, state y comment | no | initial |
| valor anterior | texto | sí | en un cambio, el valor previo del campo | no | initial |
| valor nuevo | texto | sí | en un cambio, el valor nuevo; en un comentario, su texto | no | initial |
| visibilidad | enum | sí | public, internal; los cambios de estado, título y descripción son public; un comentario toma la que elige su autor (por omisión internal) y no se puede cambiar después | no | initial |
| autor | referencia | sí | a Usuario; quien hizo el cambio o escribió el comentario | no | initial |
| fecha de edición | fecha y hora | no | solo en comentarios; nula si nunca se editó | no | initial |
| editado por | referencia | no | a Usuario; quien hizo la última edición del comentario (su autor o un administrador) | no | initial |

## Relationships
- Una Actividad de requisito pertenece a 1 Requisito.
- Un comentario tiene 0..N Adjuntos.

## Removal
Nunca: ningún comando la elimina. Los cambios de campo son inmutables; de un comentario solo cambian el texto y los adjuntos. Se elimina en cascada si se borra su Requisito.
