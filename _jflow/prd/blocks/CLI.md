---
prefix: CLI
name: Clientes
surfaces: [Gestor interno]
covers: Listado, alta y edición de clientes («actores» en el gestor), su estado derivado de sus proyectos y la consulta de sus proyectos
entities: [Cliente, Proyecto]
last_requirement: CLI-13
last_failure: CLI-E14
---

# CLI — Clientes

## Requirements
| ID | Requirement | Actor | Origin |
|---|---|---|---|
| CLI-01 | El gestor muestra a los clientes como «Actores». La pantalla «Actores» lista todos los clientes con sus proyectos, con la acción «Nuevo actor» | U-01, U-02 | initial |
| CLI-02 | El estado de un actor no se guarda: es «Activo» si tiene al menos un proyecto en estado `activo` o `analisis`, e «Inactivo» si no | — | initial |
| CLI-03 | La lista se filtra por búsqueda («Buscar actor»: el texto aparece en el nombre o en la descripción, sin distinguir mayúsculas), por estado (Todos, Activo, Inactivo) y se ordena por «Activos primero (A-Z)» (por defecto: activos primero y después por nombre), «Más recientes», «Más antiguos», «Nombre (A-Z)» o «Nombre (Z-A)». Filtro y orden se aplican en el navegador sobre la lista completa | U-01, U-02 | initial |
| CLI-04 | La lista muestra de entrada tantos actores como entran en la pantalla, con un mínimo de 10, y «Ver más» agrega 10 por vez. Sin resultados muestra «No hay actores que coincidan con estos filtros.» (con filtros) o «Todavía no hay actores.» con «Nuevo actor» (sin filtros) | U-01, U-02 | initial |
| CLI-05 | Al expandir un actor se ven su descripción (con formato markdown) y sus proyectos, del más reciente al más antiguo por fecha de inicio, o «No hay proyectos asociados.» | U-01, U-02 | initial |
| CLI-06 | «Crear actor» pide nombre (obligatorio) y descripción (opcional, admite markdown). Guarda ambos sin espacios en los extremos, muestra «Actor creado con éxito» y vuelve a «Actores» | U-01, U-02 | initial |
| CLI-07 | «Editar actor» (lápiz de cada actor) carga nombre y descripción y guarda con «Guardar cambios»; solo envía si algo cambió. Muestra «Actor actualizado con éxito» y vuelve a «Actores» | U-01, U-02 | initial |
| CLI-08 | La edición es parcial: un campo ausente queda como estaba. La descripción puede vaciarse; el nombre no admite quedar nulo | — | initial |
| CLI-09 | El listado de clientes trae todos los clientes, ordenados por nombre, cada uno con sus proyectos completos; el detalle de un cliente trae el cliente con sus proyectos. Ninguna de las dos lecturas pide rol: cualquier identidad autenticada las obtiene | U-01, U-02 | initial |
| CLI-10 | Los proyectos de un cliente se pueden pedir filtrando por uno o varios estados de proyecto separados por coma, con página y límite de hasta 30 por página; sin límite trae hasta 200. Exige rol `user` o `admin` | U-01, U-02 | initial |
| CLI-11 | Crear y editar clientes lo pueden hacer las identidades con rol `admin` o `user`; la api no chequea el rol y es core quien lo decide con los roles de la persona | U-01, U-02 | initial |
| CLI-12 | El alta responde 201 con el cliente creado; la edición responde 200 `client_updated` «Client Updated» | U-01, U-02 | initial |
| CLI-13 | Los clientes no se dan de baja: no existe una operación para eliminarlos | — | initial |

## Failure conditions
| ID | Condition | Result | Origin |
|---|---|---|---|
| CLI-E1 | «Crear actor» o «Guardar cambios» sin haber cambiado nada | «No hay cambios para guardar» | initial |
| CLI-E2 | «Crear actor» o «Editar actor» con el nombre vacío | «El nombre es obligatorio» | initial |
| CLI-E3 | Alta sin nombre, o alta o edición con un campo que no es nombre ni descripción | 400 `invalid_fields` «Invalid field - {mensaje de validación}» | initial |
| CLI-E4 | Detalle de un cliente que no existe | 400 `client_not_found` «Client not found» | initial |
| CLI-E5 | Detalle o edición de un cliente con un id no numérico | 500 `internal_error` «Internal error» | initial |
| CLI-E6 | Edición de un cliente que no existe | 400 `client_not_found` «Client not found» | initial |
| CLI-E7 | Alta o edición pedida por una identidad sin rol `admin` ni `user` (por ejemplo, `external-user` o sin roles) | 403 `caller_not_authorized` «El caller no está autorizado a ejecutar este método» | initial |
| CLI-E8 | Proyectos de un cliente pedidos sin rol `user` ni `admin` | 403 `access_denied` «Access denied» | initial |
| CLI-E9 | Proyectos de un cliente con un id que no es entero | 400 `invalid_fields` «Invalid field - clientId must be an integer» | initial |
| CLI-E10 | Proyectos de un cliente que no existe | 404 `client_not_found` «Client not found» | initial |
| CLI-E11 | Alta o edición sin respuesta de core: nadie atiende el comando, o la respuesta no llega a tiempo | 503 `service_unavailable` «El servicio no está disponible en este momento» (no se hizo); 504 `gateway_timeout` «La operación tardó demasiado» (pudo haberse hecho) | initial |
| CLI-E12 | La api rechaza el alta o la edición | Aviso con el mensaje del error o, sin mensaje, «Hubo un error al crear el actor» / «Hubo un error al editar el actor» | initial |
| CLI-E13 | Falla la lectura del actor al abrir «Editar actor» | La pantalla queda en «Cargando...» sin salir | initial |
| CLI-E14 | Falla inesperada al leer los clientes o sus proyectos, o al ejecutar el alta o la edición en core (por ejemplo, la base no responde) | 500 `internal_error` «Internal error» | initial |

## Examples
- CLI-02: un actor con un proyecto `finalizado` y otro `analisis` es «Activo»; uno con proyectos `inactivo` y `cancelado`, o sin proyectos, es «Inactivo».
- CLI-03: con «Activos primero (A-Z)», «Zeta» (activo) aparece antes que «Alfa» (inactivo).
