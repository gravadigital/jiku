---
entity: Cliente
tables: [clients]
describes: Organización para la que trabaja el equipo; agrupa proyectos y en la interfaz se llama «Actor»
---

# Cliente

## Attributes
| Attribute | Type | Required | Constraints | Personal data | Origin |
|---|---|---|---|---|---|
| nombre | texto | sí | hasta 255 caracteres | no | initial |
| descripción | texto | no | admite vacío | no | initial |

## Relationships
- Un Cliente tiene 0..N Proyectos; un Proyecto tiene 0..1 Cliente.

## Removal
Nunca: ningún comando elimina un cliente. Si se borrara por fuera del producto, sus Proyectos quedan sin cliente (la referencia pasa a nula).
