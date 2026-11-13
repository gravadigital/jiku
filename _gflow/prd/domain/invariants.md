# Invariantes

| ID | Regla | Entidades | Aplicada en | Origen |
|---|---|---|---|---|
| INV-01 | Un requisito pertenece siempre a un proyecto existente, y ese proyecto no cambia después del alta | Requisito, Proyecto | REQ | inicial |
| INV-02 | Un usuario tiene a lo sumo un permiso sobre cada proyecto | Permiso de proyecto, Usuario, Proyecto | PRY | inicial |
| INV-03 | Un usuario está suscripto a lo sumo una vez a cada requisito | Suscripción a requisito, Usuario, Requisito | SUS | inicial |
| INV-04 | Una tarea pertenece siempre a un proyecto existente, y ese proyecto no cambia después del alta | Tarea, Proyecto | TAR | inicial |
| INV-05 | Una tarea vinculada a un requisito pertenece al mismo proyecto que el requisito | Tarea, Requisito | TAR | inicial |
| INV-06 | Una hora trabajada imputada a un requisito tiene el mismo proyecto que el requisito | Hora trabajada, Requisito | HOR | inicial |
| INV-07 | Una hora trabajada se imputa a una tarea o a un requisito, nunca a los dos | Hora trabajada, Tarea, Requisito | HOR | inicial |
| INV-08 | Las horas trabajadas de una persona en un mismo día no suman más que el tope diario | Hora trabajada, Persona | HOR | inicial |
| INV-09 | Una ausencia se registra solo si, con ella, las horas trabajadas y las ausencias de la persona en ese día no suman más que el tope diario | Ausencia, Hora trabajada, Persona | HOR | inicial |
| INV-10 | Una persona figura a lo sumo una vez entre los responsables de un requisito y a lo sumo una vez entre los de una tarea | Requisito, Tarea, Persona | REQ, TAR | inicial |
| INV-11 | Un requisito o una tarea con responsables tiene exactamente un responsable líder: el primero de la lista asignada | Requisito, Tarea, Persona | REQ, TAR | inicial |
| INV-12 | La clave de almacenamiento de un archivo es única | Archivo | ADJ | inicial |
| INV-13 | Todo adjunto referencia un archivo existente y una entidad; un archivo con adjuntos no se puede borrar | Adjunto, Archivo | ADJ | inicial |
| INV-14 | Todo archivo con al menos un adjunto tiene sus bytes marcados como subidos | Archivo, Adjunto | ADJ | inicial |
| INV-15 | Un archivo se vincula a una entidad solo por el usuario que lo subió y solo mientras su retención está activa | Adjunto, Archivo, Usuario | ADJ | inicial |
| INV-16 | Un archivo figura a lo sumo una vez entre los adjuntos de una misma entidad | Adjunto, Archivo | ADJ | inicial |
| INV-17 | El identificador de tickets de un proyecto, cuando existe, es único entre proyectos | Proyecto | PRY | inicial |
| INV-18 | La clave de un ajuste del sistema es única | Ajuste del sistema | ADJ | inicial |
| INV-19 | Toda notificación pendiente corresponde a un cambio confirmado: se encola en la misma transacción que el cambio que la origina, y no existe si el cambio se revierte | Notificación pendiente, Requisito | NOT | inicial |
| INV-20 | Una asignación semanal va del lunes al viernes de una misma semana | Asignación semanal | ASI | inicial |
| INV-21 | Cada usuario corresponde a una única identidad del proveedor de identidad: su identificador es el `sub` de esa identidad y hay a lo sumo una fila por identidad | Usuario | ACC | inicial |
