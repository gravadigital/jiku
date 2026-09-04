---
component: Accordion
version: 1.2.0
last_updated: 2026-09-04
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

1. **Container** — **radio 10 px**, borde claro de 1 px, con **borde izquierdo de 3 px del color
   del estado**.
2. **Marca de completitud** — **badge circular de 16 px** con `!` (pendiente) o `✓` (completo)
   dentro, a la izquierda.
3. **Título** — `text.card-title` (16/700).
4. **Chevron `›`** — a la derecha, rota 90° al abrir.
5. **Contenido** — visible al expandir.

## Variants

Una sola. Lo que cambia es la **marca de completitud**:

| Marca | Significado | Token | Borde izquierdo |
|---|---|---|---|
| `!` | Etapa **pendiente** — falta información | `accordion.pending.mark` → ámbar `#FEA82F` | Ámbar |
| `✓` | Etapa **completa** | `accordion.done.mark` → verde agua profundo | Verde agua |

> La marca usa colores de sistema porque **informa estado**, y distingue **por glifo además de por
> color** (`!` vs `✓`), no sólo por el matiz.

### El estado se dice dos veces: en el borde y en la marca

- **Borde izquierdo de 3 px del color del estado.** Ámbar si está pendiente, verde agua si está
  completa. Es la señal que se lee sin mirar el detalle: una columna de acordeones muestra de un
  vistazo qué etapas faltan.
- **La marca es un badge circular de 16 px**, con el glifo en blanco (pendiente) o en azul oscuro
  (completo) sobre el color de estado relleno. **Antes era texto de color pelado**, y el color solo
  no comunica el estado.

Las dos señales conviven con el **texto accesible**, que sigue siendo la fuente del dato para el
lector de pantalla.

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

- **Radio:** **10 px** (`accordion.stage.radius` → `radius.field`) — **no** el radio de superficie
  de 14 px. El acordeón de etapa es un contenedor de fila, no una tarjeta.
- **Borde:** 1 px `#DFE1E7`. **Borde izquierdo:** 3 px (`accordion.bar.width`) del color del
  estado.
- **Marca:** círculo de 16 px (`accordion.mark.size`), glifo en peso 700.
- **Padding de cabecera:** `space.4` (16 px).
- **Gap marca–título:** `space.2` (8 px).
- **Gap entre acordeones:** `space.2` (8 px).

## Accesibilidad

- La cabecera **DEBE** ser un `<button>` dentro de un encabezado del nivel que corresponda, con
  `aria-expanded` y `aria-controls` apuntando al panel.
- El panel **DEBE** llevar `role="region"` con `aria-labelledby` hacia su cabecera.
- La marca de completitud **DEBE** anunciarse en texto: «Alcance, pendiente» / «Cierre estimado,
  completo». **El `!`, el `✓` y el borde de color son visuales.** El badge de la marca lleva
  `aria-hidden="true"`.
- El eco accesible se emite cuando `showStatus` está activo **y** `title` es un `string`: con un
  `title` de contenido rico el propio título ya es el nombre accesible completo.
- **Teclado:** `Enter` / `Space` alternan; `Tab` recorre las cabeceras.
- **`prefers-reduced-motion`:** la apertura es instantánea.
- El contenido plegado **DEBE** estar fuera del orden de foco (`hidden`), no sólo con altura 0.

## Guidelines de contenido

- **Título:** el nombre de la etapa, con el término de dominio.
- Sin indicar en el título que está pendiente: **eso lo dice la marca**, no el texto.

## Do's & don'ts

**Do:**

- Distinguir pendiente y completo con glifo **y** color, en el badge **y** en el borde izquierdo.
- Usar `motion.slow` para la apertura.
- Sacar el contenido plegado del orden de foco.

**Don't:**

- **NO SE DEBE** marcar la completitud sólo con color.
- **NO SE DEBE** poner la marca como texto de color pelado: es un badge circular relleno.
- **NO SE DEBE** darle radio 14 px: el acordeón de etapa va en 10.
- **NO SE DEBE** anidar acordeones.
- **NO SE DEBE** plegar contenido que el usuario necesita ver siempre.
- **NO SE DEBE** abrir todos los paneles a la vez por defecto si son muchos.

## API

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `title` | `ReactNode` | — | Nombre de la etapa. Un `string` simple es el uso recomendado; acepta contenido rico (ícono + texto + cifra) para consumidores de fila de datos, ver `showStatus` |
| `status` | `"pending" \| "done"` | `"pending"` | Marca de completitud |
| `showStatus` | `boolean` | `true` | En `false`, omite la marca de completitud y su eco accesible — para consumidores sin concepto de pendiente/completo (una fila expandible de tabla, por ejemplo), donde `title` ya es el nombre accesible completo |
| `defaultExpanded` | `boolean` | `false` | Estado inicial |
| `onToggle` | `(expanded) => void` | — | Callback |

**Slots:** `children` (contenido del panel).

## Componentes y patterns relacionados

- [Card](./card.md) — el panel que suele contenerlo.
- [Stepper](./stepper.md) — el recorrido de estados, que no es esto.
- [Badge](./badge.md) — comparten las familias de color de sistema.

## Historial

- **1.2.0** (2026-09-04) — Se corrige la especificación visual contra el código, sin cambiar la
  API. El contenedor lleva **borde izquierdo de 3 px del color del estado** (ámbar pendiente /
  verde agua completo), que es la señal legible sin abrir el acordeón, y la **marca pasa de texto
  de color a un badge circular relleno de 16 px** con el glifo dentro —el color de un texto solo no
  comunica estado—. El **radio pasa a 10 px** (`radius.field`) y no el radio de superficie de
  14 px: es un contenedor de fila, no una tarjeta. Se corrige además el `version:` del frontmatter,
  que había quedado en `1.0.0` cuando el Historial ya registraba la 1.1.0 de S-058 (MINOR).
- **1.1.0** (2026-09-03, story S-058) — `title` amplía su tipo de `string` a `ReactNode` (backward
  compatible: todo uso existente con `string` sigue siendo válido). Se agrega `showStatus` para
  omitir la marca de completitud en consumidores sin ese concepto. Motivo: la migración de
  `HierarchicalTable` (tabla jerárquica de horas, 4 niveles) necesita cabeceras de fila con ícono +
  texto + cifra, algo que `title: string` no podía expresar, sin renunciar al `<button>` accesible
  real del componente (MINOR sobre el DS).
- **1.0.0** (2026-09-02) — Spec nuevo, desde el Manual de marca Jiku v1.0: radio 14 px, marca de
  completitud `!` / `✓` que distingue por glifo además de por color, apertura con `motion.slow`
  (MINOR sobre el DS).
