# Invariants

Rules on the data that always hold. How each one is kept is in `architecture/guarantees.md`.

| ID | Rule | Entities | Applied in | Origin |
|---|---|---|---|---|
| INV-01 | Una carga de horas trabajadas se imputa a una tarea o a un requisito, nunca a los dos a la vez | Horas trabajadas | HOR | initial |
| INV-02 | El requisito de una carga de horas trabajadas pertenece al proyecto de la carga | Horas trabajadas, Requisito, Proyecto | HOR | initial |
| INV-03 | Las horas trabajadas de una persona en un día no superan 1440 minutos | Horas trabajadas | HOR | initial |
| INV-04 | Al registrar una ausencia, las horas trabajadas más las ausencias de la persona en ese día no superan 1440 minutos | Ausencia, Horas trabajadas | AUS | initial |
| INV-05 | Solo un `admin` crea o borra horas trabajadas o ausencias de una persona que no es la vinculada a su propio usuario; queda exento solo el comando del publicador de confianza sin sobre de identidad | Horas trabajadas, Ausencia, Persona | HOR, AUS, CON | initial |
| INV-06 | Una tarea se vincula solo a un requisito de su mismo proyecto | Tarea, Requisito | TAR | initial |
| INV-07 | Un usuario está suscripto a lo sumo una vez a cada requisito | Requisito, Usuario | REQ, POR | initial |
| INV-08 | Un archivo se vincula a una entidad solo si existe, está activo y lo subió quien hace la operación | Archivo, Adjunto | ARC, REQ, TAR, POR | initial |
| INV-09 | Cada archivo tiene una ubicación en el almacenamiento que no comparte con ningún otro | Archivo | ARC | initial |
| INV-10 | Un usuario tiene a lo sumo un permiso sobre cada proyecto | Permiso de proyecto | PRY, CON | initial |
| INV-11 | Un usuario de cliente solo ejecuta comandos sobre entidades de proyectos sobre los que tiene permiso, y las consultas del bus solo le devuelven filas de esos proyectos | Permiso de proyecto, Requisito, Archivo, Adjunto | CON, POR, ARC | initial |
| INV-12 | Un requisito `internal` no aparece en el Portal de clientes, y a un caller externo las consultas del bus le devuelven solo requisitos, tareas, comentarios y actividad públicos | Requisito, Actividad de requisito, Tarea, Actividad de tarea | POR, CON, DOC | initial |
| INV-13 | Una notificación pendiente existe solo si el cambio que la originó quedó confirmado | Notificación pendiente | NOT | initial |
| INV-14 | Una notificación se encola solo para un requisito `public` y para un destinatario con email y con permiso sobre el proyecto del requisito | Notificación pendiente, Requisito, Usuario, Permiso de proyecto | NOT | initial |
| INV-15 | Un requisito, una tarea o un comentario queda guardado junto con sus responsables, suscriptores, actividad y vínculos de archivo, o no queda nada de la operación | Requisito, Tarea, Actividad de requisito, Actividad de tarea, Adjunto | REQ, TAR, ARC | initial |
| INV-16 | Una asignación semanal va del lunes al viernes de su semana, y las semanas anteriores a la semana en curso no se modifican | Asignación semanal | ASG | initial |
| INV-17 | Cada clave de configuración del sistema existe una sola vez | Configuración del sistema | ARC, NOT, HOR, ASG | initial |
| INV-18 | Cada usuario corresponde a una identidad del proveedor de identidad: su id es el `sub` de esa identidad | Usuario | ACC, CON | initial |
