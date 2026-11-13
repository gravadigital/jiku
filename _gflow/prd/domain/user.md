---
entity: Usuario
tables: [users]
describes: Espejo local de una identidad del proveedor de identidad (persona o servicio), con sus roles
---

# Usuario

## Atributos
| Atributo | Tipo | Obligatorio | Restricciones | Dato personal | Origen |
|---|---|---|---|---|---|
| identificador | texto | sí | el `sub` de la identidad en Zitadel, hasta 100 caracteres; no cambia (INV-21) | sí | inicial |
| nombre | texto | sí | — | sí | inicial |
| nombre de usuario | texto | sí | — | sí | inicial |
| email | email | no | obligatorio para las personas (lo exige core al espejar); nulo para una identidad de servicio | sí | inicial |
| roles | texto | sí | lista de roles del proveedor (`admin`, `user`, `external-user`, `internal-app`, …); default lista vacía; se reemplaza con cada espejado | no | inicial |
| tipo de identidad | enum | sí | `person`, `service`; default `person` | no | inicial |

## Relaciones
- Un Usuario se vincula con 0..1 Persona.
- Un Usuario crea 0..n Proyecto, Requisito, Tarea y Actividad de requisito o de tarea.
- Un Usuario tiene 0..n Permiso de proyecto, Suscripción a requisito y Suscripción a tarea.
- Un Usuario sube 0..n Archivo.
- Un Usuario es destinatario de 0..n Notificación pendiente.

## Baja
Nunca: el espejo crea o actualiza la fila con cada evento de autenticación y con cada comando que trae la identidad del actor, y nunca la borra. Una baja en el proveedor de identidad no se refleja.
