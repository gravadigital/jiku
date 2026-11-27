---
entity: Adjunto
tables: [attachments]
describes: Vínculo entre un archivo y la entidad a la que se adjunta (proyecto, requisito, tarea o comentario)
---

# Adjunto

## Attributes
| Attribute | Type | Required | Constraints | Personal data | Origin |
|---|---|---|---|---|---|
| tipo de entidad | enum | sí | en uso: project, requirement, objective, requirement_comment, objective_comment; el tipo de la base conserva además siete valores legados (stage, comment y los cinco con sufijo _draft) que ninguna fila usa | no | initial |
| entidad | referencia | sí | identificador de la entidad del tipo indicado; polimórfica, sin clave foránea | no | initial |
| archivo | referencia | sí | a Archivo | no | initial |
| fecha de baja | fecha y hora | no | ningún comando la escribe | no | initial |
| dado de baja por | referencia | no | a Usuario; ningún comando la escribe | no | initial |

## Relationships
- Un Adjunto une 1 Archivo con 1 entidad: un Proyecto, un Requisito, una Tarea o un comentario (Actividad de requisito o de tarea).
- Una entidad tiene 0..N Adjuntos; por operación se vinculan a lo sumo 10 archivos.

## Removal
Se elimina físicamente: al quitarlo de la entidad (los archivos que se mandan reemplazan a los vinculados) o con la operación de desvincular. El Archivo no se borra. Si se borra la entidad, el Adjunto queda huérfano (no hay clave foránea hacia ella).
