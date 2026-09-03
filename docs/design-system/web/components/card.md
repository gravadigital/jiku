---
component: Card
version: 1.0.0
last_updated: 2026-09-02
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
5. **Etiquetas** — `card-tag` y glifo de área.
6. **Pie de métricas** — versalitas 11/600 con su valor; **se tiñe sólo cuando está vencida**.

## Variants

| Variant | Propósito | Ejemplo |
|---|---|---|
| `project` | Tarjeta de proyecto en grilla | «EXO · WashMach» con rango de fechas y etiquetas |
| `task` | Tarjeta de tarea | Responsable, minutos trabajados, pie con Creación / Modif. / Cierre |
| `task-overdue` | Tarea vencida | Igual que `task`, con **el pie teñido en rojo de sistema** |
| `panel` | Panel de datos en detalle | «Información general» con pares clave–valor |
| `metric` | Métrica destacada | «2h» en Sora 34/700 + «total horas» en versalitas |

> **`task-overdue` no es una variant decorativa:** «El pie de métricas se tiñe **sólo** cuando la
> tarea está vencida». Es la única condición que cambia el color de la tarjeta.

## Sizes

Sin sizes. El ancho lo da la grilla: **4 columnas con gap de 18 px**. El alto se adapta al
contenido, y las tarjetas de una misma fila igualan alto.

## States

| State | Descripción | Tokens |
|---|---|---|
| `default` | En reposo | `card.shadow` → `elevation.surface` |
| `hover` | Tarjeta clickeable bajo el puntero | `elevation.raised`, `motion.fast` |
| `focus` | Foco por teclado, si es navegable | `focus.ring` |
| `overdue` | Vencida | Pie en `state.urgent.text` |

En **modo oscuro**: fondo `#1B202C`, **sin borde** — la separación la da el contraste de
superficie (ver [elevation](../foundations/elevation.md)).

## Spacing & sizing rules

- **Radio:** 14 px (`radius.surface`).
- **Padding interno:** `space.4` (16 px).
- **Gap entre bloques internos:** `space.2` (8 px).
- **Gap de grilla:** `space.18` (18 px).
- **Borde:** 1 px `#DFE1E7` en modo claro; ninguno en oscuro.
- **Sombra:** `0 1px 3px rgba(11,25,52,.04)`, la única en reposo.
- **Iconos de metadatos:** 14 px.

## Accesibilidad

- **Una tarjeta clickeable en su totalidad DEBE** exponer un solo destino accesible: el título como
  enlace, y el resto de la superficie como zona ampliada del mismo enlace. **NO SE DEBEN** anidar
  controles dentro de un contenedor clickeable.
- El estado va en un [badge](./badge.md) con **punto + texto**, no en el color del borde.
- El vencimiento se comunica con **texto** («vencido hace 1 día») además del color del pie.
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

- Usar una sola sombra en reposo y `elevation.raised` sólo en hover.
- Teñir el pie **únicamente** cuando la tarea está vencida.
- Igualar el alto de las tarjetas de una misma fila.

**Don't:**

- **NO SE DEBE** poner borde y sombra fuerte a la vez.
- **NO SE DEBE** usar color de fondo de sistema en la superficie de la tarjeta: el estado va en el
  badge.
- **NO SE DEBE** usar borde en modo oscuro.
- **NO SE DEBE** anidar tarjetas.

## API

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `variant` | `"project" \| "task" \| "task-overdue" \| "panel" \| "metric"` | `"panel"` | Tipo de tarjeta |
| `title` | `string` | — | Título visible |
| `href` | `string` | — | Destino si la tarjeta es navegable |
| `status` | Badge props | — | Estado mostrado en la cabecera |
| `tags` | Badge props[] | — | Etiquetas y glifo de área |
| `metrics` | `{ label, value, overdue? }[]` | — | Pie de métricas |

**Slots:** `children` (contenido del `panel`), `header`, `footer`.

## Migración

| Hoy | Usos | Pasa a |
|---|---|---|
| `SectionCard` | 7 | `variant="panel"` |
| `Card` | **0 — código muerto exportado desde el barrel** | Se elimina del barrel |
| Radio `--radius-cards` (1rem / 16 px) | — | **14 px** |
| Paginaciones y tarjetas inline | — | Este componente |

## Componentes y patterns relacionados

- [Badge](./badge.md) — estado y etiquetas.
- [Accordion](./accordion.md) — sección plegable dentro de un panel.
- [Empty state](./empty-state.md) — cuando la grilla no tiene tarjetas.
- [Dropzone](./dropzone.md) — vive dentro de un `panel`.

## Historial

- **1.0.0** (2026-09-02) — Spec nuevo, desde el Manual de marca Jiku v1.0: radio 14 px, borde claro
  y sombra mínima, cinco variants, pie de métricas teñido sólo en vencimiento y comportamiento en
  modo oscuro sin borde (MINOR sobre el DS).
