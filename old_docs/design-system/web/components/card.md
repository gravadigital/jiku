---
component: Card
version: 1.1.0
last_updated: 2026-09-04
status: normativo
surface: web
origin: Manual de marca Jiku v1.0 — «Tarjetas y paneles»
related:
  - badge
  - empty-state
  - accordion
---

# Card (web)

> **Normativo.** Especifica las tarjetas y paneles. El relevamiento marcó `SectionCard` (7 usos) y
> un `Card` **sin usos, exportado desde el barrel** —o sea, disponible y muerto. Este spec los
> reemplaza.

## Propósito

Agrupa la información de una entidad —proyecto, tarea, panel de datos— en una superficie propia.

**Cuándo usar:**

- Ítem de un listado en grilla (proyecto, tarea).
- Panel de datos dentro de una vista de detalle («Información general»).
- Contenedor de una métrica destacada.

**Cuándo NO usar:**

- Filas comparables en columnas → [Table](./table.md).
- Sección plegable → [Accordion](./accordion.md).
- Ausencia de datos → [Empty state](./empty-state.md).

## Anatomía

1. **Container** — radio 14 px, fondo blanco, borde claro 1 px, sombra `elevation.card`.
2. **Cabecera** — fechas o metadatos a la izquierda, [badge](./badge.md) de estado a la derecha.
3. **Título** — `text.card-title` (Gabarito 16/700).
4. **Descripción** — `text.body-default` (14/400).
5. **Etiquetas** — `card-tag` con su [glifo de forma](./badge.md#glyph-la-forma-de-la-etiqueta) y
   glifo de área.
6. **Pie de métricas** — **grilla de tres columnas centradas**, apoyada en el fondo hundido
   (`card.footer.bg`), con borde superior y **a sangre**; **se rellena en rojo pleno cuando la
   tarea está vencida**.
7. **Cifra de métrica** (`metric`) — valor en Sora + label en versalitas, en columna centrada.

## Variants

| Variant | Propósito | Ejemplo |
|---|---|---|
| `project` | Tarjeta de proyecto en grilla | «EXO · WashMach» con rango de fechas y etiquetas |
| `task` | Tarjeta de tarea | Responsable, minutos trabajados, pie con Creación / Modif. / Cierre |
| `task-overdue` | Tarea vencida | Igual que `task`, con **borde rojo pleno de 1,5 px, sin sombra, y el pie relleno de rojo pleno** |
| `panel` | Panel de datos en detalle | «Información general» con pares clave–valor |
| `metric` | Métrica destacada | «2h» en Sora 34/700 + «total horas» en versalitas |

> **`task-overdue` no es una variant decorativa:** «El pie de métricas se tiñe **sólo** cuando la
> tarea está vencida». Es la única condición que cambia el color de la tarjeta, y **el único lugar
> del sistema con rojo pleno**.

### El pie de métricas es una grilla, no una fila

El pie es una **grilla de tres columnas de igual ancho, con el texto centrado en cada una**. Antes
era una fila flex, y las tres métricas —Creación / Modif. / Cierre— quedaban repartidas por su
propio ancho de texto en vez de alineadas entre tarjetas vecinas.

- **Fondo hundido** (`card.footer.bg` → `bg.row-alt`) y **borde superior** de 1 px, que lo separa
  del cuerpo.
- **A sangre:** el pie llega a los bordes de la tarjeta. En las variants de tarea el padding pasa
  del contenedor al contenido para conseguirlo.
- **Se empuja al fondo** (`margin-top: auto`), así el pie de dos tarjetas vecinas queda a la misma
  altura.
- La tipografía de cada columna **la declara el componente que renderiza el par label + dato**
  (`DateLabel` / `FinishDateLabel`), no el pie: ponerla acá con selectores posicionales la ataba al
  orden del markup.

### La tarjeta vencida rellena el pie

La v1.0.0 decía que el pie **cambia el color del texto** cuando está vencida. Lo que quedó es más
fuerte: el pie **se rellena de rojo pleno** (`card.footer.overdue.bg` → `state.urgent.full`) con
**texto blanco** (`card.footer.overdue.text`) y el dato en peso 700, y el borde superior toma el
mismo rojo. La tarjeta además lleva **borde de 1,5 px en rojo pleno y sin sombra**.

### `emphasis`: la métrica destacada es prop, no variant

| | |
|---|---|
| **Fondo** | Azul oscuro `card.metric-emphasis.bg` → `bg.brand-deep` |
| **Cifra** | **Verde agua** `card.metric-emphasis.value` → `bg.action-primary` |
| **Label** | `card.metric-emphasis.label` |
| **Borde y sombra** | Ninguno |

> **Es una prop y no una variant nueva, a propósito.** El diseño pide **una sola destacada por
> fila** (la primera de las cuatro), o sea que el destaque es una decisión del consumidor sobre una
> tarjeta que ya es `metric` — no un sexto tipo de tarjeta. **El set de variants sigue cerrado en
> cinco.** `emphasis` sólo tiene efecto con `variant="metric"`.
>
> El fondo usa `bg.brand-deep` y no `bg.inverse`: el azul de marca **no cambia entre modos**,
> mientras que `bg.inverse` en oscuro se remapea a la superficie del tema y la tarjeta destacada
> quedaba igual que las otras tres.

## Sizes

Sin sizes. El ancho lo da la grilla: **4 columnas con gap de 18 px**. El alto se adapta al
contenido, y las tarjetas de una misma fila **igualan alto** — la tarjeta ocupa `height: 100%` de
su celda de grilla. Sin eso cada una mide lo que su contenido y los pies de métricas quedan a
distinta altura entre vecinas, visible en cuanto dos títulos ocupan distinto número de líneas.

## States

| State | Descripción | Tokens |
|---|---|---|
| `default` | En reposo | `card.shadow` → `elevation.surface` |
| `hover` | Tarjeta clickeable bajo el puntero | **Borde en verde agua** `border.action` + `elevation.raised`, `motion.fast` |
| `focus` | Foco por teclado, si es navegable | `focus.ring` |
| `overdue` | Vencida | Pie **relleno** en `card.footer.overdue.bg`, texto en `card.footer.overdue.text`, borde de tarjeta 1,5 px `state.urgent.full` |

> **El hover de la tarjeta clicable marca el borde en verde agua.** Es la regla de interacción del
> producto: el verde agua señala lo accionable. La elevación se mantiene porque no la contradice.
> Sólo aplica cuando la tarjeta tiene destino (`href`).

En **modo oscuro**: fondo `#1B202C`, **sin borde** — la separación la da el contraste de
superficie (ver [elevation](../foundations/elevation.md)).

## Spacing & sizing rules

- **Radio:** 14 px (`radius.surface`).
- **Padding interno:** `space.4` (16 px).
- **Gap entre bloques internos:** `space.2` (8 px).
- **Gap de grilla:** `space.18` (18 px).
- **Borde:** 1 px `#DFE1E7` en modo claro; ninguno en oscuro.
- **Sombra:** `0 1px 3px rgba(11,25,52,.04)`, la única en reposo. La `task-overdue` y la
  `metric` con `emphasis` **no llevan sombra**.
- **Iconos de metadatos:** 14 px.
- **Pie de métricas:** grilla de 3 columnas iguales, gap `space.1` (4 px), padding 11 px vertical y
  `space.2` (8 px) horizontal, texto centrado, borde superior de 1 px, a sangre.
- **Borde de la `task-overdue`:** 1,5 px en `state.urgent.full`.

## Accesibilidad

- **Una tarjeta clickeable en su totalidad DEBE** exponer un solo destino accesible: el título como
  enlace, y el resto de la superficie como zona ampliada del mismo enlace. **NO SE DEBEN** anidar
  controles dentro de un contenedor clickeable.
- El estado va en un [badge](./badge.md) con **punto + texto**, no en el color del borde.
- El vencimiento se comunica con **texto** («vencido hace 1 día») además del relleno del pie. El
  pie relleno cambia forma percibida y color a la vez, pero **el texto sigue siendo obligatorio**.
- **Contraste del pie vencido:** texto blanco sobre rojo pleno `#F72C25`, con el dato en peso 700.
- **Contraste de la métrica destacada:** verde agua `#61CCB9` sobre azul oscuro `#0B1934` — 9.8:1;
  es el mismo par que el stepper usa para lo recorrido.
- La jerarquía usa encabezados reales: el título de la tarjeta es un heading del nivel que
  corresponda a la vista, no un `div` con tamaño.
- `focus.ring` visible cuando la tarjeta es navegable por teclado.

## Guidelines de contenido

- **Título:** el nombre de la entidad, sin prefijos redundantes.
- **Descripción:** una o dos líneas; se trunca con elipsis, no se recorta a media palabra.
- **Métricas del pie:** label en versalitas y valor abreviado — «Creación · 279 d».
- **Sin datos en un campo:** «N/D», explícito.

## Do's & don'ts

**Do:**

- Usar una sola sombra en reposo, y en hover el **borde verde agua** con `elevation.raised`.
- Rellenar el pie de rojo pleno **únicamente** cuando la tarea está vencida.
- Igualar el alto de las tarjetas de una misma fila con `height: 100%`.
- Reservar `emphasis` para **una** tarjeta de métrica por fila.

**Don't:**

- **NO SE DEBE** poner borde y sombra fuerte a la vez.
- **NO SE DEBE** abrir una sexta variant para la métrica destacada: es la prop `emphasis` sobre
  `metric`.
- **NO SE DEBE** usar `emphasis` en más de una tarjeta de la misma fila.
- **NO SE DEBE** declarar la tipografía de las columnas del pie desde el pie: la declara el
  componente que renderiza cada par label + dato.
- **NO SE DEBE** usar color de fondo de sistema en la superficie de la tarjeta: el estado va en el
  badge.
- **NO SE DEBE** usar borde en modo oscuro.
- **NO SE DEBE** anidar tarjetas.

## API

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `variant` | `"project" \| "task" \| "task-overdue" \| "panel" \| "metric"` | `"panel"` | Tipo de tarjeta |
| `title` | `string` | — | Título visible |
| `href` | `string` | — | Destino si la tarjeta es navegable. Activa el hover de borde verde agua |
| `status` | Badge props | — | Estado mostrado en la cabecera |
| `tags` | `{ label, family?, glyph? }[]` | — | Etiquetas `card-tag`; `glyph` elige cuadrado o círculo (ver [Badge](./badge.md#glyph-la-forma-de-la-etiqueta)) |
| `metrics` | `{ label, value, overdue? }[]` | — | Pie de métricas. En `metric` se usa **sólo la primera** como cifra destacada |
| `emphasis` | `boolean` | `false` | **Sólo `metric`:** fondo azul oscuro y cifra en verde agua. Una por fila |
| `headingLevel` | `"h2" \| "h3" \| "h4"` | `"h3"` | Nivel del heading del título; lo elige el consumidor según la vista |

**Slots:** `children` (contenido del `panel`), `header`, `footer`.

## Migración

| Hoy | Usos | Pasa a |
|---|---|---|
| `SectionCard` | 7 | `variant="panel"` |
| `Card` | **0 — código muerto exportado desde el barrel** | Se elimina del barrel |
| Radio `--radius-cards` (1rem / 16 px) | — | **14 px** |
| Pie de métricas como fila flex | — | Grilla de 3 columnas centradas, a sangre sobre el fondo hundido |
| Paginaciones y tarjetas inline | — | Este componente |

## Componentes y patterns relacionados

- [Badge](./badge.md) — estado y etiquetas.
- [Accordion](./accordion.md) — sección plegable dentro de un panel.
- [Empty state](./empty-state.md) — cuando la grilla no tiene tarjetas.
- [Dropzone](./dropzone.md) — vive dentro de un `panel`.

## Historial

- **1.1.0** (2026-09-04) — Se agrega la prop **`emphasis`** para la tarjeta de métrica destacada
  (fondo azul oscuro `bg.brand-deep`, cifra en verde agua, sin borde ni sombra). Es prop y **no una
  variant nueva** a propósito: el destaque es una decisión del consumidor sobre una tarjeta que ya
  es `metric`, y así el set de variants sigue cerrado en cinco. Aditivo y backward compatible.
  En el mismo corte se corrige la especificación del pie de métricas contra el código: pasa de
  **fila flex a grilla de tres columnas centradas** sobre el fondo hundido, con borde superior y a
  sangre; la tarjeta **vencida rellena el pie de rojo pleno con texto blanco** (la v1.0.0 sólo
  cambiaba el color del texto) y lleva borde de 1,5 px sin sombra; las tarjetas de una fila igualan
  alto con `height: 100%`; y el **hover de la tarjeta clicable marca el borde en verde agua**
  (`border.action`). Se documentan `headingLevel` y el `glyph` de las etiquetas, ya presentes en el
  componente (MINOR).
- **1.0.0** (2026-09-02) — Spec nuevo, desde el Manual de marca Jiku v1.0: radio 14 px, borde claro
  y sombra mínima, cinco variants, pie de métricas teñido sólo en vencimiento y comportamiento en
  modo oscuro sin borde (MINOR sobre el DS).
