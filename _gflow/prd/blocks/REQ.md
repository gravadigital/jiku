---
prefix: REQ
name: Requisitos
surfaces: [Gestión interna, Portal de clientes]
covers: Alta interna y desde el portal, edición, estados libres, fechas de etapa, resolución y reapertura, responsables, etiquetas, visibilidad, campos de especificación, listado y detalle internos, y el tablero y el detalle del portal
entities: [Requisito, Proyecto, Persona, Actividad de requisito]
last_requirement: REQ-22
last_failure: REQ-E12
---

# REQ — Requisitos

## Requisitos
| ID | Requisito | Actor | Origen |
|---|---|---|---|
| REQ-01 | Dar de alta un requisito desde Gestión interna con título, descripción (contexto, markdown) y proyecto (en análisis o activo) obligatorios, y opcionalmente tipo (`funcionalidad`, `mejora`, `incidencia`, `otro` o sin tipo), prioridad (`sin_prioridad` por defecto, `baja`, `media`, `alta`, `urgente`), visibilidad (pública por defecto), responsables, fecha de finalización estimada, etiquetas y archivos; la pantalla lo crea siempre en `analisis` y al guardar vuelve al listado | U-01, U-02 | inicial |
| REQ-02 | El alta también acepta un estado inicial cualquiera, suscriptores y los campos de especificación (alcance, propuesta técnica, criterios de aceptación); el estado inicial se guarda tal cual, sin registrar fechas de etapa ni aplicar la regla de resolución | — | inicial |
| REQ-03 | Dar de alta un requisito desde el Portal de clientes («Nuevo requisito») con título y descripción obligatorios, proyecto entre los del usuario, prioridad, tipo (si no se elige se envía `otro`), suscriptores entre los usuarios del proyecto y archivos; se crea en `analisis`, público, con quien lo crea siempre suscripto, y el modal se cierra con «Elemento creado / El elemento fue agregado a análisis correctamente.» | U-03, U-02 | inicial |
| REQ-04 | Editar un requisito desde Gestión interna: título, descripción, tipo, prioridad, estado, visibilidad, responsables, fecha estimada, etiquetas, alcance, propuesta técnica, criterios de aceptación, datos de resolución y archivos; se cambian solo los campos enviados | U-01, U-02 | inicial |
| REQ-05 | Estados de un requisito: `analisis`, `planificacion`, `en_cola`, `desarrollo`, `revision`, `resuelto`, `cancelado`; cualquier estado se alcanza desde cualquier otro, por las dos superficies, y `resuelto` y `cancelado` no son finales | — | inicial |
| REQ-06 | Al entrar por primera vez a `planificacion`, `desarrollo` y `revision` se registra la fecha de esa etapa (solo la primera vez); cada entrada a `resuelto` registra de nuevo la fecha de finalización, que no se borra al reabrir | — | inicial |
| REQ-07 | Resolver un requisito de tipo `incidencia` exige un tipo de resolución (`error_interno`, `fuera_de_alcance`, `error_externo`, `discutible`, `otro`) y una conclusión, del pedido o ya guardados; la regla se evalúa con el tipo de requisito guardado antes de la edición | — | inicial |
| REQ-08 | Resolver un requisito en un solo paso (por el bus): pasa a `resuelto` con tipo de resolución obligatorio, conclusión y comentario; si ya estaba resuelto, solo actualiza los datos de resolución | U-04 | inicial |
| REQ-09 | Reabrir: salir de `resuelto` hacia cualquier estado menos `cancelado` borra el tipo, la conclusión y el comentario de resolución, salvo los que vengan en el mismo pedido | — | inicial |
| REQ-10 | Responsables de un requisito: una lista de personas cuya primera es el líder; editarla reemplaza la lista completa | U-01, U-02 | inicial |
| REQ-11 | Etiquetas de un requisito: pares clave-valor; al cargarlas se ofrecen como sugerencia los pares ya usados en el proyecto, filtrables por clave. En el detalle una etiqueta se quita y se guarda en el acto; se agregan desde la edición | U-01, U-02 | inicial |
| REQ-12 | Listar requisitos con filtros por proyecto, estados (por defecto `planificacion`, `en_cola`, `desarrollo` y `revision`), tipo, prioridad, creador, fecha estimada, etiqueta (`clave:valor`) y texto; con conteo total, responsables (líder primero) y minutos trabajados; siempre ordenados por creación descendente; paginado de 15, 20 o 25 por página con los filtros en la URL | U-01, U-02 | inicial |
| REQ-13 | Ver el detalle interno de un requisito: título, estado, tipo y prioridad editables en el lugar, contexto, panel del estado, tareas vinculadas por estado, actividad y comentarios, información general (proyecto, líder, responsables, visibilidad, creador, fechas), horas trabajadas por persona, etiquetas, resolución y documentación | U-01, U-02 | inicial |
| REQ-14 | El panel del estado explica la etapa actual, permite editar alcance, propuesta técnica, criterios de aceptación y cierre estimado, y sugiere el paso siguiente («Pasar a …») según la secuencia `analisis` → `planificacion` → `en_cola` → `desarrollo` → `revision` (para una incidencia, de `planificacion` a `desarrollo`; desde `resuelto` o `cancelado`, a `desarrollo`); la sugerencia no restringe ninguna transición | U-01, U-02 | inicial |
| REQ-15 | La tarjeta de resolución permite cancelar (pasa a `cancelado`), resolver con los datos de resolución (solo una incidencia los pide) y reabrir (vuelve a `desarrollo`) | U-01, U-02 | inicial |
| REQ-16 | Un requisito de visibilidad interna no aparece en el Portal de clientes ni en las consultas de un Cliente | — | inicial |
| REQ-17 | El tablero del Portal de clientes muestra los requisitos públicos de un proyecto agrupados por los siete estados, en lista, en columnas o, en móvil, en acordeones; carga **tamaño de página del portal** por estado y las columnas y acordeones piden más con «Ver más», mientras la lista muestra solo la primera página de cada estado; `resuelto`, `cancelado` y los grupos vacíos arrancan colapsados, y los resueltos se ordenan por fecha de finalización descendente | U-03, U-02 | inicial |
| REQ-18 | Ver el detalle de un requisito público en el portal, en un modal o en su propia página: estado, tipo, prioridad, suscriptores, fechas de creación, finalización y última actualización, título, descripción, nota de resolución para el cliente (si es una incidencia), creador, actividad pública y documentación; con «Enlace» que copia el link del requisito | U-03, U-02 | inicial |
| REQ-19 | En el portal, un Miembro del equipo cambia el estado o la prioridad de un requisito público desde la lista o las columnas; a un Cliente core le rechaza ese cambio | U-02 | inicial |
| REQ-20 | Al crear o cambiar un requisito desde el portal, la respuesta trae el requisito completo, incluidos alcance, propuesta técnica, criterios de aceptación, etiquetas y datos de resolución | — | inicial |
| REQ-21 | Desde el detalle interno de un requisito, crear tareas ya vinculadas a él y a su proyecto | U-01, U-02 | inicial |
| REQ-22 | Los formularios internos de alta y edición de requisitos no muestran los errores de validación: con título, contexto o proyecto vacíos en el alta, o título vacío en la edición, guardar no hace nada visible; la edición no valida el contexto | U-01, U-02 | inicial |

## Condiciones de falla
| ID | Condición | Resultado | Origen |
|---|---|---|---|
| REQ-E1 | Alta sin título, descripción o proyecto, o con tipo, prioridad, estado o visibilidad fuera de su lista | 400 `invalid_fields` | inicial |
| REQ-E2 | El proyecto indicado en el alta no existe | 404 `project_not_found` | inicial |
| REQ-E3 | Un responsable no existe, o la lista repite una persona | 400 `invalid_responsible_person` («Responsible person does not exist») | inicial |
| REQ-E4 | Un suscriptor indicado en el alta no existe | 404 `user_not_found` | inicial |
| REQ-E5 | Ver, editar o resolver un requisito que no existe | 404 `requirement_not_found` | inicial |
| REQ-E6 | Resolver una incidencia sin tipo de resolución o sin conclusión | 400 `resolution_required` («Se requiere tipo y conclusión para resolver un requisito») | inicial |
| REQ-E7 | Un filtro de estado fuera de la lista, o un límite de página fuera de 1 a 100 | 400 `invalid_fields` | inicial |
| REQ-E8 | En el portal, el requisito es interno o no existe | 404 `requirement_not_found`; la pantalla muestra «El requisito no está disponible o no tenés acceso» con «Volver al tablero» | inicial |
| REQ-E9 | En el portal, un Cliente pide un proyecto donde no tiene permiso | 403 `access_denied` | inicial |
| REQ-E10 | En el portal, falla el cambio de estado o de prioridad | Toast «Error al actualizar el estado» / «Error al actualizar la prioridad» | inicial |
| REQ-E11 | En el portal, el alta es rechazada por permiso | La pantalla muestra «Sin permiso para crear el requisito» | inicial |
| REQ-E12 | En el portal, se piden los requisitos de un proyecto que no existe | 404 `project_not_found` | inicial |
