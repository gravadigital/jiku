---
entity: Suscripción a tarea
tables: [objectives_subscriptors]
describes: Un usuario suscripto a una tarea; solo se lee
---

# Suscripción a tarea

## Atributos
| Atributo | Tipo | Obligatorio | Restricciones | Dato personal | Origen |
|---|---|---|---|---|---|
| tarea | referencia | sí | Tarea | no | inicial |
| usuario | referencia | sí | Usuario | no | inicial |

## Relaciones
- Una Suscripción a tarea une 1 Usuario con 1 Tarea.
- Una Tarea tiene 0..n Suscripción a tarea; un Usuario tiene 0..n Suscripción a tarea.

## Baja
Fuera del producto: ningún comando crea ni borra suscripciones a tareas; solo se consultan. Se borran en cascada con la tarea o el usuario.
