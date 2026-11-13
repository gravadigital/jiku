---
prefix: BUS
name: Integración por el bus
surfaces: []
covers: Consultas genéricas de lectura con filtros, cursor y recorte externo, comandos directos de conectores, eventos de dominio publicados después de cada cambio, el registro de módulos y el espacio KV por identidad
entities: [Cliente, Proyecto, Requisito, Tarea, Actividad de requisito, Actividad de tarea, Suscripción a requisito, Suscripción a tarea, Adjunto, Archivo, Persona, Usuario, Hora trabajada, Ausencia, Asignación semanal, Permiso de proyecto, Ajuste del sistema]
last_requirement: BUS-13
last_failure: BUS-E9
---

# BUS — Integración por el bus

## Requisitos
| ID | Requisito | Actor | Origen |
|---|---|---|---|
| BUS-01 | Consultar por el bus, con la identidad propia: listado y lectura por id de clientes, proyectos, requisitos, tareas y comentarios; listado de actividad, suscripciones, adjuntos, personas, usuarios, horas, ausencias, asignaciones semanales, permisos de proyecto y ajustes del sistema; lectura de un archivo por id (sin URLs); las etiquetas usadas en un proyecto, y la descripción de los recursos consultables | U-04, U-01, U-02, U-03 | inicial |
| BUS-02 | Un listado acepta filtros (igualdad, lista, nulo, negación, rangos, texto, contiene para etiquetas y un nivel de «o»), orden (con el id como desempate), campos, relaciones a incluir y conteo; pagina por cursor opaco con **límite de página por defecto** y como mucho **límite de página máximo**, y corta además la página por tamaño de mensaje, marcando los campos largos recortados | U-04, U-01, U-02, U-03 | inicial |
| BUS-03 | La búsqueda de texto en tareas encuentra coincidencias aproximadas en título y descripción | U-04, U-01, U-02, U-03 | inicial |
| BUS-04 | Recorte externo: un Cliente solo obtiene filas de proyectos donde tiene permiso; de requisitos y tareas, solo las públicas; de comentarios y actividad, solo los públicos de padres públicos; solo sus suscripciones; adjuntos y archivos de entidades permitidas o propios; personas de proyectos permitidos; usuarios con los que comparte un proyecto, o él mismo; y de horas, ausencias, asignaciones y ajustes, una lista vacía | U-03 | inicial |
| BUS-05 | Los roles y el tipo de identidad de los usuarios solo se pueden consultar como conector; los ajustes consultables son solo las horas por día y los cinco de archivos | — | inicial |
| BUS-06 | Un conector ejecuta cualquier comando publicándolo directo en el bus con su identidad; es el autor de lo que crea (la autoría declarada en el pedido se ignora) y en horas y ausencias rigen con él las reglas de titularidad | U-04 | inicial |
| BUS-07 | Las personas publican directo en el bus con su token: `admin` y `user` consultas y comandos internos; un Cliente, solo consultas | U-01, U-02, U-03 | inicial |
| BUS-08 | Cada comando es atómico: sus cambios y sus notificaciones se confirman juntos o no se confirma nada | — | inicial |
| BUS-09 | Los comandos no son idempotentes: repetir uno crea otra fila, y un comando que vence por tiempo puede haberse ejecutado | — | inicial |
| BUS-10 | Después de confirmar cada cambio se publican los eventos de dominio en el stream de eventos: `requirement.created`, `requirement.state.changed`, `requirement.updated`, `requirement.resolved`, `requirement.reopened`, `requirement.assigned`, `requirement.comment.created`, `requirement.comment.edited`, `requirement.subscriptor.added`, `requirement.subscriptor.removed`, `task.created`, `task.state.changed`, `task.updated`, `task.assigned`, `task.comment.created` y `task.comment.edited`; cada uno con id ULID, tipo, versión, instante UTC, id de correlación del comando, actor, entidad con su proyecto, foto de la entidad y, según el tipo, cambios, destinatarios, comentario y visibilidad. Si la publicación falla, el cambio queda y el evento se pierde | — | inicial |
| BUS-11 | Los conectores leen los eventos de dominio del stream, que los conserva la **retención de eventos** | U-04 | inicial |
| BUS-12 | Los módulos opcionales se anuncian en el registro de módulos del bus, que conectores y personas leen | U-04 | inicial |
| BUS-13 | Cada conector tiene un espacio clave-valor propio en el bus: lee y escribe solo las claves bajo su instancia y su id | U-04 | inicial |

## Condiciones de falla
| ID | Condición | Resultado | Origen |
|---|---|---|---|
| BUS-E1 | El cuerpo del mensaje no es JSON válido | Reply `invalid_fields` («Malformed JSON payload») | inicial |
| BUS-E2 | El método no existe | Reply `unknown_command` | inicial |
| BUS-E3 | Una consulta de una identidad sin clase (sin espejo en el producto ni rol conocido) | Reply `unknown_caller` | inicial |
| BUS-E4 | Un filtro, campo, orden o relación no admitidos, un filtro obligatorio ausente (el tipo de entidad en comentarios y actividad, el proyecto en etiquetas) o campos de identidad en el cuerpo de una consulta | Reply `invalid_fields` con `errorDetails` (`field`, `value`, `allowed`) | inicial |
| BUS-E5 | El cursor no es válido o no corresponde a los filtros y el orden | Reply `invalid_cursor` | inicial |
| BUS-E6 | La consulta supera el **tiempo máximo de consulta** | Reply `query_timeout` | inicial |
| BUS-E7 | La lectura por id no encuentra la fila | Reply `{recurso}_not_found` (por ejemplo `requirement_not_found`) | inicial |
| BUS-E8 | Error inesperado en un comando o una consulta | Reply `internal_error`; el comando no confirma nada | inicial |
| BUS-E9 | La api publica un comando y core no responde, o no responde dentro del **tiempo de espera de comandos** | 503 `service_unavailable` / 504 `gateway_timeout` | inicial |
