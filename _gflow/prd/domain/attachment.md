---
entity: Adjunto
tables: [attachments]
describes: Vínculo entre un archivo y la entidad a la que se adjunta (proyecto, requisito, tarea o comentario)
---

# Adjunto

## Atributos
| Atributo | Tipo | Obligatorio | Restricciones | Dato personal | Origen |
|---|---|---|---|---|---|
| tipo de entidad | enum | sí | se escriben `requirement`, `objective`, `requirement_comment` y `objective_comment`; `project` se lee pero ningún comando lo escribe; el tipo admite además siete valores legados que ya no se escriben (`stage`, `comment`, `comment_draft`, `objective_draft`, `requirement_draft`, `objective_comment_draft`, `requirement_comment_draft`) | no | inicial |
| entidad | número | sí | id de la entidad del tipo indicado; vínculo polimórfico, sin referencia en la base | no | inicial |
| archivo | referencia | sí | Archivo existente (INV-13), activo y subido por quien lo vincula (INV-15); a lo sumo una vez por entidad (INV-16) | no | inicial |
| borrado en | fecha y hora | no | columna vestigial: desvincular borra la fila | no | inicial |
| borrado por | referencia | no | Usuario; columna vestigial | no | inicial |

## Relaciones
- Un Adjunto referencia 1 Archivo.
- Un Adjunto pertenece a 1 entidad: Proyecto, Requisito, Tarea, Actividad de requisito (comentario) o Actividad de tarea (comentario).

## Baja
Se elimina (borrado físico): al borrar el adjunto, o cuando la edición de la entidad o del comentario deja de incluir su archivo. El archivo se conserva.
