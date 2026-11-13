---
entity: Requisito
tables: [requirements, people_requirements]
describes: Pedido de trabajo sobre un proyecto, con estado, responsables, especificación y resolución; puede crearlo un cliente desde el portal
---

# Requisito

## Atributos
| Atributo | Tipo | Obligatorio | Restricciones | Dato personal | Origen |
|---|---|---|---|---|---|
| título | texto | sí | hasta 255 caracteres | no | inicial |
| descripción | texto | sí | — | no | inicial |
| tipo | enum | no | `funcionalidad`, `mejora`, `incidencia`, `otro`; sin tipo es un valor válido | no | inicial |
| prioridad | enum | sí | `sin_prioridad`, `baja`, `media`, `alta`, `urgente`; default `sin_prioridad` | no | inicial |
| estado | enum | sí | los siete de Estados; default `analisis` (lo pone core: la base de producción no tiene default) | no | inicial |
| fecha estimada de finalización | fecha | no | — | no | inicial |
| etiquetas | texto | no | lista de pares `{key, value}` (JSONB) | no | inicial |
| proyecto | referencia | sí | Proyecto existente; no cambia después del alta (INV-01) | no | inicial |
| creador | referencia | sí | Usuario que lo creó | no | inicial |
| visibilidad | enum | sí | `public` (lo ve el cliente en el portal), `internal`; default `public` | no | inicial |
| alcance | texto | no | campo de especificación | no | inicial |
| solución técnica | texto | no | campo de especificación | no | inicial |
| criterios de aceptación | texto | no | campo de especificación | no | inicial |
| tipo de resolución | enum | no | `error_interno`, `fuera_de_alcance`, `error_externo`, `discutible`, `otro` | no | inicial |
| conclusión de resolución | texto | no | — | no | inicial |
| comentario de resolución | texto | no | — | no | inicial |
| responsables | referencia | no | lista ordenada de Persona existentes, sin repetidos (INV-10); el primero es el líder (INV-11) | no | inicial |

## Atributos derivados
| Atributo | Regla de cálculo | Origen |
|---|---|---|
| planificado en | instante de la primera entrada a `planificacion` por edición; no se vuelve a escribir | inicial |
| en desarrollo desde | instante de la primera entrada a `desarrollo` por edición; no se vuelve a escribir | inicial |
| en revisión desde | instante de la primera entrada a `revision` por edición; no se vuelve a escribir | inicial |
| resuelto en | instante de la última entrada a `resuelto` (se reescribe en cada entrada); no se limpia al reabrir | inicial |
| minutos trabajados | suma de los minutos de las Hora trabajada imputadas al requisito (se calcula en las consultas) | inicial |

Las cuatro marcas de tiempo las fija la actualización del requisito; un requisito dado de alta directamente en un estado avanzado no las tiene.

## Relaciones
- Un Requisito pertenece a 1 Proyecto.
- Un Requisito fue creado por 1 Usuario.
- Un Requisito tiene 0..n Persona como responsables (tabla `people_requirements`, con marca de líder).
- Un Requisito tiene 0..n Actividad de requisito (historial y comentarios).
- Un Requisito tiene 0..n Suscripción a requisito.
- Un Requisito tiene 0..n Tarea vinculadas.
- Un Requisito recibe 0..n Hora trabajada.
- Un Requisito tiene 0..n Adjunto (tipo de entidad `requirement`).
- Un Requisito origina 0..n Notificación pendiente.

## Baja
Nunca: no hay borrado de requisitos; `cancelado` es el estado de baja lógica. Si se borrara una fila a mano, la base borra en cascada su actividad y sus suscripciones, deja sin requisito a sus tareas y horas, y rechaza el borrado si tiene responsables.

## Estados
| Estado | Tipo | Significado | Origen |
|---|---|---|---|
| analisis | inicial | recibido, en análisis | inicial |
| planificacion | intermedio | en planificación | inicial |
| en_cola | intermedio | planificado, esperando desarrollo | inicial |
| desarrollo | intermedio | en desarrollo | inicial |
| revision | intermedio | en revisión | inicial |
| resuelto | final | resuelto; guarda la resolución | inicial |
| cancelado | final | descartado; baja lógica | inicial |

## Transiciones
| Desde | Hacia | Disparado por | Origen |
|---|---|---|---|
| (alta) | cualquiera | REQ-01, REQ-02, REQ-03 | inicial |
| cualquiera | cualquiera | REQ-04, REQ-05, REQ-14, REQ-19 | inicial |
| cualquiera | resuelto | REQ-08 | inicial |
| cualquiera | resuelto | REQ-04, REQ-07, REQ-15 | inicial |
| resuelto | cualquiera salvo cancelado | REQ-09, REQ-15 | inicial |
