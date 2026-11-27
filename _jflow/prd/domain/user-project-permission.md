---
entity: Permiso de proyecto
tables: [user_project_permissions]
describes: Habilitación de un usuario sobre un proyecto; es lo que decide qué proyectos ve un usuario de cliente en el portal
---

# Permiso de proyecto

## Attributes
| Attribute | Type | Required | Constraints | Personal data | Origin |
|---|---|---|---|---|---|
| usuario | referencia | sí | a Usuario | no | initial |
| proyecto | referencia | sí | a Proyecto | no | initial |

## Relationships
- Un Permiso de proyecto une 1 Usuario con 1 Proyecto; un par usuario-proyecto tiene a lo sumo un permiso.

## Removal
El producto no crea ni elimina permisos: se cargan por fuera de él, directamente en la base. Se eliminan en cascada si se borra el Usuario o el Proyecto.
