---
entity: Permiso de proyecto
tables: [user_project_permissions]
describes: Acceso explícito de un usuario (en la práctica, un cliente) a un proyecto
---

# Permiso de proyecto

## Atributos
| Atributo | Tipo | Obligatorio | Restricciones | Dato personal | Origen |
|---|---|---|---|---|---|
| usuario | referencia | sí | Usuario | no | inicial |
| proyecto | referencia | sí | Proyecto; obligatorio en la base de producción | no | inicial |

## Relaciones
- Un Permiso de proyecto une 1 Usuario con 1 Proyecto; a lo sumo uno por par (INV-02).
- Un Usuario tiene 0..n Permiso de proyecto; un Proyecto tiene 0..n Permiso de proyecto.

## Baja
Fuera del producto: ningún comando ni ruta crea, modifica ni borra permisos; se administran directamente en la base. Se borran en cascada con el usuario o el proyecto.
