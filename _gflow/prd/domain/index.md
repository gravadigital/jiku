# Entidades

Generado por `grava.py def-index` desde el frontmatter de cada entidad. No editar a mano.

| Entidad | Archivo | Tablas | Describe |
|---|---|---|---|
| Actividad de requisito | requirement-activity.md | requirement_activity | Entrada del historial de un requisito: un cambio de campo o un comentario |
| Actividad de tarea | objective-activity.md | objective_activity | Entrada del historial de una tarea: un cambio de campo o un comentario |
| Adjunto | attachment.md | attachments | Vínculo entre un archivo y la entidad a la que se adjunta (proyecto, requisito, tarea o comentario) |
| Ajuste del sistema | system-setting.md | system_settings | Valor de configuración guardado en la base (política de archivos, envío de notificaciones, horas por día) |
| Archivo | file.md | files | Bytes de un archivo subido al almacenamiento de objetos, con sus metadatos; existe por su cuenta y se vincula a entidades con adjuntos |
| Asignación semanal | week-assigned-time.md | week_assigned_times | Minutos planificados para una persona en un proyecto durante una semana laboral |
| Ausencia | unworked-time.md | unworked_times | Minutos que una persona no trabajó un día, con su motivo |
| Cliente | client.md | clients | Organización para la que se trabaja (en la interfaz, "actor"); agrupa proyectos |
| Hora trabajada | worked-time.md | worked_times | Minutos que una persona trabajó un día en un proyecto, opcionalmente imputados a una tarea o a un requisito |
| Notificación pendiente | notification-outbox.md | notification_outbox | Mail a un destinatario encolado junto con el cambio que lo origina, que un proceso periódico envía con reintentos |
| Permiso de proyecto | user-project-permission.md | user_project_permissions | Acceso explícito de un usuario (en la práctica, un cliente) a un proyecto |
| Persona | person.md | people | Integrante del equipo que carga horas, recibe asignaciones y es responsable de tareas y requisitos |
| Proyecto | project.md | projects, projects_persons | Trabajo para un cliente o interno, con estado, propiedades y personas; contiene requisitos y tareas |
| Requisito | requirement.md | requirements, people_requirements | Pedido de trabajo sobre un proyecto, con estado, responsables, especificación y resolución; puede crearlo un cliente desde el portal |
| Suscripción a requisito | requirement-subscriptor.md | requirement_subscriptors | Un usuario que recibe las notificaciones de un requisito |
| Suscripción a tarea | objectives-subscriptor.md | objectives_subscriptors | Un usuario suscripto a una tarea; solo se lee |
| Tarea | objective.md | objectives, people_objectives | Unidad de trabajo interna de un proyecto, con responsables, estado, área y prioridad; puede desglosar un requisito |
| Usuario | user.md | users | Espejo local de una identidad del proveedor de identidad (persona o servicio), con sus roles |
