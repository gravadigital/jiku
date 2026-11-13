---
entity: Cliente
tables: [clients]
describes: Organización para la que se trabaja (en la interfaz, "actor"); agrupa proyectos
---

# Cliente

## Atributos
| Atributo | Tipo | Obligatorio | Restricciones | Dato personal | Origen |
|---|---|---|---|---|---|
| nombre | texto | sí | hasta 255 caracteres | no | inicial |
| descripción | texto | no | admite vacío; la edición acepta borrarla | no | inicial |

## Relaciones
- Un Cliente tiene 0..n Proyecto.

## Baja
Nunca: no hay borrado ni desactivación de clientes en el producto. Si se borrara una fila a mano, sus proyectos quedan sin cliente (la referencia del proyecto pasa a nula).
