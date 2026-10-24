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
version: "1.0"
date: 2026-10-24
---

# Pantalla: Documentación

## Identidad

- **Audiencia primaria:** [equipo-interno](../../../audiences/equipo-interno/research-context.md) — busca un documento que sabe que existe, o recorre las carpetas de un cliente o de un tema para ver qué hay escrito.
- **JTBD / Propósito:** encontrar un documento por texto o por su lugar en el árbol de carpetas, y crear uno nuevo dentro de una carpeta donde se tiene permiso de escritura [REQ-016 RF-12, RF-21].
- **Viewports:**
  - **desktop** — único viewport de la superficie (lo impone el shell, ver `product-overview.md`).
  - Tablet: se comporta como desktop.

## Entrada y salida

**Entradas:**
- Sidebar · ítem **"Documentación"** (solo existe con el módulo instalado) [REQ-016 RF-23, CA-25]
- `documento` · breadcrumb de la carpeta del documento → `/docs?folder={id}`
- `documento` · `boton-volver`

**Salidas user-driven:**
- A `documento` (`/docs/{id}`) · click en una fila de documento de `tabla-carpeta` o en un resultado de `resultados-busqueda`
- A la misma pantalla en otra carpeta · click en una fila de subcarpeta de `tabla-carpeta` o en un nivel de `breadcrumb-carpeta`
- A O-11 Nuevo documento · click en `boton-nuevo-documento`

**Salidas automáticas:**
- Ninguna. Con el módulo `not_installed` la ruta responde el 404 de la superficie: no hay pantalla que mostrar ni ítem que lleve hasta acá.

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Categoría | Viewports | Visibilidad | Propósito |
|---|--------|------|---------------------|-----------|-----------|-------------|-----------|
| 1 | titulo-documentacion | heading | h1 | content | desktop | — | Título de la vista (`ViewHeader`) |
| 2 | breadcrumb-carpeta | breadcrumbs | — | navigation | desktop | hidden_in_states: resultados de búsqueda, módulo no disponible | Ruta de la carpeta actual; cada nivel navega a esa carpeta |
| 3 | busqueda-documentos | search-bar | default / disabled | input | desktop | state_overrides: módulo no disponible→disabled | Búsqueda por texto completo en todo lo que la persona puede leer |
| 4 | boton-nuevo-documento | button | primary / disabled | input | desktop | visible solo si la carpeta actual tiene permiso `write` o `manage`; hidden_in_states: resultados de búsqueda; state_overrides: módulo no disponible→disabled | Abre O-11 para crear un documento en la carpeta actual |
| 5 | tabla-carpeta | table | light | content | desktop | hidden_in_states: loading, empty, resultados de búsqueda, sin resultados, módulo no disponible | Subcarpetas primero, documentos después, de la carpeta actual |
| 6 | marca-en-edicion | badge | — | content | desktop | solo en filas de documentos con lock vigente | Avisa que alguien lo está editando ahora |
| 7 | boton-ver-mas | button | secondary-dismiss | input | desktop | visible solo cuando hay más filas (cursor) | Trae la página siguiente de la carpeta o de la búsqueda |
| 8 | resultados-busqueda | table | light | content | desktop | visible_only_in_states: resultados de búsqueda | Documentos que coinciden, con el fragmento donde aparece el texto |
| 9 | vacio-carpeta | empty-state | list | feedback | desktop | visible_only_in_states: empty | Carpeta sin subcarpetas ni documentos |
| 10 | vacio-busqueda | empty-state | filtered | feedback | desktop | visible_only_in_states: sin resultados | Búsqueda sin coincidencias |
| 11 | cargando-carpeta | loader | block | feedback | desktop | visible_only_in_states: loading | Carga de la carpeta o de la búsqueda |
| 12 | aviso-no-disponible | alert | warning | feedback | desktop | visible_only_in_states: módulo no disponible | El módulo está registrado pero no responde |
| 13 | aviso-error | alert | error | feedback | desktop | visible_only_in_states: error de sistema / sin conexión | Fallo de una consulta, con el módulo disponible |

`tabla-carpeta` es **una sola tabla** para subcarpetas y documentos, y no un árbol lateral más una tabla: la navegación es por niveles, con `breadcrumb-carpeta` para subir. Ver Decisiones.

## Layout por viewport

### desktop · 1440px

- row `encabezado` (`space-between`)
  - col 8/12: titulo-documentacion, breadcrumb-carpeta
  - col 4/12: boton-nuevo-documento *(alineado a la derecha)*
- busqueda-documentos
- aviso-no-disponible *(solo si el módulo no responde)*
- aviso-error *(solo ante un fallo)*
- row `contenido` (card `panel`)
  - col 12/12: tabla-carpeta *(con marca-en-edicion en la celda del título)* · resultados-busqueda *(reemplaza a la tabla mientras hay texto buscado)* · vacio-carpeta · vacio-busqueda · cargando-carpeta · boton-ver-mas

## Contenido

### titulo-documentacion
- Texto/label: `"Documentación"`
- Icono: nada
- Asset: nada
- Annotation: `ViewHeader` sin breadcrumb propio — el breadcrumb de esta vista es el de carpetas, que vive debajo del título

### breadcrumb-carpeta
- Texto/label: `"Inicio"` como primer nivel (la raíz), luego un nivel por carpeta de la ruta, el último sin enlace
- Icono: nada
- Asset: nada
- Annotation: la carpeta actual viaja en la URL (`?folder={id}`), así que el nivel en que se está sobrevive a recargar y se puede compartir con un compañero

### busqueda-documentos
- Texto/label: placeholder `"Buscar en la documentación"`
- Icono: search
- Asset: nada
- Annotation: busca en todo lo que la persona puede leer, **no solo en la carpeta actual** — la búsqueda es la vía para cuando no se sabe dónde está algo. Debounce de 300 ms; el texto viaja en la URL (`?q=`). Vaciar el campo vuelve a la carpeta en la que se estaba

### boton-nuevo-documento
- Texto/label: `"Nuevo documento"`
- Icono: plus
- Asset: nada
- Annotation: **no se renderiza** si la carpeta actual no da `write` ni `manage` — un botón deshabilitado sin explicación invita a pedir un permiso que nadie sabe cuál es. En la raíz (`Inicio`) tampoco: un documento siempre vive en una carpeta

### tabla-carpeta
- Texto/label: columnas `"Nombre"` · `"Actualizado"` · `"Por"`. Las subcarpetas van primero, con icono de carpeta y sin fecha; los documentos después, con icono de archivo, ordenados por última actualización
- Icono: nada (los iconos de fila son `folder` y `file`, dentro de la celda)
- Asset: nada
- Annotation: fila entera clickeable y enfocable (`<a>` en la celda del nombre). `"Por"` resuelve el `updatedBy` contra las personas de Jiku; si no lo encuentra, `"Otra persona"`. Fecha `DD/MM/AAAA HH:mm`

### marca-en-edicion
- Texto/label: `"En edición"`
- Icono: lock
- Asset: nada
- Annotation: `Badge` neutro. Nombre accesible `"{persona} lo está editando"`. Informa, no bloquea: el documento se puede abrir y leer igual

### boton-ver-mas
- Texto/label: `"Ver más"`
- Icono: nada
- Asset: nada
- Annotation: la consulta pagina por cursor, no por número de página, así que no se usa `Pagination`: no hay un total que mostrar

### resultados-busqueda
- Texto/label: columnas `"Documento"` · `"Carpeta"` · `"Actualizado"`; debajo del título, el fragmento donde aparece el texto buscado, con la coincidencia resaltada
- Icono: nada
- Asset: nada
- Annotation: el fragmento viene del módulo ya recortado; la web solo lo resalta, nunca lo interpreta como HTML

### vacio-carpeta
- Texto/label: `"Esta carpeta está vacía."` y, si la persona puede escribir en ella, `"Creá el primer documento con «Nuevo documento»."`
- Icono: folder
- Asset: nada
- Annotation: variant `list` de `EmptyState`

### vacio-busqueda
- Texto/label: `"No hay documentos que coincidan con «{texto}»."` · `"Probá con otras palabras."`
- Icono: search
- Asset: nada
- Annotation: variant `filtered` — invita a cambiar la búsqueda, no a crear

### cargando-carpeta
- Texto/label: `"Cargando documentación…"`
- Icono: nada
- Asset: nada
- Annotation: `Loader` `block` dentro del panel; el encabezado y la búsqueda quedan visibles

### aviso-no-disponible
- Texto/label: `"La documentación no está disponible en este momento. Probá de nuevo en unos minutos."`
- Icono: warning
- Asset: nada
- Annotation: la web vuelve a consultar el estado del módulo cada 60 s; cuando vuelve a `available` el aviso desaparece y la carpeta se carga sola, sin recargar la página [REQ-016 RF-17]

### aviso-error
- Texto/label: `"No se pudo cargar la carpeta. Actualizá la página."` · en búsqueda: `"No se pudo buscar. Intentá de nuevo."`
- Icono: error
- Asset: nada
- Annotation: `role="alert"`. Un `403` en una carpeta muestra `"No tenés permiso para ver esta carpeta."` en el mismo bloque

## Estados

### default
- Aplica: Sí
- Mensaje: —
- Cambios: ninguno (estado base). La carpeta actual con su contenido

### empty
- Aplica: Sí
- Mensaje: `"Esta carpeta está vacía."`
- Cambios:
  - tabla-carpeta: oculta
  - vacio-carpeta: visible

### loading
- Aplica: Sí
- Mensaje: `"Cargando documentación…"`
- Cambios:
  - cargando-carpeta: visible en el lugar de la tabla
  - busqueda-documentos y breadcrumb-carpeta: visibles y operables

### error de validación
- Aplica: No — la pantalla no tiene formulario propio; la validación del alta vive en O-11.

### error de sistema / sin conexión
- Aplica: Sí
- Mensaje: `"No se pudo cargar la carpeta. Actualizá la página."`
- Cambios:
  - aviso-error: visible
  - tabla-carpeta: oculta

### success
- Aplica: No — el alta exitosa navega al documento nuevo (ver O-11).

### not found
- Aplica: Sí
- Mensaje: `"Esta carpeta no existe o no tenés permiso para verla."`
- Cambios:
  - aviso-error: visible con este texto
  - breadcrumb-carpeta: solo `"Inicio"`, como salida
- Disparado por `folder_not_found` / `permission_denied` sobre `?folder=`. **Con el módulo `not_installed` no se llega a este estado:** la ruta entera responde el 404 de la superficie

### estado terminal / readonly
- Aplica: Sí (por carpeta)
- Mensaje: —
- Cambios:
  - boton-nuevo-documento: no se renderiza en una carpeta de solo lectura

### resultados de búsqueda (parent_state: default)
- Aplica: Sí
- Mensaje: —
- Cambios:
  - resultados-busqueda: visible
  - tabla-carpeta, breadcrumb-carpeta y boton-nuevo-documento: ocultos

### sin resultados (parent_state: resultados de búsqueda)
- Aplica: Sí
- Mensaje: `"No hay documentos que coincidan con «{texto}»."`
- Cambios:
  - vacio-busqueda: visible
  - resultados-busqueda: oculto

### módulo no disponible (parent_state: default)
- Aplica: Sí — **estado nuevo de la superficie con REQ-016** [RF-23, CA-27]
- Mensaje: `"La documentación no está disponible en este momento. Probá de nuevo en unos minutos."`
- Cambios:
  - aviso-no-disponible: visible
  - busqueda-documentos: disabled
  - boton-nuevo-documento: disabled
  - tabla-carpeta: oculta

## Interacciones

**Eventos:**
- fila de subcarpeta de tabla-carpeta · on click / `Enter` → navega a `/docs?folder={id}`
- fila de documento de tabla-carpeta · on click / `Enter` → navega a `/docs/{id}`
- breadcrumb-carpeta · on click en un nivel → navega a esa carpeta (`"Inicio"` → `/docs`)
- busqueda-documentos · on input (debounce 300 ms) → `GET /docs/search?q=`; vacío → vuelve a la carpeta
- fila de resultados-busqueda · on click → navega a `/docs/{id}`
- boton-nuevo-documento · on click → abre O-11 con la carpeta actual fijada
- boton-ver-mas · on click → pide la página siguiente con el cursor

**Validaciones:**
- busqueda-documentos · menos de 2 caracteres → no se busca, sin mensaje (se sigue mostrando la carpeta)

**Feedback:**
- Una respuesta `module_unavailable` en cualquier consulta invalida el estado del módulo y lleva la pantalla a *módulo no disponible* sin esperar el próximo sondeo [REQ-016 RF-17]

## Accesibilidad

- **Orden de foco:** busqueda-documentos → boton-nuevo-documento → breadcrumb-carpeta → filas de tabla-carpeta (enfocables: el nombre es un enlace) → boton-ver-mas.
- **Landmarks y jerarquía:** `main` con un único h1 (`"Documentación"`); el breadcrumb es `<nav aria-label="Ruta de la carpeta">`.
- **Foco y teclado:** al abrir O-11 el foco va a su primer campo y vuelve a boton-nuevo-documento al cerrarlo.
- **Propio de esta composición:** el cambio entre carpeta y resultados de búsqueda se anuncia en una región live (`"{n} resultados"` / `"Sin resultados"`), porque la tabla se reemplaza sin navegar.

## Decisiones y descartes

### REQ-016 — Módulo opcional de documentación (2026-10-24)

**Decisiones tomadas:**
- **Navegación por niveles —breadcrumb + una tabla— en vez de árbol lateral.** El DS de `web` no tiene un componente de árbol, y el árbol obliga a desplegar nodos para ver contenido. Con breadcrumb (`ViewHeader` ya lo trae) y `Table` se cubre lo mismo con dos componentes existentes y la carpeta queda en la URL. Se descartó un árbol a la izquierda: sería un componente nuevo para una sola pantalla.
- **Subcarpetas y documentos en la misma tabla, carpetas primero.** Es el modelo de cualquier explorador de archivos; separarlos en dos listas duplicaría encabezados y vacíos.
- **La búsqueda es global, no de la carpeta actual.** Se busca cuando no se sabe dónde está algo; acotarla a la carpeta respondería la pregunta equivocada.
- **"Nuevo documento" solo aparece con permiso, y nunca en la raíz.** La administración de carpetas y permisos queda fuera de la interfaz en esta entrega (se hace con jiku-go), así que un botón deshabilitado no tendría salida desde acá [REQ-016 §Fuera de Alcance].
- **Sin columna de visibilidad (`public`/`internal`) en la tabla.** Se ve en el documento; en el listado competiría con el dato que sí orienta, la fecha.
- **Paginación con "Ver más" y no con `Pagination`.** La consulta del módulo pagina por cursor y no informa un total; un paginador numerado tendría que inventarlo.

**Alternativas descartadas:**
- Filtros por proyecto, requisito o tarea en esta pantalla: esos recortes ya están en el panel de cada ficha, que es donde se buscan.
- Mover, borrar y restaurar documentos desde la web: la api los expone, pero el pedido no los pone en la interfaz y la administración del árbol vive en jiku-go [REQ-016 Supuestos].

**Preguntas abiertas:**
- ¿Hace falta una vista de "documentos recientes" como entrada en vez de la raíz? Hoy la raíz muestra las carpetas de primer nivel.
