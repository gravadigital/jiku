---
prefix: POR
name: Portal de clientes
surfaces: [Portal de clientes]
covers: Lo que un usuario de cliente y un miembro del equipo hacen en el portal sobre los requisitos públicos de los proyectos a los que acceden - listarlos por estado, ver el detalle, crearlos, comentarlos, suscribirse y cambiar estado y prioridad
entities: [Proyecto, Permiso de proyecto, Requisito, Actividad de requisito, Usuario, Archivo, Adjunto]
last_requirement: POR-17
last_failure: POR-E17
---

# POR — Portal de clientes

## Requirements
| ID | Requirement | Actor | Origin |
|---|---|---|---|
| POR-01 | Un usuario de cliente ve los proyectos en estado `activo` sobre los que tiene permiso; al entrar a «Proyectos» se lo lleva al primero en orden alfabético, en vista de lista | U-03 | initial |
| POR-02 | Un miembro del equipo (rol `user`) ve todos los proyectos en estado `activo`, sin necesidad de permiso sobre ellos, y accede a sus requisitos públicos | U-02 | initial |
| POR-03 | La barra lateral lista los proyectos accesibles por nombre y ofrece «Nuevo requisito»; sin proyectos muestra «Todavía no tenés acceso a ningún proyecto» y «Cuando el equipo te dé acceso a un proyecto, lo vas a ver acá. Si esperabas verlo ahora, escribile a tu contacto en Grava Digital.» con «Cerrar sesión» | U-03, U-02 | initial |
| POR-04 | El tablero de un proyecto muestra sus requisitos públicos agrupados por los siete estados (Análisis, Planificación, En cola, Desarrollo, Revisión, Resuelto, Cancelado), 20 por estado con «Ver más». Se alterna entre «Lista» y «Columnas»; en columnas, Resuelto y Cancelado arrancan colapsadas. Por debajo de 768 px se muestra como acordeones por estado | U-03, U-02 | initial |
| POR-05 | Los requisitos con visibilidad `internal` nunca aparecen en el portal: no se listan y su detalle responde como inexistente | — | initial |
| POR-06 | La lista se ordena por fecha de creación ascendente. La api ordena los resueltos por fecha de finalización descendente solo cuando se pide un único estado como valor simple; el portal pide cada estado en forma de lista, así que ese orden no se aplica | — | initial |
| POR-07 | El detalle de un requisito (modal en escritorio, página propia en móvil o por enlace) muestra estado, tipo («Sin tipo» si no tiene), prioridad, suscriptores (nombre y email), fecha de creación, fecha de finalización si tiene, última actualización, título, descripción, creador («Elemento creado por {nombre}») y, para una `incidencia` con comentario de resolución, la «Resolución» | U-03, U-02 | initial |
| POR-08 | La actividad del detalle muestra en orden cronológico solo las entradas públicas: los comentarios públicos y los cambios públicos («{autor} cambió {Campo} de X a Y»); una identidad de servicio se marca como «Identidad automática: no es una persona». Sin entradas muestra «No hay actividad registrada» | — | initial |
| POR-09 | El detalle ofrece «Enlace» para copiar la URL del requisito («Copiado») | U-03, U-02 | initial |
| POR-10 | Crear un requisito desde el portal: título obligatorio, descripción, proyecto (por defecto el activo), prioridad (por defecto `sin_prioridad`), tipo (Funcionalidad, Mejora, Incidencia u Otro), suscriptores y archivos adjuntos. El requisito nace en `analisis` y con visibilidad `public`; al terminar muestra «Elemento creado» / «El elemento fue agregado a análisis correctamente.» | U-03, U-02 | initial |
| POR-11 | Si en el alta no se elige tipo («Sin tipo»), el requisito se guarda con tipo `otro` | — | initial |
| POR-12 | Quien crea el requisito desde el portal queda suscripto automáticamente, además de los suscriptores elegidos. Los suscriptores se eligen entre los usuarios (personas, no identidades de servicio) con permiso sobre el proyecto, ordenados por nombre | — | initial |
| POR-13 | Comentar un requisito público desde el portal, con archivos adjuntos (hasta 10). El comentario queda siempre con visibilidad `public`; un comentario vacío no se envía | U-03, U-02 | initial |
| POR-14 | Un usuario de cliente se suscribe o se desuscribe de un requisito público con «Suscribirse» / «Desuscribirse» (el botón solo se muestra a usuarios de cliente). Solo se puede suscribir a un usuario con permiso sobre el proyecto, y solo se puede desuscribir a uno mismo | U-03 | initial |
| POR-15 | La api acepta suscribir a cualquier usuario con permiso sobre el proyecto, no solo a uno mismo; la pantalla siempre suscribe al usuario de la sesión | — | initial |
| POR-16 | Un miembro del equipo (rol `user` o `admin`) cambia el estado o la prioridad de un requisito público desde la tarjeta o la fila; se avisa «Requisito actualizado correctamente» | U-02 | initial |
| POR-17 | Las escrituras del portal (crear, comentar, suscribir) verifican el permiso sobre el proyecto solo para usuarios de cliente; para el equipo no se verifica permiso. Comentar por la ruta del gestor se describe en REQ-36 | — | initial |

## Failure conditions
| ID | Condition | Result | Origin |
|---|---|---|---|
| POR-E1 | Se listan proyectos con una identidad sin rol `user` ni `external-user` (por ejemplo, solo `admin`) | 403 `access_denied` «Access denied»; la pantalla muestra «Error al cargar los proyectos» con «Reintentar» | initial |
| POR-E2 | Un usuario de cliente pide los requisitos o los usuarios de un proyecto sobre el que no tiene permiso | 403 `access_denied` «Access denied for this project.» | initial |
| POR-E3 | Se piden los requisitos o los usuarios de un proyecto que no existe | 404 `project_not_found` «Project not found» | initial |
| POR-E4 | El requisito pedido no existe o es `internal` | 404 `requirement_not_found` «Requirement not found»; la pantalla muestra «El requisito no está disponible o no tenés acceso» con «Volver al tablero» | initial |
| POR-E5 | Un usuario de cliente abre el detalle de un requisito de un proyecto sobre el que no tiene permiso | 403 `access_denied` «Access denied for this project.»; la pantalla muestra lo mismo que POR-E4 | initial |
| POR-E6 | Falla la carga del detalle por otro motivo | «Error al cargar el requisito. Intentá de nuevo más tarde.» con «Cerrar» y «Reintentar» (modal) o «Error al cargar el requisito» con «Volver al listado» y «Reintentar» (página) | initial |
| POR-E7 | Se crea un requisito sin título | La pantalla marca el campo y no envía | initial |
| POR-E8 | Se crea un requisito con descripción vacía | 400 `invalid_fields` «Invalid field - "description" is not allowed to be empty» | initial |
| POR-E9 | Se crea un requisito sin proyecto elegido o con un proyecto que no existe | 404 `project_not_found` «Project not found» | initial |
| POR-E10 | Un usuario de cliente crea un requisito en un proyecto sobre el que no tiene permiso | 403 `access_denied` «No tenés permiso sobre esta entidad»; la pantalla muestra «Sin permiso para crear el requisito» | initial |
| POR-E11 | Alguno de los suscriptores elegidos no existe | 404 `user_not_found` «User not found»; no se crea nada | initial |
| POR-E12 | Se comenta un requisito inexistente o `internal` | 404 `requirement_not_found` «Requirement not found» | initial |
| POR-E13 | Un usuario de cliente comenta un requisito de un proyecto sobre el que no tiene permiso | 403 `access_denied` «No tenés permiso sobre esta entidad»; la pantalla muestra «Sin permiso para comentar» | initial |
| POR-E14 | Un usuario de cliente intenta cambiar estado o prioridad | 403 `caller_not_authorized` «El caller no está autorizado a ejecutar este método» (la pantalla no ofrece la acción); otros errores muestran «Error al actualizar el estado» / «Error al actualizar la prioridad» | initial |
| POR-E15 | Se suscribe a un usuario que no existe, sin permiso sobre el proyecto o ya suscripto | 404 `user_not_found` «User not found» / 403 `no_permission` «User does not have permission for this project» / 400 `already_subscribed` «User is already subscribed to this requirement» | initial |
| POR-E16 | Se desuscribe a otro usuario, o a uno que no está suscripto | 403 `access_denied` «Access denied» / 404 `subscription_not_found` «Subscription not found» | initial |
| POR-E17 | La lista de requisitos recibe parámetros fuera de lo previsto: la api no los valida | Un `limit` mayor que 20 se acepta; un `sort` que no es un campo del requisito responde 500 `internal_error` «Internal server error» | initial |

## Examples
- POR-11: en «Nuevo requisito» se completa título y descripción, prioridad Alta y no se toca «Tipo»: el requisito queda con tipo `otro`, prioridad `alta`, estado `analisis` y visibilidad `public`.
- POR-12: Laura (usuaria de cliente) crea un requisito eligiendo como suscriptor a Martín: quedan suscriptos Laura y Martín.
