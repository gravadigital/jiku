---
tokens: semantic
version: 2.1.0
last_updated: 2026-09-04
status: normativo
origin: Manual de marca Jiku v1.0 (septiembre 2026)
---

# Tokens — Semantic (alias)

> **Normativo.** Reemplaza el placeholder genérico. Los mapeos de abajo cambian **todos** respecto
> del tier semántico anterior: `bg.action.primary` deja de ser azul/magenta y pasa a verde agua.

## Propósito

Tier 2 de la jerarquía. Cada semántico mapea a un primitivo de
[`reference.md`](./reference.md) y comunica **intención** (`bg.action.primary`), no apariencia
(`color.aqua`). **Los componentes consumen estos semánticos, NUNCA los primitivos.**

Todo valor es un primitivo, con la sola excepción de los literales que el DS declara así:
`transparent`, `none` y los verdes agua con alfa (`rgba(97,204,185,…)`).

## Background

| Token | Valor | Uso |
|---|---|---|
| `bg.canvas` | `color.mist` | Fondo de aplicación en modo claro |
| `bg.surface` | `color.white` | Tarjetas, paneles, inputs, documentos |
| `bg.surface.sunken` | `color.mist` | Superficie de apoyo dentro de una tarjeta |
| `bg.inverse` | `color.deep-blue` | Overlay del modal, fondo del tooltip — **sigue al tema** |
| `bg.brand-deep` | `color.deep-blue` | Panel del login, cabecera de tabla densa, avatares, cifra destacada — **fijo en ambos modos** |
| `bg.action.primary` | **`color.aqua`** | Fondo de botón primario |
| `bg.action.primary.hover` | `color.aqua-hover` | Hover del botón primario (aclara, no oscurece) |
| `bg.action.secondary` | `transparent` | Botón secundario (outline) |
| `bg.action.disabled` | `color.mist` | Control deshabilitado |
| `bg.tint.neutral` | `color.gray.100` | Chips y campos sin valor |
| `bg.active` | `color.aqua` | Barra e indicador de ítem activo |
| `bg.active.subtle` | `rgba(97,204,185,.08)` | Hover apenas perceptible de controles y skeletons — verde agua al 8 % |
| `bg.accent-soft` | `rgba(97,204,185,.14)` | Relleno de acento con presencia propia: subítem activo del sidebar, barra de proporción |
| `surface.sidebar` | `color.mist` | Superficie del sidebar |
| `bg.field` | `color.white` | Fondo de campo de formulario |
| `bg.row-alt` | `color.mist` | Fila alterna de tabla, pie de card |
| `border.dashed` | `color.gray.300` | Borde punteado del dropzone |

> **`bg.brand-deep` y `bg.inverse` no son el mismo rol, aunque en claro valgan lo mismo.**
> `bg.inverse` tenía dos trabajos incompatibles: overlays y tooltips, que **deben seguir al tema**,
> y superficies de **marca**, que el manual fija en azul oscuro **fijo** en los dos modos. Sin esta
> separación, la card de métrica destacada quedaba igual que las otras tres en oscuro, y la
> cabecera de la tabla densa perdía su contraste con el cuerpo.

> **`bg.accent-soft` no es `bg.active.subtle`.** El 8 % es el hover apenas perceptible de una
> docena de controles; el 14 % es un relleno con presencia propia. Roles distintos, no dos
> intensidades del mismo.

> **`surface.sidebar`, `bg.field`, `bg.row-alt` y `border.dashed` se declaran en LOS DOS modos.**
> Un token cuyo único valor viviera en el bloque oscuro quedaría sin definir en claro (regla del
> tier — ver [styling](../../../architectures/web/conventions/styling.md)).

### Semáforo de carga

Los tres estados de un chip de día en la carga de horas. **No son las familias de estado:** esas
pesan al revés.

| Token | Valor | Uso |
|---|---|---|
| `status.load.complete` | `color.aqua-deep` | Carga completa |
| `status.load.partial` | `color.system.medium` | Carga parcial |
| `status.load.empty` | `color.gray.300` | Sin carga |

> **El peso visual de los tres estados es deliberadamente desigual.** «Completo» es el estado que
> se busca de un vistazo; «sin carga» el que no debe llamar la atención.

### Modo oscuro

El modo oscuro es una **paleta propia del DS, no una inversión de la clara.** El acento
(`bg.action.primary`, `bg.active`, `border.action`, `border.focus`, `border.required`,
`text.on-action`) **no se redeclara:** no cambia entre modos.

| Token | Valor en oscuro |
|---|---|
| `bg.canvas` | `color.dark.canvas` |
| `bg.surface` | `color.dark.surface` |
| `bg.surface.sunken` | `color.dark.row-alt` |
| `bg.inverse` | `color.dark.surface` |
| `bg.action.disabled` | `color.dark.row-alt` |
| `bg.tint.neutral` | `color.dark.tint.graphite` |
| `bg.accent-soft` | `rgba(97,204,185,.16)` |
| `surface.sidebar` | `color.dark.sidebar` |
| `bg.field` | `color.dark.input-bg` |
| `bg.row-alt` | `color.dark.row-alt` |
| `border.dashed` | `color.dark.dash` |
| `border.default` | `color.dark.border` |
| `border.strong` | `color.dark.primary` |
| `text.primary` | `color.dark.text` |
| `text.body` | `color.dark.body` |
| `text.secondary` | `color.dark.primary` |
| `text.disabled` | `color.dark.placeholder` |
| `text.inverse` | `color.dark.text` |
| `text.link` | **`color.aqua`** |
| `elevation.surface` | `shadow.dark.card` |
| `elevation.raised` | `shadow.dark.active` |
| `focus.ring` | `shadow.dark.focus` |

> **La relación de superficies del manual:** el sidebar es **más oscuro** que el canvas; la card,
> **más clara**.

> **`text.link` es la única excepción a «el acento no cambia».** El manual dice que en oscuro el
> TEXTO verde pasa al **verde agua**: el verde profundo no alcanza AA sobre las superficies oscuras
> (**3.79:1** sobre la superficie de card). El enlace se aclara aunque el acento de fondo siga
> siendo el mismo. Medido en `styles/dark-mode-tints.test.ts`.

> `bg.brand-deep` **no aparece en esta tabla a propósito:** es la superficie de marca, y su valor
> es el mismo en los dos modos.

## Text

| Token | Valor | Uso |
|---|---|---|
| `text.primary` | `color.deep-blue` | Títulos, jerarquía, texto principal |
| `text.body` | `color.ink` | Cuerpo de texto |
| `text.secondary` | `color.gray.600` | Labels, metadatos, nivel padre del breadcrumb |
| `text.disabled` | `color.gray.400` | Placeholders, texto inactivo |
| `text.inverse` | `color.mist` | Texto sobre fondo oscuro |
| `text.on-action` | **`color.deep-blue`** | Texto sobre el botón primario verde agua |
| `text.on-urgent` | `color.white` | Texto sobre un relleno de estado **pleno** (hoy sólo el pie de la card vencida) |
| `text.on-inverse-muted` | `color.dark.primary` | Texto atenuado sobre el fondo de marca azul oscuro |
| `text.link` | **`color.aqua-deep`** | Enlaces y texto verde sobre fondo claro |
| `text.dark` | `color.dark.text` | Texto en modo oscuro |

> **`text.link` es `#12897A`, no `#61CCB9`.** El verde agua sobre blanco da 1.9:1 y **nunca** se
> usa para texto **en modo claro**. En oscuro sí: ver la tabla de modo oscuro.

> **`text.on-urgent` no es `text.inverse`.** `text.inverse` es la niebla sobre azul oscuro; acá el
> fondo es rojo saturado y el texto va en blanco.

> **`text.on-inverse-muted` tiene el mismo valor en los dos modos**, porque el fondo de marca
> tampoco cambia. El secundario claro no contrasta sobre azul oscuro, y el gris de la paleta oscura
> es justo el rol que corresponde.

## Border

| Token | Valor | Uso |
|---|---|---|
| `border.default` | `color.gray.200` | Bordes de 1 px, divisores, borde de input |
| `border.emphasis.width` | `border.width.emphasis` | Grosor de 1,5 px: secundarios y stepper actual |
| `border.strong` | `color.graphite` | Borde de estructura con más peso |
| `border.action` | `color.aqua` | Borde de botón secundario de navegación |
| `border.focus` | `color.aqua` | Borde del elemento con foco |
| `border.required` | `color.aqua` | Marca de obligatoriedad en campos |

## Feedback de estado

Los estados **no son marca**. Cada familia trae pleno, tinte, borde y texto.

| Token | Pleno | Tinte | Borde | Texto |
|---|---|---|---|---|
| `state.resolved` | `color.system.resolved` | `color.tint.green` | `color.tint-border.green` | `color.deep.green` |
| `state.in-progress` | `color.system.resolved` | `color.tint.aqua` | `color.tint-border.aqua` | `color.deep.green` |
| `state.review` | `color.system.medium` | `color.tint.amber` | `color.tint-border.amber` | `color.deep.amber` |
| `state.urgent` | `color.system.urgent` | `color.tint.red` | `color.tint-border.red` | `color.deep.red` |
| `state.analysis` | `color.system.analysis` | `color.tint.violet` | `color.tint-border.violet` | `color.deep.violet` |
| `state.neutral` | `color.graphite` | `color.tint.graphite` | `color.tint-border.graphite` | `text.secondary` |

### En modo oscuro

Las seis familias redeclaran **tinte, borde Y texto**. El pleno no cambia.

| Token | Tinte | Borde | Texto |
|---|---|---|---|
| `state.resolved` | `color.dark.tint.green` | `color.dark.tint-border.green` | `color.dark.deep.green` |
| `state.in-progress` | `color.dark.tint.aqua` | `color.dark.tint-border.aqua` | `color.dark.deep.aqua` |
| `state.review` | `color.dark.tint.amber` | `color.dark.tint-border.amber` | `color.dark.deep.amber` |
| `state.urgent` | `color.dark.tint.red` | `color.dark.tint-border.red` | `color.dark.deep.red` |
| `state.analysis` | `color.dark.tint.violet` | `color.dark.tint-border.violet` | `color.dark.deep.violet` |
| `state.neutral` | `color.dark.tint.graphite` | `color.dark.tint-border.graphite` | `color.dark.deep.graphite` |

> **El texto es lo que antes no se redeclaraba.** Cada familia conservaba su profundo del modo
> claro sobre un tinte oscuro: el violeta daba **1.38:1**, el ámbar **2.07:1**, y las **seis**
> fallaban AA. Con estos valores dan entre **7.2:1 y 9.9:1**.

## Tipografía

| Token | Valor | Uso |
|---|---|---|
| `text.view-title` | `font.family.display` · 30 · 700 · `tracking.tight` · `leading.title` | Título de vista |
| `text.login-title` | `font.family.display` · 44 · 700 · `tracking.tight` · `leading.display` | Título del login |
| `text.metric` | `font.family.display` · 34 · 700 | Cifra destacada |
| `text.metric-unit` | `font.family.ui` · 10 · 600 · `tracking.caps-wide` | Unidad en versalitas |
| `text.card-title` | `font.family.ui` · 16 · 700 | Título de tarjeta y panel |
| `text.entity-title` | `font.family.display` · 19 · 700 · `tracking.snug` | Título de fila/card de entidad |
| `text.nav-item` | `font.family.ui` · 15 · 500 | Ítem de sidebar |
| `text.body-default` | `font.family.ui` · 14 · 400 · `leading.body` | Cuerpo |
| `text.field-label` | `font.family.ui` · 13 · 400 | Label de campo |
| `text.table-data` | `font.family.ui` · 13 · 400 · `leading.table` | Dato en tabla |
| `text.filter-label` | `font.family.ui` · 11 · 600 · `tracking.caps` | Label de filtro, versalitas |
| `text.table-header` | `font.family.ui` · 11 · 600 · `tracking.caps-table` | Label de cabecera de tabla |
| `text.card-metric.label.size` | `font.size.9` | Label del pie de métricas de la card de tarea |
| `text.card-metric.value.size` | `font.size.13` | Dato del pie de métricas |
| `text.fab.glyph.size` | `font.size.17` | Glifo «+» del FAB de sección |
| `text.wordmark` | `font.family.display` · 19 · 700 | Wordmark en el sidebar |

> **`text.entity-title` va en Sora, no en la UI.** El manual lo distingue del título de card
> genérico —que sí es Gabarito 16— porque nombra **una entidad del dominio** (actor, proyecto,
> tarea) y no una sección.

> **`text.login-title` es el mismo display que el título de vista, pero en 44px** y con la
> interlínea más cerrada que el manual fija para los tamaños grandes.

> **`text.table-header` es más cerrado que `text.filter-label`** (.08em contra .12em): la cabecera
> de tabla tiene más columnas en menos ancho.

> El label del pie de métricas es el **texto más chico del sistema** (9px en versalitas). Su dato
> va en 12px/600, o 700 cuando la tarea está vencida.

## Espaciado

| Token | Valor | Uso |
|---|---|---|
| `space.inline.sm` | `space.1` | Gap glifo–texto |
| `space.inline.md` | `space.2` | Gap inline en pills y badges |
| `space.padding.card` | `space.4` | Padding interno de tarjeta |
| `space.stack.md` | `space.4` | Separación entre bloques |
| `space.grid.gap` | `space.18` | Gap de la grilla de tarjetas |
| `space.tabs.gap` | `space.26` | Separación entre tabs de una fila |
| `space.padding.content` | `space.8` | Padding del área de contenido |
| `space.stack.section` | `space.8` | Separación entre secciones |

> **`space.tabs.gap` es más abierto que el gap de grilla** porque cada tab lleva subrayado propio y
> necesita despegarse de sus vecinas.

## Forma y elevación

| Token | Valor | Uso |
|---|---|---|
| `radius.action` | `radius.8` | Botones |
| `radius.field` | `radius.10` | Inputs, selects, botón de sesión |
| `radius.surface` | `radius.14` | Tarjetas, paneles, dropzone |
| `radius.pill` | `radius.999` | Pills, badges, chips, toggles |
| `radius.glyph.corner` | `radius.glyph` | Redondeo del glifo cuadrado de la etiqueta de card |
| `elevation.surface` | `shadow.card` | Tarjeta en reposo |
| `elevation.raised` | `shadow.active` | Elemento activo o flotante |
| `focus.ring` | `shadow.focus` | Anillo de foco, único del sistema |
| `step.ring` | `shadow.step-ring` | Anillo decorativo del nodo actual del stepper |

> **`radius.glyph.corner` no es un radio de superficie:** la escala de superficies queda cerrada en
> `action` / `field` / `surface` / `pill`.

> **`step.ring` no es `focus.ring`:** el anillo del nodo actual es decoración, no foco de teclado.

## Layout

| Token | Valor | Uso |
|---|---|---|
| `nav.width` | `layout.sidebar.width` | Ancho del sidebar (300px) |

## Reglas

- **Los componentes consumen semánticos, NUNCA primitivos.**
- **Cambiar el mapeo de un semántico = MAJOR** (rompe consumidores).
- **Agregar un semántico nuevo = MINOR.**
- Ajustar el valor de un primitivo se hace en [`reference.md`](./reference.md), no acá.
- **NO SE DEBE** crear un semántico que nombre apariencia (`bg.green`): nombra rol
  (`bg.action.primary`).
- **Un token no puede tener su único valor en el bloque de modo oscuro.** Si un rol aparece en
  oscuro, se declara también en claro.

## Historial

- 2026-09-04 v2.1.0 — Se separa `bg.brand-deep` (superficie de marca, fija en ambos modos) de
  `bg.inverse` (overlays y tooltips, que siguen al tema), y `bg.accent-soft` (14 % / 16 %) de
  `bg.active.subtle` (8 %). Se agregan `bg.action.primary.hover`, el semáforo `status.load.*`,
  `surface.sidebar`, `bg.field`, `bg.row-alt`, `border.dashed`, `border.emphasis.width`,
  `text.on-urgent`, `text.on-inverse-muted`, las tipografías `text.login-title`,
  `text.entity-title` y `text.table-header`, los tamaños `text.card-metric.*` y `text.fab.glyph`,
  `space.tabs.gap`, `radius.glyph.corner` y `step.ring`. Se documenta la tabla completa de modo
  oscuro: los seis `state.*.text` **ahora sí se redeclaran** (antes las seis familias fallaban AA)
  y `text.link` pasa al verde agua. `text.metric-unit` corrige su valor documentado a 10px con
  `tracking.caps-wide`. Todo additivo (MINOR).
- 2026-09-02 v2.0.0 — Remapeo completo al Manual de marca Jiku v1.0. `bg.action.primary` pasa a
  verde agua con `text.on-action` en azul oscuro; `text.link` a verde profundo `#12897A`; se
  agregan `bg.active.subtle` (8 %), la matriz de feedback de estado con tinte/borde/texto por
  familia, los diez estilos tipográficos y los tokens de forma y elevación (MAJOR).
- 2026-08-18 v0.1.0 — Placeholder inicial.
