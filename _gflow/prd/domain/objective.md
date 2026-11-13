---
entity: Tarea
tables: [objectives, people_objectives]
describes: Unidad de trabajo interna de un proyecto, con responsables, estado, área y prioridad; puede desglosar un requisito
---

# Tarea

## Atributos
| Atributo | Tipo | Obligatorio | Restricciones | Dato personal | Origen |
|---|---|---|---|---|---|
| título | texto | sí | hasta 255 caracteres | no | inicial |
| descripción | texto | no | admite vacío | no | inicial |
| fecha estimada de finalización | fecha | no | se guarda como texto `YYYY-MM-DD` | no | inicial |
| estado | enum | sí | `backlog`, `activo`, `en_revision`, `finalizado`, `cancelado`; default `backlog`; la base de producción lo admite nulo y sin default | no | inicial |
| área | enum | sí | `diseño`, `desarrollo`, `gestion`, `investigacion`; al crear, `desarrollo` si no viene | no | inicial |
| prioridad | número | sí | 0 a 5: 0 `sin_prioridad`, 1 `baja`, 2 `media`, 3 `alta`, 4 `urgente`; el 5 se lee como `urgente` | no | inicial |
| visibilidad | enum | sí | `public`, `internal`; default `public` | no | inicial |
| proyecto | referencia | sí | Proyecto existente; no cambia después del alta (INV-04) | no | inicial |
| creador | referencia | sí | Usuario que la creó | no | inicial |
| requisito | referencia | no | Requisito del mismo proyecto (INV-05) | no | inicial |
| responsables | referencia | sí | lista ordenada de Persona existentes, sin repetidos (INV-10); puede ser vacía; el primero es el líder (INV-11) | no | inicial |

## Atributos derivados
| Atributo | Regla de cálculo | Origen |
|---|---|---|
| finalizada en | instante en que la edición la pasa a `finalizado`; se limpia cuando la edición la saca de `finalizado`; una tarea dada de alta en `finalizado` no lo tiene | inicial |

## Relaciones
- Una Tarea pertenece a 1 Proyecto.
- Una Tarea fue creada por 1 Usuario.
- Una Tarea desglosa 0..1 Requisito.
- Una Tarea tiene 0..n Persona como responsables (tabla `people_objectives`, con marca de líder).
- Una Tarea tiene 0..n Actividad de tarea, 0..n Suscripción a tarea y 0..n Hora trabajada.
- Una Tarea tiene 0..n Adjunto (tipo de entidad `objective`).

## Baja
Nunca: no hay borrado de tareas; `cancelado` es el estado de baja lógica. Si se borrara una fila a mano, la base borra en cascada sus responsables y suscripciones, y deja sin tarea a sus horas trabajadas.

## Estados
| Estado | Tipo | Significado | Origen |
|---|---|---|---|
| backlog | inicial | pendiente, sin empezar | inicial |
| activo | intermedio | en curso | inicial |
| en_revision | intermedio | en revisión | inicial |
| finalizado | final | terminada; fija la fecha de finalización | inicial |
| cancelado | final | descartada; baja lógica | inicial |

## Transiciones
| Desde | Hacia | Disparado por | Origen |
|---|---|---|---|
| (alta) | cualquiera | TAR-01, TAR-02 | inicial |
| cualquiera | cualquiera | TAR-05, TAR-06, TAR-08 | inicial |
| cualquiera salvo finalizado | finalizado | TAR-06 | inicial |
| finalizado | cualquiera salvo finalizado | TAR-06 | inicial |
