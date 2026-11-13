---
prefix: PRY
name: Proyectos
surfaces: [Gestión interna]
covers: Alta, edición, listado con filtros y detalle de proyectos, sus propiedades, las personas del proyecto y los permisos de proyecto, que el producto solo lee
entities: [Proyecto, Cliente, Persona, Permiso de proyecto]
last_requirement: PRY-10
last_failure: PRY-E6
---

# PRY — Proyectos

## Requisitos
| ID | Requisito | Actor | Origen |
|---|---|---|---|
| PRY-01 | Dar de alta un proyecto con nombre, código, descripción, tipo (`interno`, `comercial`, `investigacion`, `propuesta`) y fecha de inicio obligatorios, y fecha de cierre estimada, cliente y propiedades opcionales; la pantalla lo crea siempre en estado `analisis` y sin prioridad, y al guardar abre su detalle | U-01, U-02 | inicial |
| PRY-02 | Editar un proyecto: la edición exige nombre, código, estado, tipo, descripción y fecha de inicio; si no se envía la fecha de cierre, queda vacía; si no se envía el cliente, se conserva | U-01, U-02 | inicial |
| PRY-03 | Estados de un proyecto: `analisis`, `activo`, `inactivo`, `finalizado`, `cancelado`; cualquier estado se alcanza desde cualquier otro | — | inicial |
| PRY-04 | Propiedades de un proyecto: solo las claves `documentacion`, `diseño`, `board_de_tareas` (las tres deben ser URL) y `mattermost_group_name` (texto); las propiedades enviadas reemplazan todas las anteriores. El detalle muestra las no vacías, como enlace «Ver …» cuando el valor es una URL | U-01, U-02 | inicial |
| PRY-05 | Listar proyectos con su creador y su cliente, filtrables por texto (en el nombre), tipo y uno o más estados, ordenados por fecha de inicio; la pantalla arranca con el estado `activo` y elegir «Todos» mantiene el filtro en activos | U-01, U-02 | inicial |
| PRY-06 | Ver el detalle de un proyecto: información general (código, cliente, estado, creador, fechas), propiedades, descripción, sus requisitos por estado con conteo (pestaña Desarrollo por defecto), sus tareas por estado (pestaña Activo por defecto), archivos adjuntos y documentación | U-01, U-02 | inicial |
| PRY-07 | Desde el detalle de un proyecto, crear un requisito o una tarea con el proyecto ya elegido | U-01, U-02 | inicial |
| PRY-08 | Listar las personas de un proyecto (id, nombre y apellido) | U-01, U-02 | inicial |
| PRY-09 | Las personas de un proyecto y los permisos de proyecto de cada usuario se cargan fuera del producto: el producto solo los lee | — | inicial |
| PRY-10 | El proyecto de una entidad no cambia después de creada: requisitos y tareas se editan sin poder moverlos a otro proyecto | — | inicial |

## Condiciones de falla
| ID | Condición | Resultado | Origen |
|---|---|---|---|
| PRY-E1 | Alta o edición sin alguno de los campos obligatorios | 400 `invalid_fields`; la pantalla muestra el toast «Hay campos obligatorios sin completar» | inicial |
| PRY-E2 | Estado o tipo fuera de su lista, propiedad con una clave no admitida o una URL inválida en una propiedad de URL | 400 `invalid_fields` | inicial |
| PRY-E3 | El cliente indicado no existe | 400 `client_not_found` | inicial |
| PRY-E4 | Ver o editar un proyecto que no existe | 400 `project_not_found`; la pantalla de detalle queda en «Cargando...» | inicial |
| PRY-E5 | Listar las personas de un proyecto que no existe | 404 `project_not_found` | inicial |
| PRY-E6 | El alta o la edición fallan en el servidor | Toast «Hubo un error al crear el proyecto» / «Hubo un error al editar el proyecto» | inicial |
