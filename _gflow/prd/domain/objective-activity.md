---
entity: Actividad de tarea
tables: [objective_activity]
describes: Entrada del historial de una tarea: un cambio de campo o un comentario
---

# Actividad de tarea

## Atributos
| Atributo | Tipo | Obligatorio | Restricciones | Dato personal | Origen |
|---|---|---|---|---|---|
| tipo de actividad | enum | sí | `state`, `area`, `comment`, `title`, `person`, `priority`, `estimatedFinishDate`, `description`; `stageId` es un valor legado que ya no se escribe; la base de producción lo admite nulo | no | inicial |
| valor anterior | texto | sí | valor previo del campo cambiado; la base de producción lo admite nulo | no | inicial |
| valor nuevo | texto | sí | valor nuevo del campo, o el texto del comentario; la base de producción lo admite nulo | no | inicial |
| visibilidad | enum | sí | `public`, `internal`; default `internal`; los cambios de estado, título y descripción se registran `public` y el resto `internal`; la de un comentario se elige al crearlo y no cambia al editarlo | no | inicial |
| tarea | referencia | sí | Tarea | no | inicial |
| autor | referencia | sí | Usuario que hizo el cambio o escribió el comentario | no | inicial |
| editado en | fecha y hora | no | nulo si nunca se editó; solo en comentarios | no | inicial |
| editado por | referencia | no | Usuario que hizo la última edición del comentario | no | inicial |

## Relaciones
- Una Actividad de tarea pertenece a 1 Tarea.
- Una Actividad de tarea tiene 1 Usuario autor y 0..1 Usuario editor.
- Una Actividad de tarea de tipo `comment` tiene 0..n Adjunto (tipo de entidad `objective_comment`).

## Baja
Nunca: el historial y los comentarios no se borran; un comentario solo se edita.
