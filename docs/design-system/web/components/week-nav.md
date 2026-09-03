---
component: WeekNav
version: 1.0.0
last_updated: 2026-09-02
status: normativo
surface: web
origin: Manual de marca Jiku v1.0 — «Navegación»
related:
  - toggle-group
  - pagination
---

# WeekNav (web)

> **Normativo.** Especifica la navegación de semana de las vistas de horas y asignación.

## Propósito

Recorre el tiempo por semanas y permite volver a la semana actual de un paso.

**Cuándo usar:**

- Vistas con recorte semanal: carga de horas, asignación de tiempo.

**Cuándo NO usar:**

- Recorrer páginas de un listado → [Pagination](./pagination.md).
- Elegir una fecha puntual → [Input](./input.md) `date`.

## Anatomía

1. **Anterior `‹`** — «‹ Anterior».
2. **Rango visible** — «Semana del 24 al 28 de agosto 2026».
3. **Atajo al presente** — «Esta semana».
4. **Siguiente `›`** — «Siguiente ›».

## Variants

Una sola.

## Sizes

Sin sizes. Zona clickeable de cada control **no menor a 32 px** de alto.

## States

| State | Descripción | Tokens |
|---|---|---|
| `default` | Control disponible | `text.secondary` |
| `hover` | Bajo el puntero | `motion.fast` |
| `focus` | Foco por teclado | `focus.ring` |
| `current` | La semana mostrada **es** la actual | «Esta semana» marcado o deshabilitado |

> **«Esta semana» no se oculta cuando ya estás en la semana actual:** se marca. Ocultarlo haría que
> el control aparezca y desaparezca según dónde estés, y el usuario no sabría que existe.

## Spacing & sizing rules

- **Radio:** 999 px (`radius.pill`) en «Esta semana»; 8 px en las flechas.
- **Gap entre controles:** `space.2` (8 px).
- **Rango:** `text.body-default`, centrado entre las flechas.

## Accesibilidad

- **DEBE** ser un `<nav>` con `aria-label="Navegación de semana"`.
- «‹ Anterior» y «Siguiente ›» ya llevan texto, así que su nombre accesible es correcto; **si se
  reducen a sólo glifo, DEBEN** llevar `aria-label` («Semana anterior»).
- El cambio de semana **DEBE** anunciarse en una región `aria-live`: el rango cambia y con él todo
  el contenido.
- El rango **DEBE** ser texto legible, con mes y año — no «24/08–28/08» a secas.
- **Teclado:** los tres controles son botones en el orden visual.

## Guidelines de contenido

- **Rango explícito con mes y año:** «Semana del 24 al 28 de agosto 2026».
- **Atajo nombrado:** «Esta semana», no «Hoy» (el recorte es semanal).
- Flechas con palabra: «‹ Anterior», «Siguiente ›».

## Do's & don'ts

**Do:**

- Escribir el rango completo, con mes y año.
- Mantener «Esta semana» siempre visible.
- Anunciar el cambio de semana.

**Don't:**

- **NO SE DEBE** dejar las flechas sin nombre accesible.
- **NO SE DEBE** abreviar el rango a números sueltos.
- **NO SE DEBE** ocultar el atajo al presente.

## API

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `weekStart` | `Date` | — | Primer día de la semana mostrada |
| `onChange` | `(weekStart) => void` | — | Callback de cambio |
| `isCurrentWeek` | `boolean` | — | Marca el atajo al presente |

## Componentes y patterns relacionados

- [ToggleGroup](./toggle-group.md) — chips de día dentro de la semana.
- [Pagination](./pagination.md) — mismo rol para listados.

## Historial

- **1.0.0** (2026-09-02) — Spec nuevo, desde el Manual de marca Jiku v1.0: rango explícito con mes
  y año, atajo «Esta semana» siempre visible, anuncio del cambio en región viva (MINOR sobre el DS).
