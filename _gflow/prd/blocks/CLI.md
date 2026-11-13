---
prefix: CLI
name: Clientes (actores)
surfaces: [Gestión interna]
covers: Alta, edición, listado con filtros y detalle de los clientes (en pantalla, «Actores») y de sus proyectos
entities: [Cliente, Proyecto]
last_requirement: CLI-07
last_failure: CLI-E5
---

# CLI — Clientes (actores)

## Requisitos
| ID | Requisito | Actor | Origen |
|---|---|---|---|
| CLI-01 | Dar de alta un cliente con nombre obligatorio y descripción opcional en markdown; al guardar se vuelve al listado | U-01, U-02 | inicial |
| CLI-02 | Editar el nombre y la descripción de un cliente; se cambian solo los campos enviados y la descripción se puede vaciar | U-01, U-02 | inicial |
| CLI-03 | Listar todos los clientes, cada uno con todos sus proyectos, ordenados por nombre y sin paginar; la pantalla los muestra de a 10 con «Ver más» (el primer lote depende de la altura de la ventana) | U-01, U-02 | inicial |
| CLI-04 | El estado de un cliente es derivado: «Activo» si alguno de sus proyectos está activo o en análisis, «Inactivo» si no | — | inicial |
| CLI-05 | Filtrar el listado por texto (nombre o descripción, sin distinguir mayúsculas) y por estado, y ordenarlo por activos primero (A-Z), más recientes, más antiguos o nombre (A-Z o Z-A); los filtros quedan en la URL | U-01, U-02 | inicial |
| CLI-06 | Ver un cliente desplegado: su descripción y sus proyectos ordenados por fecha de inicio descendente | U-01, U-02 | inicial |
| CLI-07 | Listar los proyectos de un cliente, filtrables por uno o más estados y paginados | U-01, U-02 | inicial |

## Condiciones de falla
| ID | Condición | Resultado | Origen |
|---|---|---|---|
| CLI-E1 | Alta o edición sin nombre | 400 `invalid_fields`; la pantalla muestra «El nombre es obligatorio» | inicial |
| CLI-E2 | Guardar el formulario sin haber cambiado nada | La pantalla muestra «No hay cambios para guardar» y no envía nada | inicial |
| CLI-E3 | Ver o editar un cliente que no existe | 400 `client_not_found`; la pantalla de edición queda en «Cargando...» | inicial |
| CLI-E4 | Listar los proyectos de un cliente que no existe | 404 `client_not_found` | inicial |
| CLI-E5 | El alta o la edición fallan en el servidor | Toast con el mensaje del error, o «Hubo un error al crear el actor» / «Hubo un error al editar el actor» | inicial |
