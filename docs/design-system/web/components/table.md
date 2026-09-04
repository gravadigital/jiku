---
component: Table
version: 2.0.0
last_updated: 2026-09-04
status: normativo
surface: web
origin: Manual de marca Jiku v1.0 — «Tablas y datos»
related:
  - badge
  - pagination
  - empty-state
---

# Table (web)

> **Normativo.** Especifica las dos densidades de tabla del producto y la matriz de asignación.

## Propósito

Presenta filas comparables en columnas, para escanear y ordenar.

**Cuándo usar:**

- Listado navegable de entidades (requisitos, tareas).
- Reporte tabular de muchas filas (reporte de requisitos).
- Cruce de dos dimensiones (matriz de asignación por proyecto y persona).

**Cuándo NO usar:**

- Ítems que se leen de a uno, con descripción → [Card](./card.md) en grilla.
- Listado sin filas → [Empty state](./empty-state.md).

## Anatomía

1. **Cabecera** — niebla, con su **propia tipografía declarada**: `text.table-header`
   (11/600 versalitas, tracking 0,08 em). No hereda el tamaño del contexto.
2. **Filas** — 48 px de alto, separadas por borde claro, con fila alterna sobre `bg.row-alt`.
3. **Celdas** — `text.table-data` (13/400), interlínea 1,5. La celda de texto **recorta con
   elipsis**; la celda que contiene un [badge](./badge.md) **no recorta**.
4. **Celdas de estado** — [badge](./badge.md) con punto de color.
5. **Pie** — [paginación](./pagination.md) y selector de cantidad por página.

## Variants

| Variant | Cabecera | Uso |
|---|---|---|
| `light` | **Niebla `#F6F6F9`** (`bg.row-alt`) con borde claro, texto secundario | **Todos los listados y reportes** — requisitos, tareas, reporte de requisitos, secciones de detalle |
| `matrix` | Niebla, con agrupadores en versalitas | **Cruce de dos dimensiones** — matriz de asignación |
| `dense` | **Azul oscuro `#0B1934`**, texto niebla | **Sin consumidores.** Se conserva en la API, no se elige para nada nuevo |

> **La cabecera clara es la de todos los listados.** `light` es el default y el único valor que el
> producto ejerce: los seis consumidores de `Table` la usan.

### Por qué se cayó el criterio de las dos densidades

La v1.0.0 repartía las densidades por uso: niebla «para listados navegables», azul oscuro «para
tablas densas de seguimiento — tareas». Ninguna de las dos mitades sobrevivió a la pantalla real:

- **El criterio se contradecía a sí mismo.** La cabecera oscura señalaba «tabla para mirar de un
  vistazo, **no** para navegar», y el listado de tareas —el ejemplo nombrado por el spec— sí
  navega: el título de cada tarea linkea a su detalle. Es el mismo tipo de pantalla que el listado
  de requisitos, así que comparte su densidad.
- **En pantalla la cabecera azul se leía como un error.** El reporte de requisitos era el único
  lugar del producto con una superficie oscura, y ninguna otra tabla la acompañaba: el usuario no
  la leía como señal de densidad sino como un defecto de estilo. La consistencia entre pantallas
  pesa más que una distinción que nadie más ejerce.

`dense` **queda sin consumidores**. No se borra —la API la sigue aceptando y sus tokens siguen
resueltos— pero **no hay caso de uso vigente**: quien necesite distinguir una tabla de vigilancia
tiene que traer el criterio nuevo, no reciclar éste.

### La cabecera declara su tipografía

`text.table-header` (11 px / peso 600, versalitas, tracking 0,08 em) se declara **en el
componente**, no se hereda. Antes la cabecera sólo fijaba su alto y tomaba el tamaño del contexto
de cada pantalla: la **misma** cabecera medía 16 px en el listado de tareas y 14 px en el de
requisitos.

## Sizes

Un solo alto de fila: **48 px**. La `matrix` puede comprimir el ancho de columna, nunca el alto.

El alto de 48 px lo **sostiene el `nowrap` de la celda de texto**: sin él un título largo envuelve
a dos líneas y la fila crece — es lo que pasaba en el reporte de requisitos.

## States

| State | Descripción | Tokens |
|---|---|---|
| `default` | Fila en reposo | `bg.surface` |
| `row-hover` | Fila bajo el puntero | `table.row.hover.bg` → `bg.surface.sunken` |
| `row-focus` | Fila navegable con foco | `focus.ring` |
| `sorted` | Columna de orden activa | Indicador en la cabecera |
| `overdue` | Celda de fecha vencida | `state.urgent.text` + texto «vencido hace 1 día» |

## Spacing & sizing rules

- **Alto de fila:** 48 px (`size.48`).
- **Padding de celda:** `space.2` (8 px) vertical, `space.4` (16 px) horizontal.
- **Borde:** 1 px `#DFE1E7` entre filas.
- **Interlínea de datos:** 1,5.
- **Cabecera:** `text.table-header` — 11 px, peso 600, versalitas, tracking 0,08 em.
- **Fila alterna:** `bg.row-alt` en las pares; `bg.surface` en las impares.
- **Sufijo «+N»** para responsables extra, en `text.secondary`.

### Recorte de celda

Dos comportamientos, y la diferencia es de contenido, no de columna:

| Celda | Comportamiento |
|---|---|
| **De texto** | `nowrap` + elipsis, con **tope de 420 px** de ancho |
| **Con [badge](./badge.md)** | **No recorta**: `overflow: visible`, `nowrap`, y cede el ancho sobrante |

- **La pill es contenido atómico.** El tope global de 150 px que había antes recortaba las pills
  —«Planificación» mide 151 px—, así que el reemplazo distingue los dos casos en vez de aplicar el
  mismo tope a todo.
- **El tope de 420 px existe porque `nowrap` sin tope hace lo contrario de lo buscado:** la columna
  se estira hasta el texto más largo. En el reporte, «Conclusión» y «Comentario» —dos campos de
  texto libre— llevaban la tabla a 4031 px de ancho.
- **420 px no es arbitrario:** es el ancho de la columna más ancha que dibuja el diseño (el título
  del listado de requisitos, 2,4 fr sobre ~1100 px). Es el techo de «columna de texto larga».
- El reparto del ancho restante lo hace la tabla (`table-layout: auto`) según el peso de cada
  columna, no un máximo fijo por celda.

## Accesibilidad

- **DEBE** usarse `<table>` real con `<th scope="col">` en la cabecera. Una grilla de `div`s no
  expone la relación fila–columna.
- La `matrix` **DEBE** llevar `<th scope="row">` además de la cabecera de columna: sin eso, una
  celda de «0 %» no dice de quién ni de qué proyecto.
- El orden de columna **DEBE** exponerse con `aria-sort`.
- El estado va en badge con **punto + texto**; el vencimiento lleva texto explícito además del
  color.
- **Cabecera `light`:** texto secundario `#6D727B` sobre niebla `#F6F6F9`. En versalitas de 11 px
  el peso 600 es parte del contraste percibido, no sólo decoración.
- Una celda recortada con elipsis **DEBE** conservar su texto completo en el DOM: el lector de
  pantalla lee el valor entero aunque el ojo vea el recorte.
- Una tabla con scroll horizontal **DEBE** poder desplazarse con teclado y anunciar su región.

## Guidelines de contenido

- **Cabeceras:** sustantivo corto, sentence case — «Responsable», «Fecha de cierre».
- **Abreviaturas** admitidas en cabecera cuando la columna es angosta: «Prior.», «Modif.».
- **Fechas relativas** con referencia: «Hasta 25 ago · falta 1 día».
- **Agrupadores** de la matriz en versalitas: «comerciales activos».
- **Celda sin dato:** «N/D» o «0 h», nunca vacía.

## Do's & don'ts

**Do:**

- Usar `light` para cualquier listado o reporte: es la cabecera del producto.
- Mantener 48 px de fila en las tres variants.
- Poner el estado en un badge, no en el color de la fila.
- Dejar que la celda con pill no recorte, y recortar la de texto con elipsis.

**Don't:**

- **NO SE DEBE** elegir `dense` para una tabla nueva: no tiene consumidores y su criterio de uso se
  dio de baja.
- **NO SE DEBE** teñir la fila completa con un color de sistema.
- **NO SE DEBE** usar `<div>` en lugar de `<table>`.
- **NO SE DEBE** mezclar las dos cabeceras en una misma vista.
- **NO SE DEBE** dejar que la cabecera herede su tipografía del contexto: la declara el componente.
- **NO SE DEBE** poner un tope de ancho a la celda que contiene una pill.
- **NO SE DEBE** usar color de sistema en el glifo de área: queda reservado a estados.

## API

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `variant` | `"light" \| "dense" \| "matrix"` | `"light"` | Presentación de la cabecera. `dense` **no tiene consumidores** |
| `columns` | `{ key, label, sortable?, scope? }[]` | — | Definición de columnas. `scope: "row"` marca el encabezado de fila, sólo con sentido en `matrix` |
| `rows` | `object[]` | — | Datos. La clave `_overdue` lleva las claves de columna vencidas en esa fila |
| `sort` | `{ key, direction }` | — | Orden activo |
| `onSortChange` | `(sort) => void` | — | Callback de orden |
| `emptyState` | ReactNode | — | Qué mostrar sin filas |
| `loading` | `boolean` | `false` | Muestra «Cargando…» en un `role="status"` en lugar del cuerpo |
| `ariaLabel` | `string` | `"Tabla de datos"` | Nombre accesible de la región con scroll horizontal |

## Migración

El relevamiento registró que `Pagination` **hardcodea `router.push('/objectives?...')`**, así que
sólo funciona en esa ruta — y esa es la causa de las **4 paginaciones reimplementadas inline** del
producto. La tabla nueva delega en [Pagination](./pagination.md), que es agnóstica de la ruta.

| Hoy | Pasa a |
|---|---|
| Cabecera con `--color-general-disabled` `#D9D9D9` | **Niebla** (`light`) |
| `td { max-width: 9.4rem }` global | Recorte por tipo de celda: texto con tope de 420 px, pill sin tope |
| `tr:hover` global | `bg.surface.sunken` desde el módulo del componente |
| Hover de fila `--color-surface-hover` `#e0e0e0` | `bg.surface.sunken` |
| 4 paginaciones inline + `Pagination` atada a una ruta | [Pagination](./pagination.md) |

## Componentes y patterns relacionados

- [Badge](./badge.md) — celdas de estado y prioridad.
- [Pagination](./pagination.md) — pie de tabla.
- [Empty state](./empty-state.md) — «No se encontraron requisitos».
- [Avatar](./avatar.md) — identidad de persona en la matriz.

## Historial

- **2.0.0** (2026-09-04) — **BREAKING: se cae el criterio de las dos densidades.** La cabecera
  clara es la de **todos** los listados: el listado de tareas y el reporte de requisitos —los dos
  casos que la v1.0.0 asignaba a `dense`— pasaron a `light`, y `dense` **queda sin consumidores**.
  Motivo doble: el propio criterio del spec («no para navegar») fallaba, porque las filas de tareas
  sí navegan —el título linkea al detalle—, y en pantalla la cabecera azul era lo único oscuro del
  producto, se leía como error y no como señal. Es MAJOR porque invierte una regla normativa: una
  implementación que seguía la letra de la v1.0.0 —el reporte de requisitos lo hacía— queda fuera
  de spec.
  Además, en el mismo corte: la cabecera **declara su propia tipografía** (`text.table-header`,
  11/600 versalitas, tracking 0,08 em) en vez de heredarla del contexto, que daba 16 px en una
  pantalla y 14 px en otra para la misma cabecera; y se especifica el **recorte por tipo de
  celda** —la celda de texto recorta con elipsis con tope de 420 px, la celda con pill no recorta—
  en reemplazo del tope global de 150 px que cortaba las pills. Se documentan `loading`,
  `ariaLabel`, `_overdue` y la fila alterna, ya presentes en el componente.
- **1.0.0** (2026-09-02) — Spec nuevo, desde el Manual de marca Jiku v1.0: dos densidades con
  criterio de uso (niebla para navegar, azul oscuro para vigilar), fila de 48 px, matriz de
  asignación con encabezados de fila, y delegación de la paginación (MINOR sobre el DS).
