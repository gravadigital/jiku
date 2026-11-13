---
entity: Suscripción a requisito
tables: [requirement_subscriptors]
describes: Un usuario que recibe las notificaciones de un requisito
---

# Suscripción a requisito

## Atributos
| Atributo | Tipo | Obligatorio | Restricciones | Dato personal | Origen |
|---|---|---|---|---|---|
| requisito | referencia | sí | Requisito | no | inicial |
| usuario | referencia | sí | Usuario existente; una suscripción por usuario y requisito (INV-03) | no | inicial |

## Relaciones
- Una Suscripción a requisito une 1 Usuario con 1 Requisito.
- Un Requisito tiene 0..n Suscripción a requisito; un Usuario tiene 0..n Suscripción a requisito.

## Baja
Se elimina (borrado físico) al desuscribirse. Se borra en cascada con su requisito; un usuario con suscripciones no se puede borrar.
