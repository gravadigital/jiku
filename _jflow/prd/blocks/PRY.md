---
prefix: PRY
name: Proyectos
surfaces: [Gestor interno]
covers: Listado con filtros, alta, edición y detalle de proyectos con su cliente, estado, tipo, fechas y propiedades
entities: [Proyecto, Cliente, Usuario, Permiso de proyecto]
last_requirement: PRY-17
last_failure: PRY-E13
---

# PRY — Proyectos

## Requirements
| ID | Requirement | Actor | Origin |
|---|---|---|---|
| PRY-01 | La pantalla «Proyectos» muestra una tarjeta por proyecto (nombre, código, estado, tipo, fechas, prioridad, creador) y la acción «Nuevo proyecto». Filtra por búsqueda («Buscar proyecto»: el texto aparece en el nombre, sin distinguir mayúsculas), tipo (Todos, Interno, Comercial, Investigación, Propuesta) y estado (Todos, Activo, Análisis, Inactivo, Finalizado, Cancelado; por defecto Activo), y ordena por «Más recientes» (por defecto) o «Más antiguos» según la fecha de inicio | U-01, U-02 | initial |
| PRY-02 | Sin resultados, «Proyectos» muestra «No hay proyectos que coincidan con estos filtros.» si hay búsqueda, tipo o un estado distinto de Activo, y si no «Todavía no hay proyectos.» con «Nuevo proyecto» | U-01, U-02 | initial |
| PRY-03 | El listado de proyectos acepta búsqueda por nombre, tipo, uno o varios estados separados por coma, orden por cualquier campo (con `-` delante, descendente; por defecto, más recientes por fecha de creación), página y límite. Cada proyecto trae su creador (id, nombre, email) y su cliente (id, nombre) o nulo; las propiedades sin valor vienen como texto vacío | U-01, U-02 | initial |
| PRY-04 | El límite del listado de proyectos vale solo entre 1 y 30; sin límite el listado trae hasta 200 proyectos. El gestor no envía límite | — | initial |
| PRY-05 | El listado y el detalle de proyectos no piden rol: cualquier identidad autenticada los obtiene. El detalle trae el proyecto con su creador (id, nombre, email, tipo de identidad) y su cliente completo | U-01, U-02 | initial |
| PRY-06 | «Nuevo Proyecto» pide Nombre, Fecha de inicio, Código, Descripción y Tipo (obligatorios) y Fecha de cierre estimada, Cliente, Documentación, Board de Tareas, Diseño y pares clave/valor libres (opcionales). El proyecto nace en estado `analisis`. Al guardar muestra «Proyecto creado con éxito» y abre el detalle del proyecto | U-01, U-02 | initial |
| PRY-07 | El creador del proyecto es la persona que lo crea | — | initial |
| PRY-08 | Cuando el alta no trae estado, tipo o fecha de inicio, el proyecto nace en `analisis`, de tipo `comercial` y con la fecha de inicio del momento del alta | — | initial |
| PRY-09 | Los estados de un proyecto son `analisis`, `activo`, `inactivo`, `finalizado` y `cancelado`, y cualquiera puede pasar a cualquier otro. Los tipos son `interno`, `comercial`, `investigacion` y `propuesta` | — | initial |
| PRY-10 | Las propiedades de un proyecto son `documentacion`, `diseño` y `board_de_tareas`, que deben ser URL o quedar vacías, y `mattermost_group_name`, texto libre. Al editarlas se reemplaza el conjunto completo | — | initial |
| PRY-11 | «Editar» abre el mismo formulario con «Estado» y envía todos los campos. Muestra «Proyecto editado con éxito» y vuelve al detalle | U-01, U-02 | initial |
| PRY-12 | Al editar sin fecha de cierre estimada, la fecha de cierre queda vacía. Al quitar el cliente desde el formulario de edición, el proyecto conserva el cliente que tenía | U-01, U-02 | initial |
| PRY-13 | El detalle del proyecto muestra Descripción; Requisitos, con una pestaña por estado y su cantidad (Análisis, Planificación, En cola, Desarrollo, Revisión, Resuelto, Cancelado; abre en Desarrollo), 5 por página, responsable líder o «Sin asignar» y la acción «Nuevo requisito» en ese proyecto; Tareas, con una pestaña por estado y su cantidad (Backlog, Activo, En revisión, Finalizado, Cancelado; abre en Activo), 5 por página y la acción «Nueva tarea» en ese proyecto; Información general (Código, Cliente o «No definido», Estado, Creado por, Fecha de inicio, Fecha de cierre estimada o «No definida»); Propiedades o «Sin propiedades definidas»; Documentación y Adjuntos. Ofrece «Volver» y «Editar» | U-01, U-02 | initial |
| PRY-14 | Crear y editar proyectos lo pueden hacer las identidades con rol `admin` o `user`; la api no chequea el rol y es core quien lo decide con los roles de la persona | U-01, U-02 | initial |
| PRY-15 | El alta responde 201 con el proyecto creado; la edición responde 200 `project_updated` «Project Updated» | U-01, U-02 | initial |
| PRY-16 | Los proyectos no se dan de baja: no existe una operación para eliminarlos | — | initial |
| PRY-17 | El permiso de un usuario sobre un proyecto existe como dato y define qué proyectos ve un usuario de cliente; ninguna pantalla, operación de la api ni comando lo crea o lo quita | — | initial |

## Failure conditions
| ID | Condition | Result | Origin |
|---|---|---|---|
| PRY-E1 | «Nuevo Proyecto» o «Editar» con algún campo obligatorio vacío | «Hay campos obligatorios sin completar» | initial |
| PRY-E2 | Alta sin nombre, código, estado, tipo, descripción o fecha de inicio; edición sin alguno de esos campos; o un campo con formato inválido | 400 `invalid_fields` «Invalid field - {mensaje de validación}» | initial |
| PRY-E3 | Alta con un par clave/valor libre | 400 `invalid_fields` «Invalid field - "keyValuePairs.{clave}" is not allowed» | initial |
| PRY-E4 | Edición con un par clave/valor libre, con una propiedad de URL que no es URL, o con un estado o tipo fuera de la lista | 400 `invalid_fields` con el mensaje de validación de core | initial |
| PRY-E5 | Alta o edición con un cliente que no existe | 400 `client_not_found` «Client not found» | initial |
| PRY-E6 | Detalle o edición de un proyecto que no existe | 400 `project_not_found` «Project not found» | initial |
| PRY-E7 | Listado con un tipo fuera de la lista o un límite fuera de 1 a 30 | 400 `invalid_fields` «Invalid field - {mensaje de validación}» | initial |
| PRY-E8 | Listado ordenado por un campo que no existe, o detalle o edición con un id no numérico | 500 `internal_error` «Internal error» | initial |
| PRY-E9 | Alta o edición pedida por una identidad sin rol `admin` ni `user` (por ejemplo, `external-user` o sin roles) | 403 `caller_not_authorized` «El caller no está autorizado a ejecutar este método» | initial |
| PRY-E10 | Alta o edición sin respuesta de core: nadie atiende el comando, o la respuesta no llega a tiempo | 503 `service_unavailable` «El servicio no está disponible en este momento» (no se hizo); 504 `gateway_timeout` «La operación tardó demasiado» (pudo haberse hecho) | initial |
| PRY-E11 | La api rechaza el alta o la edición | «Hubo un error al crear el proyecto» / «Hubo un error al editar el proyecto»; el listado que falla muestra el mensaje del error | initial |
| PRY-E12 | Falla la lectura del proyecto al abrir el detalle | La pantalla queda en «Cargando...» sin salir | initial |
| PRY-E13 | Falla inesperada al leer los proyectos, o al ejecutar el alta o la edición en core (por ejemplo, la base no responde) | 500 `internal_error` «Internal error» | initial |

## Examples
- PRY-04: `limit=20` trae hasta 20 proyectos; sin `limit`, hasta 200; `limit=50` responde 400.
- PRY-12: un proyecto con cliente «ACME» editado con el campo Cliente vacío sigue con «ACME»; editado sin fecha de cierre estimada, queda «No definida».
