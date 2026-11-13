---
entity: Actividad de requisito
tables: [requirement_activity]
describes: Entrada del historial de un requisito: un cambio de campo o un comentario
---

# Actividad de requisito

## Atributos
| Atributo | Tipo | Obligatorio | Restricciones | Dato personal | Origen |
|---|---|---|---|---|---|
| tipo de actividad | enum | sí | `state`, `comment`, `type`, `priority`, `estimatedFinishDate`, `tag`, `resolution`, `title`, `description` | no | inicial |
| valor anterior | texto | sí | valor previo del campo cambiado | no | inicial |
| valor nuevo | texto | sí | valor nuevo del campo, o el texto del comentario | no | inicial |
| visibilidad | enum | sí | `public`, `internal`; default `internal`; la de un comentario se elige al crearlo y no cambia al editarlo | no | inicial |
| requisito | referencia | sí | Requisito | no | inicial |
| autor | referencia | sí | Usuario que hizo el cambio o escribió el comentario | no | inicial |
| editado en | fecha y hora | no | nulo si nunca se editó; solo en comentarios | no | inicial |
| editado por | referencia | no | Usuario que hizo la última edición del comentario | no | inicial |

## Relaciones
- Una Actividad de requisito pertenece a 1 Requisito.
- Una Actividad de requisito tiene 1 Usuario autor y 0..1 Usuario editor.
- Una Actividad de requisito de tipo `comment` tiene 0..n Adjunto (tipo de entidad `requirement_comment`).

## Baja
Nunca: el historial y los comentarios no se borran; un comentario solo se edita. Se borran en cascada con su requisito.
