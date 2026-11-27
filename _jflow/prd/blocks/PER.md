---
prefix: PER
name: Personas
surfaces: [Gestor interno]
covers: Consulta de las personas del equipo habilitadas, su vínculo con el usuario del proveedor de identidad y las personas asignadas a un proyecto
entities: [Persona, Usuario, Proyecto]
last_requirement: PER-05
last_failure: PER-E4
---

# PER — Personas

## Requirements
| ID | Requirement | Actor | Origin |
|---|---|---|---|
| PER-01 | El gestor obtiene la lista de personas habilitadas, con todos sus datos (nombre, apellido, habilitada, fechas de ingreso y egreso, si debe cargar horas, usuario vinculado), y la usa como selector de responsables y filtro por persona en requisitos, tareas, carga de horas y búsqueda de documentación. La lectura no pide rol: cualquier identidad autenticada la obtiene | U-01, U-02 | initial |
| PER-02 | Una persona puede estar vinculada a un usuario del proveedor de identidad (su `sub`). El gestor reconoce a la persona de quien ingresó comparando ese vínculo con el `sub` del token de acceso | — | initial |
| PER-03 | Las personas asignadas a un proyecto se pueden pedir con id, nombre y apellido; exige rol `user` o `admin` | U-01, U-02 | initial |
| PER-04 | Las personas, su habilitación y su asignación a proyectos no se crean, editan ni eliminan desde el producto: ninguna pantalla, operación de la api ni comando las escribe | — | initial |
| PER-05 | Una persona sin usuario vinculado no es de ningún usuario: ninguna identidad la reconoce como propia | — | initial |

## Failure conditions
| ID | Condition | Result | Origin |
|---|---|---|---|
| PER-E1 | Personas de un proyecto pedidas sin rol `user` ni `admin` | 403 `access_denied` «Access denied» | initial |
| PER-E2 | Personas de un proyecto que no existe | 404 `project_not_found` «Project not found» | initial |
| PER-E3 | Personas de un proyecto con un id no numérico | 500 `internal_error` «Internal server error» | initial |
| PER-E4 | Falla la lectura de la base al listar personas | 500 `internal_error` «Internal error» | initial |
