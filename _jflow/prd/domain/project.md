---
entity: Proyecto
tables: [projects, projects_persons, project_status_updates]
describes: Trabajo que el equipo hace para un cliente o para sí mismo; agrupa requisitos, tareas, horas y asignaciones
---

# Proyecto

## Attributes
| Attribute | Type | Required | Constraints | Personal data | Origin |
|---|---|---|---|---|---|
| código | texto | sí | obligatorio al crear; hasta 255 caracteres; la base lo admite nulo (filas heredadas) | no | initial |
| nombre | texto | sí | obligatorio al crear; hasta 255 caracteres; la base lo admite nulo (filas heredadas) | no | initial |
| tipo | enum | sí | comercial, interno, investigacion, propuesta; por omisión comercial | no | initial |
| estado | enum | sí | analisis, activo, inactivo, finalizado, cancelado; por omisión analisis; la base lo admite nulo | no | initial |
| descripción | texto | no | admite vacío | no | initial |
| fecha de inicio | fecha y hora | sí | por omisión, el momento de la creación | no | initial |
| fecha de fin | fecha y hora | no | — | no | initial |
| cliente | referencia | no | a Cliente | no | initial |
| propiedades | lista de pares código/valor | no | códigos admitidos: documentacion, diseño, board_de_tareas, mattermost_group_name; los tres primeros deben ser una URI o vacío | no | initial |
| creado por | referencia | sí | a Usuario; quien lo crea | no | initial |
| prioridad | número | no | por omisión 0; ningún comando la escribe | no | initial |
| origen | referencia | no | a la tabla legada origins, sin clave foránea; ningún comando lo escribe | no | initial |
| slug de tickets | texto | no | único cuando tiene valor; legado de la función de correo eliminada; ningún comando lo escribe y los contratos no lo exponen | no | initial |
| personas del proyecto | referencia | no | 0..N Personas; el producto las lee (personas de un proyecto, filtro de personas por proyecto) pero ningún comando las escribe | no | initial |
| actualizaciones de estado | lista | no | estado, fecha y comentario; tabla legada que nada lee ni escribe | no | initial |

## Relationships
- Un Proyecto pertenece a 0..1 Cliente.
- Un Proyecto tiene 0..N Requisitos, 0..N Tareas, 0..N Horas trabajadas y 0..N Asignaciones semanales.
- Un Proyecto tiene 0..N Personas (personas del proyecto) y una Persona está en 0..N Proyectos.
- Un Proyecto tiene 0..N Permisos de proyecto (los usuarios de cliente que lo ven en el portal).
- Un Proyecto tiene 0..N Adjuntos.
- Un Proyecto lo crea 1 Usuario.

## Removal
Nunca: ningún comando elimina un proyecto. Si se borrara por fuera del producto, la base elimina en cascada sus horas trabajadas, asignaciones semanales, permisos de proyecto y personas del proyecto, y rechaza el borrado si tiene requisitos; sus tareas no tienen clave foránea hacia el proyecto y quedarían huérfanas.

## States
| State | Type | Meaning | Origin |
|---|---|---|---|
| analisis | initial | En análisis; estado por omisión al crear | initial |
| activo | intermediate | En curso | initial |
| inactivo | intermediate | Pausado | initial |
| finalizado | intermediate | Terminado; no es terminal: puede volver a cualquier estado | initial |
| cancelado | intermediate | Cancelado; no es terminal: puede volver a cualquier estado | initial |

## Transitions
| From | To | Triggered by | Origin |
|---|---|---|---|
| — | cualquier estado (analisis por omisión) | PRY-06, PRY-08 | initial |
| cualquier estado | cualquier otro estado | PRY-09, PRY-11 | initial |
