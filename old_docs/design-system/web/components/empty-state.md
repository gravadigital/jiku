---
component: EmptyState
version: 1.0.0
last_updated: 2026-09-02
status: normativo
surface: web
origin: Manual de marca Jiku v1.0 — «Tarjetas y paneles»
related:
  - loader
  - card
  - table
---

# EmptyState (web)

> **Normativo.** Especifica el mensaje de ausencia de datos. Existe porque el relevamiento mostró
> que hoy se resuelve inline en cada pantalla, con textos distintos.

## Propósito

Comunica que una consulta terminó y **no hay datos**, sin que el usuario dude de si algo falló.

**Cuándo usar:**

- Un listado, grilla o sección sin elementos.
- Un filtro que no devolvió resultados.

**Cuándo NO usar:**

- La consulta está en curso → [Loader](./loader.md). **No son lo mismo:** «estamos buscando» no es
  «no hay nada», y confundirlos hace que el usuario espere datos que no van a llegar.
- Hubo un error de sistema → mensaje de error, que dice qué pasó y qué hacer.

## Anatomía

1. **Container** — superficie de apoyo en niebla, radio 14 px.
2. **Mensaje** — `text.body-default` en `text.secondary`.
3. **Acción (opcional)** — [botón](./button.md) primario, sólo si hay algo que crear.

**Sin ilustración.** La personalidad de marca es sobria y sin adorno; un estado vacío no es una
oportunidad decorativa.

## Variants

| Variant | Propósito | Ejemplo del manual |
|---|---|---|
| `list` | Listado o grilla sin elementos | «No hay etapas activas» |
| `filtered` | Filtro sin resultados | «No se encontraron requisitos» |
| `scoped` | Sin datos para un recorte temporal | «No hay cargas para este día» |

> La diferencia importa: `list` invita a crear el primer elemento; `filtered` invita a **cambiar el
> filtro**, no a crear. Ofrecer «Nuevo requisito» cuando el usuario acaba de filtrar es una
> respuesta a una pregunta que no hizo.

## Sizes

Sin sizes. Ocupa el ancho de su contenedor, con padding vertical `space.8` (32 px).

## States

Estado único.

## Spacing & sizing rules

- **Radio:** 14 px (`radius.surface`).
- **Fondo:** `bg.surface.sunken` (niebla).
- **Padding:** `space.8` (32 px) vertical, `space.4` (16 px) horizontal.
- **Gap mensaje–acción:** `space.4` (16 px).
- **Texto centrado.**

## Accesibilidad

- **DEBE** vivir en una región con `aria-live="polite"` cuando aparece como resultado de un filtro:
  el usuario que no ve la pantalla necesita saber que su filtro no devolvió nada.
- **NO DEBE** usar `role="alert"`: la ausencia de datos no es un error.
- El mensaje **DEBE** ser texto real, no una imagen con texto.
- Si hay acción, es un [botón](./button.md) con su foco y su label propios.

## Guidelines de contenido

Ver [guidelines/content.md](../guidelines/content.md#estados-vacíos).

**Negativa neutra, en presente, sin disculpas ni exclamaciones** — es la convención de
[voice & tone](../foundations/voice-tone.md):

- ✓ «No hay etapas activas»
- ✓ «No se encontraron requisitos»
- ✓ «No hay cargas para este día»
- ✗ «¡Ups! No encontramos nada» — el tono de marca es sereno
- ✗ «Error: sin resultados» — no es un error
- ✗ «Todavía no cargaste nada» — culpa al usuario

## Do's & don'ts

**Do:**

- Decir exactamente qué no hay, con el término de dominio.
- Ofrecer la acción de alta **sólo** cuando el vacío es real, no filtrado.
- Mantener el texto en una línea cuando se pueda.

**Don't:**

- **NO SE DEBE** usar un loader para decir que no hay datos.
- **NO SE DEBE** agregar ilustración ni emoji.
- **NO SE DEBE** ofrecer «crear» cuando el usuario está filtrando.
- **NO SE DEBE** dejar el área en blanco sin mensaje.

## API

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `variant` | `"list" \| "filtered" \| "scoped"` | `"list"` | Tipo de vacío |
| `message` | `string` | — | Texto visible, requerido |
| `action` | Button props | — | Acción de alta, sólo en `list` |

## Componentes y patterns relacionados

- [Loader](./loader.md) — mientras la consulta está en curso.
- [Table](./table.md) y [Card](./card.md) — los contenedores que lo muestran.

## Historial

- **1.0.0** (2026-09-02) — Spec nuevo, desde el Manual de marca Jiku v1.0: tres variants con
  criterio de cuándo ofrecer acción de alta, microcopy en negativa neutra y distinción explícita
  respecto del loader (MINOR sobre el DS).
