---
entity: Tarea
tables: [objectives, people_objectives, objectives_subscriptors]
describes: Unidad de trabajo del equipo dentro de un proyecto, opcionalmente asociada a un requisito, con responsables y estado
---

# Tarea

## Attributes
| Attribute | Type | Required | Constraints | Personal data | Origin |
|---|---|---|---|---|---|
| título | texto | sí | hasta 255 caracteres | no | initial |
| descripción | texto | no | admite vacío | no | initial |
| proyecto | referencia | sí | a Proyecto; obligatorio al crear; la base lo admite nulo y no tiene clave foránea | no | initial |
| requisito | referencia | no | a Requisito; debe ser del mismo proyecto | no | initial |
| estado | enum | sí | backlog, activo, en_revision, finalizado, cancelado; por omisión backlog; la base lo admite nulo | no | initial |
| área | enum | sí | diseño, desarrollo, gestion, investigacion; por omisión desarrollo | no | initial |
| prioridad | número | sí | de 0 a 5; en el bus viaja por nombre: sin_prioridad 0, baja 1, media 2, alta 3, urgente 4 (5 se lee como urgente) | no | initial |
| visibilidad | enum | sí | public, internal; por omisión public | no | initial |
| fecha estimada de finalización | fecha | no | se guarda como texto AAAA-MM-DD | no | initial |
| fecha de finalización | fecha y hora | no | la pone el sistema al pasar a finalizado y la borra al salir de ese estado | no | initial |
| creado por | referencia | sí | a Usuario | no | initial |
| responsables | referencia | sí | 0..N Personas (la lista es obligatoria, puede ser vacía); la primera es la líder; cada edición reemplaza la lista | no | initial |
| suscriptores | referencia | no | 0..N Usuarios; tabla legada: ninguna interfaz ni comando crea suscripciones a tareas | no | initial |

## Relationships
- Una Tarea pertenece a 1 Proyecto y a 0..1 Requisito del mismo proyecto.
- Una Tarea tiene 0..N Personas responsables.
- Una Tarea tiene 0..N Actividades de tarea (cambios y comentarios).
- Una Tarea tiene 0..N Horas trabajadas imputadas.
- Una Tarea tiene 0..N Adjuntos.

## Removal
Nunca: ningún comando elimina una tarea. Si se borrara por fuera del producto, la base elimina en cascada sus responsables y suscriptores y deja sin tarea a sus horas trabajadas (referencia nula); sus actividades no tienen clave foránea y quedarían huérfanas.

## States
| State | Type | Meaning | Origin |
|---|---|---|---|
| backlog | initial | Pendiente; estado por omisión al crear | initial |
| activo | intermediate | En curso | initial |
| en_revision | intermediate | En revisión | initial |
| finalizado | intermediate | Terminada; no es terminal | initial |
| cancelado | intermediate | Cancelada; no es terminal | initial |

## Transitions
| From | To | Triggered by | Origin |
|---|---|---|---|
| — | backlog, u otro estado si se indica al crear | TAR-01 | initial |
| cualquier estado | cualquier otro estado | TAR-07, TAR-10, TAR-11, TAR-24 | initial |
