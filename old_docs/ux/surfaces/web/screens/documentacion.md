---
name: documentacion
surface: web
route: /docs
viewports:
  - desktop
audiences:
  - equipo-interno
fidelity: mid
status: diseñada
version: "2.1"
date: 2026-10-26
---

# Pantalla: Documentación

## Identidad

- **Audiencia primaria:** [equipo-interno](../../../audiences/equipo-interno/research-context.md) — busca un documento que sabe que existe, mira qué hay escrito de un proyecto, un cliente o un tema, o clasifica lo que quedó sin proyecto.
- **JTBD / Propósito:** encontrar documentación desde **un solo buscador** que suma filtros (proyecto, cliente, tema, persona, texto, "Sin proyecto/cliente/tema"), sin carpetas ni rutas, y asignarle proyecto a lo que no lo tiene [REQ-021 RF-1 a RF-8].
- **Viewports:**
  - **desktop** — único viewport de la superficie (lo impone el shell, ver `product-overview.md`).
  - Tablet: se comporta como desktop.

**Una ruta, cinco vistas.** Las pantallas 01 a 05 de la propuesta B no son rutas aparte sino estados de `/docs` según los filtros de la URL: *inicio* (sin filtros), *sugerencias abiertas* (escribiendo), *resultados* (con filtros o texto), *filtrado desde una ficha* (proyecto, requisito o tarea con `origen`) y *sin proyecto* [REQ-021 Supuestos "Pantallas 04 y 05"].

## Entrada y salida

**Entradas:**
- Sidebar · ítem **"Documentación"** (solo existe con el módulo instalado) [REQ-016 RF-23, CA-25]
- `detalle-proyecto` · `boton-ver-todos-documentos` → `/docs?proyecto={id}&origen=proyecto` [REQ-021 RF-7, CA-7]
- `detalle-requisito` / `detalle-tarea` · `boton-ver-todos-documentos` → `/docs?requisito={id}&origen=requisito` · `/docs?tarea={id}&origen=tarea` [REQ-021 Diseño de la web, "Cards de Documentación"]
- `documento` · primer nivel de `breadcrumb-documento` (`"Documentación"`)
- URL compartida: los filtros viven en los query params (`proyecto`, `cliente`, `tema`, `persona`, `q`, `requisito`, `tarea`, `sinProyecto`, `sinCliente`, `sinTema`, `publico`, `orden`, `pagina`, `origen`), así que la vista se recarga y se comparte igual

**Salidas user-driven:**
- A `documento` (`/docs/{id}`) · click en una fila de `tabla-documentos`
- A `detalle-proyecto` / `detalle-requisito` / `detalle-tarea` · `boton-volver-origen` (armado con el id del filtro, nunca con una URL de la query)
- A O-11 Nuevo documento · `boton-nuevo-documento`
- A O-07 Menú de selección · `boton-asignar-proyecto` de una fila (abre `selector-proyecto-fila`)

**Salidas automáticas:**
- Ninguna. Con el módulo `not_installed` la ruta responde el 404 de la superficie: no hay pantalla que mostrar ni ítem que lleve hasta acá.

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Categoría | Viewports | Visibilidad | Propósito |
|---|--------|------|---------------------|-----------|-----------|-------------|-----------|
| 1 | titulo-documentacion | heading | h1 | content | desktop | — | Título de la vista; cambia con el filtro de origen y con "Sin proyecto" (`ViewHeader`) |
| 2 | subtitulo-sin-proyecto | paragraph | caption | content | desktop | visible_only_in_states: sin proyecto | Explica qué son y para qué asignarlos |
| 3 | boton-volver-origen | button | secondary-nav | navigation | desktop | visible_only_in_states: filtrado desde una ficha | Vuelve a la ficha de la que se vino |
| 4 | boton-nuevo-documento | button | primary / disabled | input | desktop | state_overrides: módulo no disponible→disabled | Abre O-11; desde una ficha filtrada, con esas relaciones precargadas |
| 5 | buscador-documentos | search-bar | default / focused / disabled | input | desktop | state_overrides: módulo no disponible→disabled | Un solo campo: suma filtros como tokens y texto con Enter |
| 6 | tokens-filtro | chips | removibles | input | desktop | oculto sin filtros | Los filtros activos, dentro del buscador, cada uno con su × |
| 7 | lista-sugerencias | list | agrupada | input | desktop | visible_only_in_states: sugerencias abiertas | Sugerencias agrupadas con la coincidencia resaltada |
| 8 | ayuda-teclado | paragraph | caption | content | desktop | hidden_in_states: módulo no disponible | Cómo se suman y se quitan filtros |
| 9 | filtro-visible-cliente | toggle | ToggleGroup segmentado | input | desktop | state_overrides: módulo no disponible→disabled | Limita a documentos `public`, fuera del buscador |
| 10 | orden-documentos | toggle | ToggleGroup segmentado | input | desktop | hidden_in_states: módulo no disponible | Orden de la lista |
| 11 | tabla-documentos | table | light | content | desktop | hidden_in_states: loading, empty, sin resultados, módulo no disponible, error de sistema / sin conexión | Documentos: agrupados en *inicio*, conteo y paginado en el resto |
| 12 | temas-documento | chips | — | content | desktop | solo en filas con temas | Temas como pills, junto al título |
| 13 | marca-visibilidad | badge | public / restricted | content | desktop | solo en filas `public` o `restricted` | Señala lo que llega al cliente y lo restringido |
| 14 | marca-en-edicion | badge | — | content | desktop | solo en filas con lock vigente | Avisa que alguien lo está editando ahora |
| 15 | fragmento-coincidencia | paragraph | caption | content | desktop | visible_only_in_states: resultados (con texto) | Dónde aparece el texto buscado |
| 16 | sugerencia-proyecto | label | — | content | desktop | visible_only_in_states: sin proyecto; solo en filas con candidato | Proyecto que propone el módulo |
| 17 | boton-asignar-sugerido | button | tertiary / disabled | input | desktop | visible_only_in_states: sin proyecto; solo en filas con candidato; state_overrides: asignando→disabled | Asigna el proyecto sugerido |
| 18 | boton-asignar-proyecto | button | tertiary / disabled | input | desktop | visible_only_in_states: sin proyecto; solo en filas sin candidato; state_overrides: asignando→disabled | Abre el selector de proyecto de la fila |
| 19 | selector-proyecto-fila | dropdown | Select searchable | input | desktop | visible solo tras pulsar boton-asignar-proyecto en esa fila | Elegir el proyecto a asignar |
| 20 | paginacion-documentos | pagination | sin total / con total | navigation | desktop | hidden_in_states: inicio, loading, empty, sin resultados, módulo no disponible | Anterior / Siguiente |
| 21 | vacio-inicio | empty-state | list | feedback | desktop | visible_only_in_states: empty | Todavía no hay documentos |
| 22 | vacio-busqueda | empty-state | filtered | feedback | desktop | visible_only_in_states: sin resultados | Ningún documento cumple los filtros |
| 23 | cargando-documentos | loader | block | feedback | desktop | visible_only_in_states: loading | Carga de la lista |
| 24 | aviso-no-disponible | alert | warning | feedback | desktop | visible_only_in_states: módulo no disponible | El módulo está registrado pero no responde |
| 25 | aviso-error | alert | error | feedback | desktop | visible_only_in_states: error de sistema / sin conexión | Fallo de una consulta, con el módulo disponible |
| 26 | toast-asignacion | toast | success / warning / error | feedback | desktop | visible solo tras asignar | Resultado de asignar un proyecto |

`buscador-documentos`, `tokens-filtro` y `lista-sugerencias` son **un solo control** para quien lo usa —un combobox con tokens— y se declaran por separado porque cada uno tiene su microcopy y su visibilidad. Ver Decisiones.

## Layout por viewport

### desktop · 1440px

- row `encabezado` (`space-between`)
  - col 9/12: titulo-documentacion, subtitulo-sin-proyecto *(solo sin proyecto)*
  - col 3/12: boton-volver-origen *(solo desde una ficha)*, boton-nuevo-documento *(alineados a la derecha; primario último)*
- buscador-documentos *(ancho completo; tokens-filtro dentro del campo, a la izquierda del texto)*
  - lista-sugerencias *(desplegada bajo el campo, mismo ancho, por encima del contenido)*
- row `opciones` (`space-between`)
  - col 6/12: ayuda-teclado
  - col 6/12: filtro-visible-cliente, orden-documentos *(alineados a la derecha)*
- aviso-no-disponible · aviso-error *(a lo sumo uno, ancho completo)*
- row `contenido` (card `panel`)
  - col 12/12: tabla-documentos *(temas-documento, marca-visibilidad y marca-en-edicion en la celda del título; fragmento-coincidencia debajo del título; sugerencia-proyecto, boton-asignar-sugerido, boton-asignar-proyecto y selector-proyecto-fila en la última columna en sin proyecto)* · vacio-inicio · vacio-busqueda · cargando-documentos
  - paginacion-documentos *(pie de la card)*

## Contenido

### titulo-documentacion
- Texto/label: `"Documentación"` · filtrado desde una ficha: `"Documentos · {nombre del proyecto}"` (o `"Documentos · {título del requisito}"`, `"Documentos · {título de la tarea}"`) · con "Sin proyecto": `"Sin proyecto"`
- Icono: nada
- Asset: nada
- Annotation: `ViewHeader` sin breadcrumb propio. El breadcrumb de la topbar no se toca [REQ-021 decisión 1]

### subtitulo-sin-proyecto
- Texto/label: `"Documentos que todavía no están vinculados a un proyecto. Asignarlos hace que aparezcan en los filtros y en el detalle de cada proyecto."`
- Icono: nada
- Asset: nada
- Annotation: aparece con el filtro "Sin proyecto" activo, sea que se llegó tipeando "sin" o con un link

### boton-volver-origen
- Texto/label: `"Volver al proyecto"` · `"Volver al requisito"` · `"Volver a la tarea"`
- Icono: arrow-left
- Asset: nada
- Annotation: `Button` `secondary-nav`. Aparece cuando la URL trae `origen` **y** el filtro de esa entidad sigue activo; si la persona quita ese token, el botón desaparece y el título vuelve a `"Documentación"`. El destino se arma con el id del token (`/projects/{id}`, `/requirements/{id}`, `/tasks/{id}`), no con una URL de la query (sin redirect abierto) [REQ-021 Diseño de la web]

### boton-nuevo-documento
- Texto/label: `"Nuevo documento"`
- Icono: plus
- Asset: nada
- Annotation: siempre visible: ya no depende de una carpeta ni de un permiso por carpeta (toda persona interna escribe lo que ve) [REQ-021 RF-9]. Filtrado desde una ficha, O-11 abre con ese proyecto (y su cliente), requisito o tarea precargados

### buscador-documentos
- Texto/label: placeholder sin filtros `"Buscá texto o escribí un proyecto, cliente, tema o persona"` · con filtros `"Sumar otro filtro o texto"`; botón de limpiar todo con nombre accesible `"Quitar todos los filtros"`
- Icono: search
- Asset: nada
- Annotation: combobox. Con 1 carácter o más abre lista-sugerencias (debounce 200 ms). **Enter** sin sugerencia marcada suma el texto como token de búsqueda; **flechas** recorren las sugerencias y Enter elige; **Esc** cierra la lista sin borrar lo escrito; **Backspace** con el campo vacío quita el último token. Los filtros se combinan con Y; dos proyectos (o dos clientes, dos temas) se combinan con O [REQ-021 RF-2, CA-3 a CA-5]

### tokens-filtro
- Texto/label: `"Proyecto {nombre}"` · `"Cliente {nombre}"` · `"Tema {tema}"` · `"Persona {nombre}"` · `"Requisito {título}"` · `"Tarea {título}"` · texto `"“{texto}”"` · `"Sin proyecto"` · `"Sin cliente"` · `"Sin tema"`. Cada uno con × y nombre accesible `"Quitar filtro {etiqueta}"`
- Icono: x (en cada token)
- Asset: nada
- Annotation: el token de texto se distingue de los de entidad (sin prefijo, entre comillas). Un id que la base no conoce se muestra como `#id`. Al recargar, los nombres se resuelven con lo que la web ya consulta (proyecto, cliente, personas, requisito, tarea). "Persona" filtra lo **creado o editado por última vez** por esa persona

### lista-sugerencias
- Texto/label: primera fila siempre `"Buscar «{texto}» en títulos y contenido"`; luego grupos `"Proyectos"` (`"{nombre}"` con `"{cliente}"` al lado; los míos primero), `"Clientes"`, `"Personas"`, `"Temas"` (`"{tema}"` con `"{n} documentos"`). Si el texto empieza con "sin": `"Sin proyecto"` · `"Sin cliente"` · `"Sin tema"`. Sin coincidencias en ningún grupo: solo la fila de buscar texto
- Icono: search (fila de texto) · folder (proyecto) · users (cliente) · user (persona) · filter (tema)
- Asset: nada
- Annotation: la parte que coincide va resaltada en cada sugerencia. Con un token de cliente activo, los proyectos se limitan a ese cliente. Hasta 5 por grupo. Los temas se buscan **por prefijo** ("vid" encuentra "video", no "pedido-video") — limitación del módulo [REQ-021 RF-3, CA-2, CA-6]

### ayuda-teclado
- Texto/label: `"Elegí una sugerencia para sumarla como filtro · Enter agrega el texto escrito · ⌫ quita el último filtro"` · en sin proyecto: `"Escribí «sin» para encontrar Sin proyecto, Sin cliente o Sin tema · ⌫ quita el último filtro"`
- Icono: nada
- Asset: nada
- Annotation: `Enter` y `⌫` se muestran como teclas (`kbd`)

### filtro-visible-cliente
- Texto/label: opciones `"Todos"` · `"Visibles para el cliente"`; default `"Todos"`
- Icono: eye (en la segunda opción)
- Asset: nada
- Annotation: `ToggleGroup` segmentado en lugar de una casilla (el DS de `web` no tiene checkbox). Manda `visibility=public`; viaja en la URL como `publico=1` [REQ-021 RF-4]

### orden-documentos
- Texto/label: listados `"Más recientes"` · `"A–Z"`; con token de texto `"Relevancia"` · `"Más recientes"`
- Icono: nada
- Asset: nada
- Annotation: `ToggleGroup` segmentado. Default `"Más recientes"` en listados y `"Relevancia"` con texto. Viaja en la URL (`orden`)

### tabla-documentos
- Texto/label: columnas `"Documento"` · `"Cliente · Proyecto"` · `"Actualizado"` · `"Editado por"`. En *inicio*, dos grupos con su fila de encabezado: `"En mis proyectos activos"` (hasta 5) y `"Editados recientemente"` (20). En *resultados*, el encabezado de la primera columna lleva el conteo: `"Documento · {n} de {total}"` (`"50+"` si la búsqueda de texto llegó al tope). En *filtrado desde un proyecto*, `"Cliente · Proyecto"` se reemplaza por `"Temas"` y los temas salen de la celda del título. En *sin proyecto*: `"Documento"` · `"Cliente"` · `"Actualizado"` · acción. Sin cliente ni proyecto: `"Sin cliente · Sin proyecto"`. Sin fecha: `"—"`. "Editado por" sin nombre: `"—"`
- Icono: nada (icono `file` dentro de la celda del título)
- Asset: nada
- Annotation: `Table` `light`. Fila entera clickeable y enfocable (`<a>` en el título). "Cliente · Proyecto" muestra el primero de cada lista con `#id` de respaldo. Fecha `DD/MM/AAAA` en mono. "Editado por" usa el nombre que manda el servicio (`updatedByName`); si es la persona actual (reconocida por su identidad de acceso, no por su id de Jiku), `"vos"` [REQ-021 RF-5, RF-6, RF-15; REQ-022 RF-7, CA-9]. "Cliente · Proyecto" muestra el cliente propio del documento cuando lo tiene; no se infiere del proyecto [REQ-022 RF-6, CA-7]. **No hay columna de ruta en ninguna vista** [RF-1]. Si "En mis proyectos activos" no tiene documentos, el grupo no se muestra

### temas-documento
- Texto/label: un pill por tema, con el texto del tema
- Icono: nada
- Asset: nada
- Annotation: `Badge` `outline`. Hasta 3 y `"+{n}"`; sin temas, nada en la fila (en la tabla de proyecto, la columna dice `"Sin tema"`)

### marca-visibilidad
- Texto/label: `"Visible para el cliente"` (`public`) · `"Restringido"` (`restricted`)
- Icono: eye · lock
- Asset: nada
- Annotation: `Badge` `outline`. `internal` es el caso común y no lleva marca

### marca-en-edicion
- Texto/label: `"En edición"`
- Icono: lock
- Asset: nada
- Annotation: `Badge` neutro. Nombre accesible `"{lock.holderName} lo está editando"` (`"Otra persona lo está editando"` solo si el servicio no manda nombre); si la reserva es de la persona actual, `"Lo estás editando"` [REQ-022 RF-7, CA-8]. Informa, no bloquea

### fragmento-coincidencia
- Texto/label: el fragmento que devuelve el módulo, con la coincidencia resaltada
- Icono: nada
- Asset: nada
- Annotation: se resalta, nunca se interpreta como HTML

### sugerencia-proyecto
- Texto/label: `"Sugerido: {nombre del proyecto}"`
- Icono: nada
- Asset: nada
- Annotation: debajo del título de la fila. El motivo que da el módulo (`reason`) va como texto de ayuda accesible (`aria-describedby`), no solo en un `title` de hover. Se pide por fila visible, con caché de 5 min; si falla, la fila ofrece "Asignar proyecto" [REQ-021 RF-8, CA-11]

### boton-asignar-sugerido
- Texto/label: `"Asignar sugerido"`
- Icono: nada
- Asset: nada
- Annotation: asigna el proyecto de sugerencia-proyecto. Solo agrega la relación: el contenido no cambia fuera del bloque `jiku:`; el servicio suma el cliente del proyecto [REQ-021 decisión 6, CA-10]

### boton-asignar-proyecto
- Texto/label: `"Asignar proyecto"`
- Icono: nada
- Asset: nada
- Annotation: reemplaza el botón por selector-proyecto-fila en la misma celda

### selector-proyecto-fila
- Texto/label: placeholder `"Buscar proyecto…"`; sin resultados `"Sin resultados"`
- Icono: search
- Asset: nada
- Annotation: `Select` `single` `searchable` (opciones de la api), abierto al aparecer. Elegir aplica la asignación; `Esc` o perder el foco vuelve al botón sin asignar. Es el mismo selector de proyecto que O-11

### paginacion-documentos
- Texto/label: `"Anterior"` · `"Siguiente"`, con `"Página {n} de {total}"` cuando hay total
- Icono: chevron-left · chevron-right
- Asset: nada
- Annotation: `Pagination` sin «primera» ni «última». Listados: 20 por página, cursor del servicio y total con `count=true`. Búsqueda de texto: hasta 50 resultados paginados en memoria

### vacio-inicio
- Texto/label: `"Todavía no hay documentos."` · `"Creá el primero con «Nuevo documento»."`
- Icono: file
- Asset: nada
- Annotation: `EmptyState` `list`

### vacio-busqueda
- Texto/label: `"Ningún documento cumple estos filtros."` · `"Quitá alguno o probá con otras palabras."` · en sin proyecto: `"Todos los documentos tienen proyecto."`
- Icono: search
- Asset: nada
- Annotation: `EmptyState` `filtered` — invita a cambiar los filtros, no a crear

### cargando-documentos
- Texto/label: `"Cargando documentación…"`
- Icono: nada
- Asset: nada
- Annotation: `Loader` `block` dentro del panel; el encabezado y el buscador quedan visibles y operables

### aviso-no-disponible
- Texto/label: `"La documentación no está disponible en este momento. Probá de nuevo en unos minutos."`
- Icono: warning
- Asset: nada
- Annotation: la web vuelve a consultar el estado del módulo cada 60 s; cuando vuelve a `available` el aviso desaparece y la lista se carga sola [REQ-016 RF-17, REQ-021 CA-26]

### aviso-error
- Texto/label: `"No se pudo cargar la documentación. Actualizá la página."` · en búsqueda: `"No se pudo buscar. Intentá de nuevo."`
- Icono: error
- Asset: nada
- Annotation: `role="alert"`

### toast-asignacion
- Texto/label: éxito `"Asignaste «{proyecto}» a «{documento}»."` · conflicto `"El documento cambió; se actualizó la fila."` · en edición `"{lock.holderName} lo está editando; probá en unos minutos."` · proyecto inválido `"Ese proyecto no se puede asignar."` · error `"No se pudo asignar el proyecto. Intentá de nuevo."`
- Icono: nada
- Asset: nada
- Annotation: tras el éxito la fila sale de la lista "Sin proyecto" [REQ-021 CA-10, CA-12]

## Estados

### default
- Aplica: Sí (*inicio*, pantalla 01)
- Mensaje: —
- Cambios: sin filtros. tabla-documentos agrupada en "En mis proyectos activos" y "Editados recientemente"; paginacion-documentos oculta [REQ-021 RF-5, CA-1]

### empty
- Aplica: Sí
- Mensaje: `"Todavía no hay documentos."`
- Cambios:
  - tabla-documentos: oculta
  - vacio-inicio: visible

### loading
- Aplica: Sí
- Mensaje: `"Cargando documentación…"`
- Cambios:
  - cargando-documentos: visible en el lugar de la tabla
  - buscador-documentos y tokens-filtro: visibles y operables

### error de validación
- Aplica: No — el buscador no valida; la validación del alta vive en O-11.

### error de sistema / sin conexión
- Aplica: Sí
- Mensaje: `"No se pudo cargar la documentación. Actualizá la página."`
- Cambios:
  - aviso-error: visible
  - tabla-documentos: oculta

### success
- Aplica: Sí (asignación)
- Mensaje: `"Asignaste «{proyecto}» a «{documento}»."`
- Cambios:
  - toast-asignacion: variant=success
  - la fila sale de la lista

### not found
- Aplica: No — un filtro con un id que no existe muestra el token como `#id` y una lista vacía; con el módulo `not_installed` la ruta entera responde el 404 de la superficie.

### estado terminal / readonly
- Aplica: No — toda persona interna escribe lo que ve; no hay vista de solo lectura.

### sugerencias abiertas (parent_state: default)
- Aplica: Sí (pantalla 02) [REQ-021 RF-3, CA-2]
- Mensaje: —
- Cambios:
  - lista-sugerencias: visible bajo el buscador
  - el contenido debajo queda igual (la lista se superpone)

### resultados (parent_state: default)
- Aplica: Sí (pantalla 03) [REQ-021 RF-6, CA-3, CA-4]
- Mensaje: —
- Cambios:
  - tokens-filtro: visible
  - tabla-documentos: sin grupos, con conteo en el encabezado
  - fragmento-coincidencia: visible si hay token de texto
  - orden-documentos: `"Relevancia"` · `"Más recientes"` si hay token de texto
  - paginacion-documentos: visible

### sin resultados (parent_state: resultados)
- Aplica: Sí
- Mensaje: `"Ningún documento cumple estos filtros."`
- Cambios:
  - vacio-busqueda: visible
  - tabla-documentos y paginacion-documentos: ocultas

### filtrado desde una ficha (parent_state: resultados)
- Aplica: Sí (pantalla 04) [REQ-021 RF-7, CA-7]
- Mensaje: —
- Cambios:
  - titulo-documentacion: content=`"Documentos · {nombre}"`
  - boton-volver-origen: visible
  - tabla-documentos: columna `"Temas"` en lugar de `"Cliente · Proyecto"` (con proyecto)
  - boton-nuevo-documento: abre O-11 con las relaciones del filtro precargadas

### sin proyecto (parent_state: resultados)
- Aplica: Sí (pantalla 05) [REQ-021 RF-8, CA-10, CA-11]
- Mensaje: `"Documentos que todavía no están vinculados a un proyecto…"`
- Cambios:
  - titulo-documentacion: content=`"Sin proyecto"`
  - subtitulo-sin-proyecto: visible
  - tabla-documentos: columnas Documento · Cliente · Actualizado · acción
  - sugerencia-proyecto y boton-asignar-sugerido: visibles en filas con candidato; boton-asignar-proyecto en el resto

### asignando (parent_state: sin proyecto)
- Aplica: Sí
- Mensaje: —
- Cambios:
  - boton-asignar-sugerido / boton-asignar-proyecto de esa fila: disabled con `Loader` `inline`
  - ante `version_conflict`: toast-asignacion variant=warning y la fila se recarga [CA-12]

### módulo no disponible (parent_state: default)
- Aplica: Sí [REQ-016 RF-23, CA-27; REQ-021 CA-26]
- Mensaje: `"La documentación no está disponible en este momento. Probá de nuevo en unos minutos."`
- Cambios:
  - aviso-no-disponible: visible
  - buscador-documentos, filtro-visible-cliente y boton-nuevo-documento: disabled
  - tabla-documentos: oculta

## Interacciones

**Eventos:**
- buscador-documentos · on input (≥ 1 carácter, debounce 200 ms) → pide sugerencias (con el cliente elegido, si lo hay) → *sugerencias abiertas*
- lista-sugerencias · flechas → mueven la sugerencia marcada; Enter / click → suma el token, limpia el texto y actualiza la URL → *resultados*
- buscador-documentos · Enter sin sugerencia marcada → suma el token de texto → *resultados*
- buscador-documentos · Backspace con el campo vacío → quita el último token
- buscador-documentos · Esc → cierra lista-sugerencias
- tokens-filtro · click en × → quita ese token; sin tokens vuelve a *inicio*
- filtro-visible-cliente · on change → suma o quita `publico=1`
- orden-documentos · on change → reordena (vuelve a la página 1)
- fila de tabla-documentos · on click / Enter → navega a `/docs/{id}`
- boton-volver-origen · on click → navega a la ficha del token de origen
- boton-nuevo-documento · on click → abre O-11 (con relaciones precargadas si hay origen)
- boton-asignar-sugerido · on click → asigna el proyecto sugerido (con la versión de la fila) → *asignando* → *success*
- boton-asignar-proyecto · on click → muestra selector-proyecto-fila; elegir → *asignando* → *success*
- paginacion-documentos · Anterior / Siguiente → cambia de página (en la URL)

**Validaciones:**
- buscador-documentos · el token de texto pide 2 caracteres o más (lo exige la búsqueda); con 1, Enter no suma nada y la lista de sugerencias sigue abierta

**Feedback:**
- Una respuesta `module_unavailable` en cualquier consulta lleva la pantalla a *módulo no disponible* sin esperar el próximo sondeo [REQ-016 RF-17]
- El cambio de lista se anuncia en una región live: `"{n} documentos"` / `"Sin resultados"`

## Accesibilidad

- **Orden de foco:** boton-volver-origen → boton-nuevo-documento → buscador-documentos (tokens-filtro antes del campo, cada × enfocable) → filtro-visible-cliente → orden-documentos → filas de tabla-documentos (y su acción en sin proyecto) → paginacion-documentos.
- **Landmarks y jerarquía:** `main` con un único h1; los grupos de *inicio* son encabezados de fila de la tabla (`th scope="rowgroup"`), no h2.
- **Foco y teclado:** buscador-documentos es un `combobox` con `aria-expanded`, `aria-controls` hacia lista-sugerencias (`listbox` con grupos `group` + `aria-label`) y `aria-activedescendant` en la sugerencia marcada; el foco **no** sale del campo al recorrer sugerencias. Al quitar un token con su ×, el foco vuelve al campo.
- **Propio de esta composición:** el resaltado de la coincidencia no puede ser solo color: va en `<mark>`. Sumar o quitar un token se anuncia (`"Filtro {etiqueta} agregado"` / `"quitado"`).

## Decisiones y descartes

### REQ-022 — Arreglos e2e de la documentación sin carpetas (2026-10-26)

**Decisiones tomadas:**
- **La fila reconoce la reserva propia.** `marca-en-edicion` dice `"Lo estás editando"` cuando la reserva es de la persona actual, con el mismo criterio de identidad que el documento [REQ-022 JIKU-WEB-4, CA-8].
- **"Cliente · Proyecto" refleja las relaciones reales del documento.** El "Sin cliente · EXO - Videoconferencia" de la e2e era un documento guardado sin cliente por el defecto del alta, no un error de la etiqueta; la etiqueta no se cambia y no infiere el cliente del proyecto [REQ-022 Diagnóstico 2, CA-7].

**Alternativas descartadas:**
- Mostrar el cliente del proyecto cuando el documento no tiene cliente propio: escondería documentos mal clasificados.

**Preguntas abiertas:**
- Ninguna.

### REQ-021 — Documentación sin carpetas (propuesta B) (2026-10-26)

**Decisiones tomadas:**
- **Una ruta con estados, no cinco pantallas.** 01 a 05 son la misma lista con distintos filtros; separarlas en rutas haría que "Sin proyecto" + un cliente no tuviera dónde vivir. Todo el estado está en la URL, así que "Ver todos" de una ficha es un link y la vista se recarga y se comparte [REQ-021 Supuestos].
- **Sin carpetas, sin ruta, sin vistas guardadas, sin ⌘K.** Decisiones 1 a 3 del dueño. Se quitaron `breadcrumb-carpeta`, `tabla-carpeta`, `resultados-busqueda` (se funde en `tabla-documentos`) y `boton-ver-mas` (la lista ahora tiene total y usa `Pagination`).
- **El buscador con tokens se arma en la feature, no en el DS.** Es un combobox con tokens y sugerencias agrupadas que hoy se usa en una sola pantalla; se compone con piezas del DS (`Input` `search`, chips con la anatomía de `Select` `multiple`, el menú de `Select` y sus reglas de teclado). Queda anotado como candidato si aparece un segundo uso.
- **"Solo visibles para el cliente" es un `ToggleGroup` y no una casilla.** El DS de `web` no tiene checkbox; el segmentado es el control existente para una elección binaria siempre visible (mismo criterio que O-12 en REQ-016).
- **"Asignar proyecto" se resuelve en la fila, con el `Select` searchable, sin overlay propio.** La acción es elegir un valor; un diálogo agregaría un paso y taparía la lista que se está clasificando.
- **La sugerencia se pide por fila visible, como mucho 20 por página.** Pedirla bajo demanda escondería el atajo que justifica la vista; el costo se acota con caché de 5 min [REQ-021 Riesgos].
- **"Persona" es "creado o editado por última vez por".** El servicio no filtra por autor de cualquier versión; el token lo dice en su ayuda accesible para no prometer más.
- **"Editado por" con el nombre del servicio.** La web deja de resolver ids contra las personas de Jiku, que producía `"Otra persona"` para servicios y agentes [REQ-021 decisión 9, RF-15].

**Alternativas descartadas:**
- Fila "Vistas:" y botón "Vistas" de la maqueta: decisión 3 del dueño.
- "Ver todos" en los grupos de *inicio*: no hay un filtro que los represente sin inventar uno ("mis proyectos activos" no es un token); los grupos son una puerta de entrada, no un listado.
- Lista controlada de temas y "Proponer tema nuevo": decisión 4 (temas libres).

**Preguntas abiertas:**
- ¿"En mis proyectos activos" debería poder abrirse como lista completa? Hoy muestra los 5 más recientes y no hay token que la represente.

### REQ-016 — Módulo opcional de documentación (2026-10-24)

Navegación por carpetas con breadcrumb + tabla, búsqueda global, alta solo en carpetas con permiso y paginación con "Ver más". **Reemplazado por REQ-021**: el servicio 1.3.0 genera la ubicación sola y la carpeta deja de decidir permisos.
