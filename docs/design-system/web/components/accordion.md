---
component: Accordion
version: 1.0.0
last_updated: 2026-09-02
status: normativo
surface: web
origin: Manual de marca Jiku v1.0 — «Tarjetas y paneles»
related:
  - card
  - badge
---

# Accordion (web)

> **Normativo.** Especifica el acordeón de etapa, con su marca de pendiente o completo.

## Propósito

Agrupa el contenido de una etapa en una sección plegable, mostrando de un vistazo si está completa.

**Cuándo usar:**

- Etapas de un proceso con contenido extenso («Alcance», «Cierre estimado»).
- Secciones de un formulario largo que se completan por partes.

**Cuándo NO usar:**

- Contenido que hay que ver siempre → [Card](./card.md) `panel`.
- Recorrido de estados de un requisito → [Stepper](./stepper.md).

## Anatomía

1. **Container** — radio 14 px, borde claro.
2. **Marca de completitud** — `!` (pendiente) o `✓` (completo), a la izquierda.
3. **Título** — `text.card-title` (16/700).
4. **Chevron `›`** — a la derecha, rota al abrir.
5. **Contenido** — visible al expandir.

## Variants

Una sola. Lo que cambia es la **marca de completitud**:

| Marca | Significado | Token |
|---|---|---|
| `!` | Etapa **pendiente** — falta información | `accordion.pending.mark` → ámbar `#FEA82F` |
| `✓` | Etapa **completa** | `accordion.done.mark` → `#1B998B` |

> La marca usa colores de sistema porque **informa estado**, y distingue **por glifo además de por
> color** (`!` vs `✓`), no sólo por el matiz.

## Sizes

Sin sizes. Alto de cabecera suficiente para el título; el contenido crece libremente.

## States

| State | Descripción | Tokens |
|---|---|---|
| `collapsed` | Plegado | Chevron `›` a la derecha |
| `expanded` | Desplegado | Chevron rotado, contenido visible |
| `hover` | Cabecera bajo el puntero | `bg.surface.sunken` |
| `focus` | Foco por teclado | `focus.ring` |

La transición usa **`motion.slow`** (300 ms) — es el caso de mayor recorrido del sistema
(ver [motion](../foundations/motion.md#qué-se-anima)).

## Spacing & sizing rules

- **Radio:** 14 px (`radius.surface`).
- **Borde:** 1 px `#DFE1E7`.
- **Padding de cabecera:** `space.4` (16 px).
- **Gap marca–título:** `space.2` (8 px).
- **Gap entre acordeones:** `space.2` (8 px).

## Accesibilidad

- La cabecera **DEBE** ser un `<button>` dentro de un encabezado del nivel que corresponda, con
  `aria-expanded` y `aria-controls` apuntando al panel.
- El panel **DEBE** llevar `role="region"` con `aria-labelledby` hacia su cabecera.
- La marca de completitud **DEBE** anunciarse en texto: «Alcance, pendiente» / «Cierre estimado,
  completo». **El `!` y el `✓` son visuales.**
- **Teclado:** `Enter` / `Space` alternan; `Tab` recorre las cabeceras.
- **`prefers-reduced-motion`:** la apertura es instantánea.
- El contenido plegado **DEBE** estar fuera del orden de foco (`hidden`), no sólo con altura 0.

## Guidelines de contenido

- **Título:** el nombre de la etapa, con el término de dominio.
- Sin indicar en el título que está pendiente: **eso lo dice la marca**, no el texto.

## Do's & don'ts

**Do:**

- Distinguir pendiente y completo con glifo **y** color.
- Usar `motion.slow` para la apertura.
- Sacar el contenido plegado del orden de foco.

**Don't:**

- **NO SE DEBE** marcar la completitud sólo con color.
- **NO SE DEBE** anidar acordeones.
- **NO SE DEBE** plegar contenido que el usuario necesita ver siempre.
- **NO SE DEBE** abrir todos los paneles a la vez por defecto si son muchos.

## API

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `title` | `string` | — | Nombre de la etapa |
| `status` | `"pending" \| "done"` | `"pending"` | Marca de completitud |
| `defaultExpanded` | `boolean` | `false` | Estado inicial |
| `onToggle` | `(expanded) => void` | — | Callback |

**Slots:** `children` (contenido del panel).

## Componentes y patterns relacionados

- [Card](./card.md) — el panel que suele contenerlo.
- [Stepper](./stepper.md) — el recorrido de estados, que no es esto.
- [Badge](./badge.md) — comparten las familias de color de sistema.

## Historial

- **1.0.0** (2026-09-02) — Spec nuevo, desde el Manual de marca Jiku v1.0: radio 14 px, marca de
  completitud `!` / `✓` que distingue por glifo además de por color, apertura con `motion.slow`
  (MINOR sobre el DS).
