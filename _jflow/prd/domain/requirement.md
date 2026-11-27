---
entity: Requisito
tables: [requirements, people_requirements, requirement_subscriptors]
describes: Pedido sobre un proyecto (funcionalidad, mejora, incidencia u otro), con su ciclo de estados, responsables, suscriptores y resolución
---

# Requisito

## Attributes
| Attribute | Type | Required | Constraints | Personal data | Origin |
|---|---|---|---|---|---|
| título | texto | sí | hasta 255 caracteres | no | initial |
| descripción | texto | sí | — | no | initial |
| proyecto | referencia | sí | a Proyecto | no | initial |
| tipo de requisito | enum | no | funcionalidad, mejora, incidencia, otro; nulo = sin tipo | no | initial |
| prioridad | enum | sí | sin_prioridad, baja, media, alta, urgente; por omisión sin_prioridad | no | initial |
| estado | enum | sí | analisis, planificacion, en_cola, desarrollo, revision, resuelto, cancelado; por omisión analisis | no | initial |
| visibilidad | enum | sí | public, internal; por omisión public | no | initial |
| fecha estimada de finalización | fecha | no | — | no | initial |
| etiquetas | lista de pares clave/valor | no | cada elemento tiene clave y valor de texto | no | initial |
| alcance | texto | no | admite vacío | no | initial |
| solución técnica | texto | no | admite vacío | no | initial |
| criterios de aceptación | texto | no | admite vacío | no | initial |
| tipo de resolución | enum | no | error_interno, fuera_de_alcance, error_externo, discutible, otro | no | initial |
| conclusión de la resolución | texto | no | — | no | initial |
| comentario de la resolución | texto | no | — | no | initial |
| creado por | referencia | sí | a Usuario | no | initial |
| responsables | referencia | no | 0..N Personas; la primera de la lista es la líder; cada edición reemplaza la lista completa | no | initial |
| suscriptores | referencia | no | 0..N Usuarios; un usuario está suscripto a lo sumo una vez | no | initial |
| fecha de planificación | fecha y hora | no | la pone el sistema la primera vez que entra a planificacion; no se reescribe | no | initial |
| fecha de inicio de desarrollo | fecha y hora | no | la pone el sistema la primera vez que entra a desarrollo; no se reescribe | no | initial |
| fecha de entrada a revisión | fecha y hora | no | la pone el sistema la primera vez que entra a revision; no se reescribe | no | initial |
| fecha de resolución | fecha y hora | no | la pone el sistema en cada entrada a resuelto; refleja la última resolución | no | initial |

## Relationships
- Un Requisito pertenece a 1 Proyecto; un Proyecto tiene 0..N Requisitos.
- Un Requisito tiene 0..N Personas responsables y 0..N Usuarios suscriptores.
- Un Requisito tiene 0..N Actividades de requisito (cambios y comentarios).
- Un Requisito tiene 0..N Tareas, del mismo proyecto.
- Un Requisito tiene 0..N Horas trabajadas imputadas.
- Un Requisito tiene 0..N Adjuntos.

## Removal
Nunca: ningún comando elimina un requisito. Si se borrara por fuera del producto, la base elimina en cascada sus actividades y suscriptores; sus tareas y horas trabajadas quedan sin requisito (la referencia pasa a nula), y rechaza el borrado si tiene responsables. Un suscriptor se quita borrando su fila.

## States
| State | Type | Meaning | Origin |
|---|---|---|---|
| analisis | initial | Recibido, en análisis; estado por omisión al crear | initial |
| planificacion | intermediate | En planificación | initial |
| en_cola | intermediate | Planificado, esperando su turno | initial |
| desarrollo | intermediate | En desarrollo | initial |
| revision | intermediate | En revisión | initial |
| resuelto | intermediate | Resuelto, con tipo de resolución; no es terminal: puede reabrirse | initial |
| cancelado | intermediate | Cancelado; no es terminal | initial |

## Transitions
| From | To | Triggered by | Origin |
|---|---|---|---|
| — | analisis, u otro estado si se indica al crear | REQ-01, REQ-02 | initial |
| — | analisis | POR-10 | initial |
| cualquier estado | cualquier otro estado | REQ-09, REQ-15, REQ-18 | initial |
| cualquier estado | cualquier otro estado | POR-16 | initial |
| cualquier estado | resuelto (con tipo de resolución; una incidencia exige además conclusión) | REQ-11, REQ-12, REQ-16 | initial |
| resuelto | cualquier estado salvo cancelado (se borran tipo, conclusión y comentario de la resolución) | REQ-13, REQ-16 | initial |
