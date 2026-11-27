# Glossary

| Term | Definition | Origin |
|---|---|---|
| Actor (en la interfaz) | Nombre que el gestor interno le da al Cliente. No confundir con los actores del producto (U-01…U-05) | initial |
| Visibilidad | Nivel de un requisito, tarea o actividad: public (lo ve también el usuario de cliente en el portal) o internal (solo el equipo). Los requisitos y tareas nacen public; los comentarios, internal salvo que su autor elija otra | initial |
| Estado | Etapa del ciclo de un proyecto, requisito o tarea. Las transiciones son libres: cualquier estado se alcanza desde cualquier otro y ninguno es terminal | initial |
| Tipo de requisito | Clasificación de un requisito: funcionalidad, mejora, incidencia u otro. Puede faltar (sin tipo) | initial |
| Sin tipo | Requisito sin tipo de requisito (valor nulo) en el gestor interno. En el portal de clientes, elegir «Sin tipo» guarda el tipo otro | initial |
| Incidencia | Tipo de requisito que reporta un error. Es el único que, para pasar a resuelto, exige tipo de resolución y conclusión | initial |
| Resolución | Cierre de un requisito en estado resuelto: tipo de resolución (error_interno, fuera_de_alcance, error_externo, discutible, otro), conclusión y comentario | initial |
| Reabrir | Sacar un requisito de resuelto hacia un estado que no sea cancelado; borra los tres campos de la resolución | initial |
| Responsable | Persona asignada a un requisito o a una tarea. La primera de la lista es la líder | initial |
| Líder | El primer responsable de un requisito o tarea | initial |
| Suscriptor | Usuario que recibe por email las notificaciones de un requisito. Un usuario se suscribe a lo sumo una vez por requisito | initial |
| Actividad | Entrada del historial de un requisito o tarea: un cambio de campo (inmutable) o un comentario | initial |
| Comentario | Actividad de tipo comment escrita por alguien, con visibilidad y adjuntos. Su autor o un administrador puede editar el texto y los adjuntos, no la visibilidad | initial |
| Área | Disciplina de una tarea: diseño, desarrollo, gestion o investigacion | initial |
| Prioridad | Urgencia relativa de un requisito o tarea: sin_prioridad, baja, media, alta, urgente | initial |
| Etiqueta | Par clave/valor que clasifica un requisito; los requisitos se filtran por etiqueta | initial |
| Propiedades del proyecto | Enlaces y datos del proyecto, por código: documentacion, diseño, board_de_tareas (URI) y mattermost_group_name | initial |
| Proyecto interno | Proyecto de tipo interno; sus asignaciones semanales se marcan internas | initial |
| Ventana de carga | Días en que se cargan y eliminan horas trabajadas: el día actual y los 10 previos, para todos los roles | initial |
| Tope diario | Máximo de minutos por persona y día: 1440. Al cargar horas trabajadas cuenta solo las horas trabajadas; al cargar una ausencia, horas trabajadas más ausencias | initial |
| Semana de asignación | Semana laboral de lunes a viernes, identificada por su lunes, sobre la que se planifica la asignación semanal | initial |
| Personas del proyecto | Personas vinculadas a un proyecto; el producto las lee pero no las administra | initial |
| Archivo sin vínculo | Archivo subido que no tiene ningún adjunto; es un estado válido | initial |
| Vincular | Asociar archivos ya subidos a una entidad (hasta 10 por operación); solo quien subió un archivo puede vincularlo | initial |
| Identidad de servicio | Usuario del proveedor de identidad que no es una persona (api, core, conectores, docs); no tiene email | initial |
| Conector | Sistema externo que actúa sobre el producto por el bus con una identidad de servicio de rol internal-app: publica comandos y consultas y consume los eventos de dominio. La api es uno | initial |
| Módulo | Servicio opcional que se registra en el registro de módulos del bus y que la api descubre y expone; hoy, la documentación (jiku-docs) | initial |
| Instancia | Una instalación del producto; su nombre es el prefijo de todos los subjects del bus | initial |
| Sobre de identidad | Datos de quien actúa (id, roles, nombre, email) que la api agrega a cada comando; core solo lo acepta del publicador de confianza | initial |
| Publicador de confianza | La identidad de servicio (la api) cuyo sobre de identidad core acepta | initial |
| Evento de dominio | Hecho ya confirmado de un requisito o tarea (creado, cambio de estado, comentario, asignación, resolución…) que core publica en el bus para los conectores | initial |
| Evento de autenticación | Aviso del bus, en cada conexión, con la identidad y los roles de quien se conecta; core lo usa para crear o actualizar el Usuario | initial |
| Documento compartido | Documento de la documentación al que se accede sin autenticarse con un link que contiene un token | initial |
