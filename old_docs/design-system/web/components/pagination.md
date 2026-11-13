---
component: Pagination
version: 1.0.0
last_updated: 2026-09-02
status: normativo
surface: web
origin: Manual de marca Jiku v1.0 — «Navegación»
related:
  - table
  - select
---

# Pagination (web)

> **Normativo, y resuelve un bug de diseño.** El `Pagination` del código **hardcodea
> `router.push('/objectives?...')`**, así que sólo funciona en esa ruta — y es la causa de las
> **4 paginaciones reimplementadas inline** que el relevamiento encontró en el producto. Este spec
> es agnóstico de la ruta.

## Propósito

Recorre un listado por páginas y controla cuántos elementos muestra cada una.

**Cuándo usar:**

- Pie de un listado o tabla con más elementos que los que caben.

**Cuándo NO usar:**

- Recorrer semanas o rangos temporales → [Week nav](./week-nav.md).
- Filtrar por estado → [Tabs](./tabs.md).

## Anatomía

1. **Anterior `‹`** — retrocede una página.
2. **Indicador de página** — número de la página actual.
3. **Siguiente `›`** — avanza una página.
4. **Selector de cantidad** — «5 por página ⌄», un [Select](./select.md) `inline`.

## Variants

Una sola.

## Sizes

Sin sizes. La zona clickeable de cada control **nunca baja de 32 px**.

## States

| State | Descripción | Tokens |
|---|---|---|
| `default` | Control disponible | `pagination.item.text` |
| `hover` | Bajo el puntero | `motion.fast` |
| `focus` | Foco por teclado | `focus.ring` |
| `current` | Página actual | **Fondo verde agua + texto azul oscuro** — `pagination.active.*` |
| `disabled` | `‹` en la primera página, `›` en la última | `text.disabled`, no accionable |

## Spacing & sizing rules

- **Radio:** 8 px (`radius.action`) en los ítems.
- **Gap entre controles:** `space.1` (4 px).
- **Borde:** 1 px `#DFE1E7`.
- **Separación con el selector de cantidad:** `space.4` (16 px).

## Accesibilidad

- **DEBE** ser un `<nav>` con `aria-label="Paginación"`.
- La página actual **DEBE** llevar `aria-current="page"`.
- `‹` y `›` **DEBEN** tener nombre accesible: «Página anterior», «Página siguiente». **El glifo no
  es un nombre.**
- Los controles en el extremo **DEBEN** estar `disabled` de verdad, no sólo atenuados.
- El cambio de página **DEBE** anunciarse en una región `aria-live`, o mover el foco al inicio del
  listado: si no, quien usa lector de pantalla no sabe que el contenido cambió.
- El selector de cantidad sigue las reglas de [Select](./select.md).
- **Contraste:** azul oscuro sobre verde agua **9.8:1**.

## Guidelines de contenido

- **Cantidad con unidad explícita:** «5 por página», no «5».
- Sin «primera» ni «última» si no hay total conocido.

## Do's & don'ts

**Do:**

- Recibir la ruta o el callback desde fuera del componente.
- Deshabilitar de verdad los extremos.
- Anunciar el cambio de página.

**Don't:**

- **NO SE DEBE** hardcodear una ruta dentro del componente. Es lo que rompió al anterior.
- **NO SE DEBE** reimplementar la paginación inline en una pantalla: si falta algo, se agrega acá.
- **NO SE DEBE** ocultar la paginación cuando hay una sola página: se muestra deshabilitada, para
  que el pie no cambie de alto.

## API

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `page` | `number` | `1` | Página actual |
| `pageSize` | `number` | `5` | Elementos por página |
| `pageSizeOptions` | `number[]` | `[5, 10, 25]` | Opciones del selector |
| `totalPages` | `number` | — | Total, si se conoce |
| `onPageChange` | `(page) => void` | — | **Callback, no ruta interna** |
| `onPageSizeChange` | `(size) => void` | — | Cambio de cantidad |

> **No hay prop de ruta.** El componente notifica y quien lo usa decide qué hacer con el cambio:
> eso es lo que lo hace reutilizable.

## Migración

| Hoy | Pasa a |
|---|---|
| `Pagination` con `router.push('/objectives?...')` hardcodeado | `onPageChange` como callback |
| **4 paginaciones inline** en otras pantallas | Este componente |

## Componentes y patterns relacionados

- [Table](./table.md) — su contenedor habitual.
- [Select](./select.md) — el selector de cantidad, variant `inline`.

## Historial

- **1.0.0** (2026-09-02) — Spec nuevo, desde el Manual de marca Jiku v1.0. Agnóstico de la ruta vía
  `onPageChange`, lo que resuelve la causa de las 4 paginaciones inline registradas en
  `gaps-as-is.md` (MINOR sobre el DS).
