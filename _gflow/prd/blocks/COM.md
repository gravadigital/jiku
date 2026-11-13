---
prefix: COM
name: Comentarios y actividad
surfaces: [Gestión interna, Portal de clientes]
covers: Comentarios de requisitos y tareas (alta, edición solo por el autor o un admin, visibilidad) y el historial de cambios de cada uno
entities: [Actividad de requisito, Actividad de tarea, Requisito, Tarea]
last_requirement: COM-09
last_failure: COM-E7
---

# COM — Comentarios y actividad

## Requisitos
| ID | Requisito | Actor | Origen |
|---|---|---|---|
| COM-01 | Comentar un requisito o una tarea desde Gestión interna, con texto markdown, archivos y visibilidad interna (por defecto) o pública | U-01, U-02 | inicial |
| COM-02 | Comentar un requisito desde el Portal de clientes, con texto y archivos; el comentario es siempre público y la respuesta trae el comentario con su autor | U-03, U-02 | inicial |
| COM-03 | Editar un comentario de requisito o de tarea: solo su autor o un `admin`; cambia el texto y los archivos, registra quién y cuándo editó, y la visibilidad no cambia; Gestión interna ofrece editar solo a ellos | U-01, U-02 | inicial |
| COM-04 | Cada cambio de título, descripción o estado de un requisito queda en su actividad con el valor anterior, el nuevo y el autor, como actividad pública; los cambios de los demás campos no dejan rastro | — | inicial |
| COM-05 | Cada cambio de título, fecha estimada, estado, área, prioridad o descripción de una tarea queda en su historial con el valor anterior, el nuevo y el autor; el paso a vacío no se registra salvo en la fecha estimada; estado, título y descripción son actividad pública y el resto interna | — | inicial |
| COM-06 | La actividad se muestra en orden cronológico ascendente, con la fecha relativa («hace …»), la marca «(editado)» o «(editado por …)» y, en Gestión interna, si cada comentario es «Interno» o «Público» | U-01, U-02, U-03 | inicial |
| COM-07 | El Portal de clientes muestra solo la actividad pública de un requisito público | U-03, U-02 | inicial |
| COM-08 | Un Cliente que comenta con la operación de comentario de Gestión interna (no la del portal) guarda el comentario con la visibilidad que pida, sobre cualquier requisito de sus proyectos, público o interno | — | inicial |
| COM-09 | Las tareas muestran por separado el «Historial de cambios» y los «Comentarios»; los requisitos los muestran juntos en «Actividad» | U-01, U-02 | inicial |

## Condiciones de falla
| ID | Condición | Resultado | Origen |
|---|---|---|---|
| COM-E1 | Comentario vacío | 400 `invalid_fields`; la pantalla de tareas muestra «El comentario no puede estar vacío» | inicial |
| COM-E2 | Comentar o editar un comentario de un requisito que no existe | 404 `requirement_not_found` | inicial |
| COM-E3 | Comentar una tarea que no existe, o editar un comentario de una tarea que no existe | 400 `objective_not_found` | inicial |
| COM-E4 | El comentario no existe o es de otra entidad | 400 `comment_not_found` («Comentario no encontrado»); la pantalla muestra «El comentario ya no existe» | inicial |
| COM-E5 | La entrada de actividad que se quiere editar no es un comentario | 400 `activity_not_editable` («La actividad no es un comentario editable») | inicial |
| COM-E6 | Quien edita no es el autor ni `admin` | 403 `comment_not_owned` («Solo el autor del comentario puede editarlo»); la pantalla muestra «No podés editar un comentario que no es tuyo» | inicial |
| COM-E7 | En el portal, el comentario es rechazado por permiso | La pantalla muestra «Sin permiso para comentar» | inicial |
