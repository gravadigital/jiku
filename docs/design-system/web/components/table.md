---
component: Table
version: 1.0.0
last_updated: 2026-09-02
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

- Listado navegable de entidades (requisitos).
- Seguimiento denso de muchas filas (tareas).
- Cruce de dos dimensiones (matriz de asignación por proyecto y persona).

**Cuándo NO usar:**

- Ítems que se leen de a uno, con descripción → [Card](./card.md) en grilla.
- Listado sin filas → [Empty state](./empty-state.md).

## Anatomía

1. **Cabecera** — niebla o azul oscuro según densidad.
2. **Filas** — 48 px de alto, separadas por borde claro.
3. **Celdas** — `text.table-data` (13/400), interlínea 1,5.
4. **Celdas de estado** — [badge](./badge.md) con punto de color.
5. **Pie** — [paginación](./pagination.md) y selector de cantidad por página.

## Variants

**Dos densidades**, y la elección no es estética:

| Variant | Cabecera | Uso |
|---|---|---|
| `light` | **Niebla `#F6F6F9`** con borde claro, texto secundario | **Listados navegables** — requisitos |
| `dense` | **Azul oscuro `#0B1934`**, texto niebla | **Tablas densas de seguimiento** — tareas |
| `matrix` | Niebla, con agrupadores en versalitas | **Cruce de dos dimensiones** — matriz de asignación |

> «Cabecera niebla para listados navegables, cabecera azul oscuro para tablas densas de
> seguimiento». La cabecera oscura señala que la tabla es para **mirar mucho de un vistazo**, no
> para navegar.

## Sizes

Un solo alto de fila: **48 px**. La `matrix` puede comprimir el ancho de columna, nunca el alto.

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
- **Sufijo «+N»** para responsables extra, en `text.secondary`.

## Accesibilidad

- **DEBE** usarse `<table>` real con `<th scope="col">` en la cabecera. Una grilla de `div`s no
  expone la relación fila–columna.
- La `matrix` **DEBE** llevar `<th scope="row">` además de la cabecera de columna: sin eso, una
  celda de «0 %» no dice de quién ni de qué proyecto.
- El orden de columna **DEBE** exponerse con `aria-sort`.
- El estado va en badge con **punto + texto**; el vencimiento lleva texto explícito además del
  color.
- **Cabecera `dense`:** texto niebla sobre azul oscuro da **14.6:1**.
- Una tabla con scroll horizontal **DEBE** poder desplazarse con teclado y anunciar su región.

## Guidelines de contenido

- **Cabeceras:** sustantivo corto, sentence case — «Responsable», «Fecha de cierre».
- **Abreviaturas** admitidas en cabecera de tabla densa: «Prior.», «Modif.».
- **Fechas relativas** con referencia: «Hasta 25 ago · falta 1 día».
- **Agrupadores** de la matriz en versalitas: «comerciales activos».
- **Celda sin dato:** «N/D» o «0 h», nunca vacía.

## Do's & don'ts

**Do:**

- Elegir la densidad por el uso: navegar (claro) o vigilar (oscuro).
- Mantener 48 px de fila en las tres variants.
- Poner el estado en un badge, no en el color de la fila.

**Don't:**

- **NO SE DEBE** teñir la fila completa con un color de sistema.
- **NO SE DEBE** usar `<div>` en lugar de `<table>`.
- **NO SE DEBE** mezclar las dos cabeceras en una misma vista.
- **NO SE DEBE** usar color de sistema en el glifo de área: queda reservado a estados.

## API

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `variant` | `"light" \| "dense" \| "matrix"` | `"light"` | Densidad |
| `columns` | `{ key, label, sortable?, scope? }[]` | — | Definición de columnas |
| `rows` | `object[]` | — | Datos |
| `sort` | `{ key, direction }` | — | Orden activo |
| `onSortChange` | `(sort) => void` | — | Callback de orden |
| `emptyState` | ReactNode | — | Qué mostrar sin filas |

## Migración

El relevamiento registró que `Pagination` **hardcodea `router.push('/objectives?...')`**, así que
sólo funciona en esa ruta — y esa es la causa de las **4 paginaciones reimplementadas inline** del
producto. La tabla nueva delega en [Pagination](./pagination.md), que es agnóstica de la ruta.

| Hoy | Pasa a |
|---|---|
| Cabecera con `--color-general-disabled` `#D9D9D9` | **Niebla** (`light`) o **azul oscuro** (`dense`) |
| Hover de fila `--color-surface-hover` `#e0e0e0` | `bg.surface.sunken` |
| 4 paginaciones inline + `Pagination` atada a una ruta | [Pagination](./pagination.md) |

## Componentes y patterns relacionados

- [Badge](./badge.md) — celdas de estado y prioridad.
- [Pagination](./pagination.md) — pie de tabla.
- [Empty state](./empty-state.md) — «No se encontraron requisitos».
- [Avatar](./avatar.md) — identidad de persona en la matriz.

## Historial

- **1.0.0** (2026-09-02) — Spec nuevo, desde el Manual de marca Jiku v1.0: dos densidades con
  criterio de uso (niebla para navegar, azul oscuro para vigilar), fila de 48 px, matriz de
  asignación con encabezados de fila, y delegación de la paginación (MINOR sobre el DS).
