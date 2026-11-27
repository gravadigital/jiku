---
entity: Usuario
tables: [users]
describes: Espejo local de una identidad del proveedor de identidad (persona o servicio), con sus roles; es quien actúa
---

# Usuario

## Attributes
| Attribute | Type | Required | Constraints | Personal data | Origin |
|---|---|---|---|---|---|
| identificador | texto | sí | el identificador (sub) que asigna el proveedor de identidad; hasta 100 caracteres; único | no | initial |
| nombre | texto | sí | hasta 255 caracteres | sí | initial |
| nombre de usuario | texto | sí | hasta 255 caracteres | sí | initial |
| email | email | no | obligatorio para una identidad de tipo persona (lo exige el consumidor del evento de autenticación, no la base); nulo para una identidad de servicio | sí | initial |
| roles | lista de textos | sí | por omisión vacía; se guardan tal como vienen del proveedor, sin validarlos contra un catálogo | no | initial |
| tipo de identidad | enum | sí | person, service; por omisión person | no | initial |

## Relationships
- Un Usuario es 0..1 Persona.
- Un Usuario tiene 0..N Permisos de proyecto.
- Un Usuario está suscripto a 0..N Requisitos (y, en la tabla legada, a 0..N Tareas).
- Un Usuario crea 0..N Proyectos, Requisitos, Tareas, actividades y Archivos, y es destinatario de 0..N Notificaciones pendientes.

## Removal
Nunca: el producto no elimina usuarios. Se crean y se actualizan como espejo del proveedor de identidad: cada evento de autenticación reemplaza nombre, nombre de usuario, email, roles y tipo de identidad; el sobre de identidad de un comando completa la fila si falta. Un usuario sin fila no pasa las compuertas del bus.
