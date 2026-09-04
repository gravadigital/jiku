---
tokens: component
version: 3.0.0
last_updated: 2026-09-04
status: normativo
origin: Manual de marca Jiku v1.0 (septiembre 2026)
---

# Tokens — Component-level

> **Normativo.** Reemplaza el placeholder. Cubre las familias de componentes que el Manual de
> marca Jiku v1.0 especifica.

## Propósito

Tier 3 de la jerarquía. Cada token nombra **una propiedad de un componente**, y resuelve a un
token semántico de [`semantic.md`](./semantic.md).

Formato: `{componente}.{variant}.{propiedad}.{estado}`

Familias declaradas: `button` (con sesión, flujo y FAB), `input`, `select`, `badge`, `card`,
`table`, `nav` (sidebar), `tab`, `stepper`, `toggle` + `range-pill`, `empty`, `dropzone`,
`accordion`, `avatar`, `loader`, `tooltip`, `pagination`, `login-panel`.

## Button

```
button.radius              : radius.action        /* 8px */
button.height              : size.40
button.font                : text.body-default

button.primary.bg          : bg.action.primary    /* #61CCB9 */
button.primary.bg.hover    : bg.action.primary.hover
button.primary.text        : text.on-action       /* #0B1934 */
button.primary.border      : transparent

button.disabled.bg         : bg.action.disabled   /* niebla */
button.disabled.text       : text.disabled        /* #9AA1AC */
button.disabled.border     : border.default

button.secondary.bg        : bg.action.secondary  /* transparent */
button.secondary.text      : text.primary
button.secondary.border.width   : border.emphasis.width   /* 1,5px, no 1px */
button.secondary.border.nav     : border.action   /* verde agua — navegar */
button.secondary.border.dismiss : border.default  /* borde claro — descartar */

button.session.radius      : radius.field         /* 10px */
button.session.height      : size.46

button.flow.bg             : bg.brand-deep        /* azul oscuro */
button.flow.text           : text.inverse
button.flow.icon           : bg.action.primary    /* la flecha, en verde agua */

button.fab.size            : size.28
button.fab.glyph           : text.fab.glyph.size  /* 17px */

button.focus               : focus.ring
```

> **La acción de flujo («Pasar a Planificación →») va en AZUL OSCURO, no en verde agua.** Con el
> fondo de acento y el texto azul quedaba idéntica al botón primario: **dos primarios compitiendo
> en la misma vista**. El manual la fija en azul oscuro con texto claro y **la flecha** en verde
> agua.

> **El borde de los secundarios es de 1,5px**, más marcado que el borde de 1px de las superficies.

## FAB de sección

El FAB es un control chico que vive en la cabecera de una card: **28px con el «+» en 17px**, no la
altura de botón.

```
fab.radius   : radius.pill
fab.bg       : bg.action.primary
fab.icon     : text.on-action
```

> `fab` **hereda** radio, alto y colores de la variante `primary`; su geometría propia se declara
> como `button.fab.size` / `button.fab.glyph`.

## Input

```
input.radius            : radius.field    /* 10px */
input.height            : size.44
input.bg                : bg.field
input.text              : text.primary
input.placeholder       : text.disabled
input.border            : border.default
input.border.focus      : border.focus
input.focus.ring        : focus.ring      /* anillo 3px al 22% */
input.label             : text.field-label
input.required.mark     : border.required /* asterisco verde agua */
input.locked.bg         : bg.surface.sunken
input.locked.text       : text.secondary
input.icon.size         : icon.16
```

> **`input.bg` resuelve por `bg.field`, no por la superficie de card.** En oscuro el campo es **más
> hundido** que la card que lo contiene; en claro los dos resuelven a blanco.

## Select y multiselección

```
select.radius        : radius.field
select.height        : size.44
select.bg            : bg.surface
select.text          : text.primary
select.border        : border.default
select.border.focus  : border.focus
select.chevron       : text.secondary
select.chip.bg       : bg.tint.neutral
select.chip.radius   : radius.pill
select.chip.remove   : text.secondary
```

## Badge / pill de estado

```
badge.radius        : radius.pill
badge.glyph.radius  : radius.glyph.corner   /* 3px — el cuadrado de 10×10 */
badge.dot.size      : 8px
badge.font          : text.filter-label
badge.bg            : {state}.tint
badge.border        : {state}.border
badge.text          : {state}.text
badge.dot           : {state}.pleno

badge.editable.chevron : text.secondary
badge.empty.bg         : bg.tint.neutral      /* campo sin valor */
badge.current.bg       : bg.action.primary    /* estado actual, verde agua pleno */
```

## Card

```
card.radius          : radius.surface   /* 14px */
card.bg              : bg.surface
card.border          : border.default
card.shadow          : elevation.surface
card.padding         : space.padding.card
card.title           : text.card-title
card.body            : text.body-default
card.meta            : text.filter-label
card.meta.overdue    : state.urgent.text
card.icon.size       : icon.14

card.footer.bg               : bg.row-alt
card.footer.overdue.bg       : state.urgent.pleno   /* el único rojo pleno del sistema */
card.footer.overdue.text     : text.on-urgent

card.metric.emphasis.bg      : bg.brand-deep
card.metric.emphasis.value   : bg.action.primary
card.metric.emphasis.label   : text.on-inverse-muted
```

> **El pie de métricas** de la card de tarea se apoya en el fondo hundido, y cuando la tarea está
> **vencida** se rellena de rojo **pleno** — el único uso de rojo pleno del sistema.

> **La card de métrica destacada** (la primera de la fila) va sobre el fondo de **marca** con la
> cifra en verde agua. Su label usa el gris de la paleta oscura, porque sobre azul oscuro el
> secundario claro no contrasta. Resuelve por `bg.brand-deep` y **no** por `bg.inverse`: si
> siguiera al tema, en oscuro quedaría igual que las otras tres.

> **`card.bg.dark` y `card.border.dark` se removieron**, junto con el bloque de modo oscuro de
> `Card` que los consumía.
>
> No aportaban nada al fondo: `card.bg.dark` resolvía al mismo `bg.surface` que `card.bg`, y la
> superficie por modo ya la resuelven los tiers. Lo que sí hacían era **romper dos cosas por
> especificidad** (0,2,1 contra la 0,1,0 de una clase suelta): borraban el borde de **toda** card en
> oscuro —incluido el rojo de 1,5 px de la card vencida— y pisaban el fondo azul de la **card de
> métrica destacada**, que quedaba igual que las otras tres.

## Table

```
table.row.height          : size.48
table.font                : text.table-data
table.data.font           : text.table-data
table.border              : border.default

table.header.font         : text.table-header          /* familia */
table.header.size         : text.table-header.size     /* 11px */
table.header.weight       : text.table-header.weight   /* 600 */
table.header.tracking     : text.table-header.tracking /* .08em */

table.header.light.bg     : bg.row-alt       /* default — la cabecera de todo el producto */
table.header.light.text   : text.secondary
table.header.bg           : bg.brand-deep    /* variant `dense`, sin consumidores */
table.header.text         : text.inverse

table.row.hover.bg        : bg.surface.sunken
```

> **`light` es el default y la cabecera de todos los listados y reportes.** Resuelve por
> `bg.row-alt` y **no** por `bg.surface.sunken`: los dos dan el mismo valor en ambos modos, pero el
> handoff nombra `row-alt` para la cabecera de la tabla clara **y** para la fila alterna, que son la
> misma superficie. Usar el token del rol correcto evita que un cambio futuro en uno de los dos
> desalinee cabecera y filas.

> **`table.header.bg` / `table.header.text` son los de la variant `dense`, que quedó sin
> consumidores.** No se borran —la API la sigue aceptando y sus tokens siguen resueltos— pero no hay
> caso de uso vigente. Ver [`table.md`](../components/table.md#por-qué-se-cayó-el-criterio-de-las-dos-densidades).

> Cuando se usa, la cabecera densa resuelve por `bg.brand-deep`, no por `bg.inverse`: es una pieza
> de identidad, y si siguiera al tema perdería en oscuro su contraste con el cuerpo de la tabla.

## Sidebar nav

```
nav.width               : layout.sidebar.width   /* 300px */
nav.bg                  : surface.sidebar
nav.item.height         : size.48
nav.subitem.indent      : size.44
nav.item.font           : text.nav-item
nav.icon.size           : icon.22
nav.subicon.size        : icon.19

nav.item.active.bg      : bg.surface            /* tarjeta blanca */
nav.item.active.bar     : bg.active             /* barra verde agua 3px */
nav.item.active.shadow  : elevation.raised
nav.item.active.icon    : text.link
nav.subitem.active.bg   : bg.accent-soft        /* verde agua 14% (16% en oscuro) */
nav.item.icon           : color.graphite        /* inactivo */
nav.wordmark            : text.wordmark

nav.logout.bg           : bg.action.primary
nav.logout.bg.hover     : bg.action.primary.hover
nav.logout.text         : text.on-action
nav.logout.height       : size.46
nav.logout.radius       : radius.field
```

> **El sidebar tiene superficie propia** (`nav.bg` → `surface.sidebar`): en oscuro es **más oscuro**
> que el canvas, al revés de la card, que es más clara. En claro ambos son la niebla.

> **«Cerrar sesión» es el botón de SESIÓN del manual** (verde agua, alto 46, radio 10), el mismo que
> el «Iniciar sesión» del login. Antes era texto pelado.

> **`nav.item.icon` es la única fuga de color del tier:** apunta a un primitivo
> (`color.graphite`) en vez de a un semántico, así que **no cascadea solo** desde el bloque oscuro
> del tier 2 y necesita su propia redeclaración en oscuro (`color.dark.primary`).
>
> `nav.item.active.icon` (`text.link`) **no se redeclara pero sí cambia de valor entre modos**: en
> oscuro `text.link` pasa al verde agua. Es justo lo que el manual pide para el ítem activo, así que
> hereda el cambio.

## Tabs

```
tab.font            : text.body-default
tab.text            : text.secondary
tab.text.active     : text.primary
tab.indicator       : bg.active
tab.active.border   : border.action
tab.gap             : space.tabs.gap    /* 26px */

tab.count.size         : size.19
tab.count.bg           : bg.tint.neutral
tab.count.text         : text.disabled
tab.count.active.bg    : bg.active
tab.count.active.text  : text.on-action
```

> **El contador de la tab ACTIVA va en pill de acento; el de las inactivas, en tinte neutro.**

> **Divergencia de nomenclatura con la capa de tokens del servicio.** `web` declara los dos tokens
> de texto como `--tab-active-text` / `--tab-inactive-text`, no como `tab.text.active` / `tab.text`.
> El nombre normativo es el de este documento y el del spec
> [`tabs.md`](../components/tabs.md); el valor resuelto es el mismo.

## Stepper

```
stepper.node.size      : size.34             /* diámetro del nodo */
stepper.active.bg      : bg.active
stepper.inactive.bg    : bg.tint.neutral
stepper.text           : text.primary
stepper.done.bg        : bg.action.primary   /* verde agua pleno */
stepper.done.icon      : text.on-action
stepper.current.ring   : step.ring           /* anillo 4px al 20% — decoración */
stepper.current.text   : text.primary
stepper.pending.bg     : bg.surface
stepper.pending.border : border.default
stepper.pending.text   : text.disabled
stepper.connector      : border.default
```

> **`stepper.current.ring` es `step.ring`, no `focus.ring`.** El anillo del nodo actual es
> **decoración** (4px al 20 %), no foco de teclado (3px al 22 %).

## Toggle segmentado y pills de rango

```
toggle.radius         : radius.field      /* 10px — es una CAJA, no una pill */
toggle.option.radius  : radius.action
toggle.bg             : bg.tint.neutral
toggle.active.bg      : bg.active
toggle.inactive.bg    : bg.tint.neutral
toggle.item.text      : text.secondary
toggle.item.active.text : text.on-action

range-pill.radius     : radius.pill
range-pill.bg         : bg.tint.neutral
range-pill.active.bg  : bg.active
```

> **El contenedor segmentado va en radio 10, no en pill.** Es una caja con opciones adentro; **las
> opciones** sí son pill.

### Semáforo del chip de día

Punto de 6px debajo del label, en la carga de horas.

```
toggle.status.dot.size  : 6px
toggle.status.completed : status.load.complete   /* verde profundo */
toggle.status.partial   : status.load.partial    /* ámbar */
toggle.status.empty     : status.load.empty      /* gris claro */
```

> **El peso visual de los tres estados NO es el mismo, y esa es la idea:** «carga completa» es el
> estado que se busca de un vistazo y «sin carga» el que no tiene que llamar la atención.
>
> La primera versión usaba los **plenos de las familias de estado** y quedaba al revés: el grafito
> de `neutral` pesaba **más** que el verde de `resolved` (**5.34** contra **3.51** de contraste
> sobre el chip blanco), así que «sin carga» gritaba y «completa» apenas se veía — y entre ellos
> había **1.52** de diferencia, prácticamente indistinguibles.
>
> | Estado | Ahora | Antes |
> |---|---|---|
> | completa | verde profundo — **4.30** | 3.51 |
> | parcial | ámbar — sin cambio | igual |
> | sin carga | gris claro — **1.55** | 5.34 |
>
> El ámbar no cambia: ya estaba en el medio, que es donde corresponde.

## Empty state

```
empty.text        : text.secondary
empty.icon.color  : text.secondary
empty.bg          : bg.surface.sunken
empty.radius      : radius.surface
```

> **Divergencia de nomenclatura con la capa de tokens del servicio.** `web` declara el color de
> texto como `--empty-text-color` (y el del ícono como `--empty-icon-color`), no como `empty.text`.
> El nombre normativo es el de este documento; el valor resuelto es el mismo.

## Dropzone

```
dropzone.radius       : radius.surface
dropzone.border       : border.dashed      /* punteado */
dropzone.bg           : bg.surface.sunken
dropzone.text         : text.secondary
dropzone.icon.size    : icon.24
dropzone.hover.border : border.focus
```

> **El punteado es más marcado que un borde sólido** para leerse como zona de arrastre: resuelve por
> `border.dashed` (gris 300 en claro, `color.dark.dash` en oscuro), no por `border.default`.

> `dropzone.icon.size` resuelve **directo al primitivo** `icon.24` por definición normativa: el
> sistema **no declara un tier semántico de tamaños de ícono**, así que no hay un semántico
> intermedio que agregar. Es la excepción documentada a la regla del tier.

## Accordion

```
accordion.radius        : radius.surface
accordion.border        : border.default
accordion.title         : text.card-title
accordion.header.text   : text.primary
accordion.chevron       : text.secondary
accordion.pending.mark  : state.review.pleno    /* «!» */
accordion.done.mark     : bg.action.primary     /* «✓» */

accordion.bar.width     : 3px
accordion.mark.size     : 16px
accordion.stage.radius  : radius.field          /* 10px, NO el de superficie */
```

> **El acordeón de etapa** lleva borde izquierdo de 3px del color de su estado y la marca en un
> badge circular de 16px. Su radio es **10px**, no el de superficie.

## Avatar

```
avatar.radius       : radius.pill
avatar.bg           : bg.brand-deep
avatar.text         : text.inverse
avatar.symbol.ratio : 62%
```

> **Iniciales en niebla sobre azul oscuro** (contraste 14.6:1), y **el fondo no varía por persona**:
> es el neutro de marca. Resuelve por `bg.brand-deep` —fijo en ambos modos— y no por `bg.inverse`.

## Loader

```
loader.color     : bg.action.primary
loader.duration  : duration.slow
```

## Tooltip

```
tooltip.bg      : bg.inverse
tooltip.text    : text.inverse
tooltip.radius  : radius.action
tooltip.font    : text.field-label
```

> El tooltip **sí** resuelve por `bg.inverse`: es un overlay de interfaz y **debe seguir al tema**.
> Es el contraste con `avatar.bg` y `table.header.bg`, que son piezas de marca.

## Pagination

```
pagination.item.radius   : radius.action
pagination.item.text     : text.secondary
pagination.text          : text.secondary
pagination.active.bg     : bg.active
pagination.active.text   : text.on-action
pagination.border        : border.default
```

## Panel del login

Geometría y espaciados propios de la pantalla de login.

```
login-panel.radius   : login.panel.corner   /* 22px */
login-panel.inset    : login.panel.gap      /* 22px del borde de la ventana */
login.stack          : login.stack.gap      /* 40px entre bloques */
login.header.stack   : login.title.gap      /* 14px título → bajada */
```

> **Van en el bloque base, no en el de modo oscuro:** el panel tiene el mismo radio y la misma
> separación en los dos modos, y declararlos sólo en oscuro dejaba la pantalla sin radio ni
> márgenes en claro.

> **La geometría vive fuera de la escala de radios.** Ver el bloque del panel del login en
> [`reference.md`](./reference.md#panel-decorativo-del-login).

## Reglas

- **Cada componente declara sus tokens al crearse** vía `/product-design-system-update`.
- Un component token **DEBE** resolver a un semántico, no a un primitivo ni a un hex. Las dos
  excepciones documentadas son `dropzone.icon.size` (no hay tier semántico de tamaños de ícono) y
  `nav.item.icon` (fuga histórica, con redeclaración propia en oscuro).
- **Ajustar el valor** de un component token = PATCH si es fino; MINOR si introduce un subtoken.
- **Renombrar o remover** un component token = MAJOR.

## Historial

- 2026-09-04 v3.0.0 — **Removidos `card.bg.dark` y `card.border.dark`** (MAJOR): el override de modo
  oscuro de `Card` que los consumía se retiró. Remover un token es breaking change según las reglas
  de este documento.
  `button.flow.bg` pasa de `bg.action.primary` a `bg.brand-deep` con `button.flow.text` en
  `text.inverse` y `button.flow.icon` en verde agua — con el mapeo anterior la acción de flujo era
  indistinguible del botón primario. `table.header.dense.*` se renombra a `table.header.*` y
  resuelve por `bg.brand-deep`; `avatar.bg` pasa de `bg.inverse` a `bg.brand-deep`;
  `nav.subitem.active.bg` de `bg.active.subtle` (8 %) a `bg.accent-soft` (14 %); `input.bg` de
  `bg.surface` a `bg.field`; `dropzone.border` de `border.default` a `border.dashed`;
  `stepper.current.ring` de `border.focus` a `step.ring`; `accordion.done.mark` de
  `state.resolved.pleno` a `bg.action.primary`; `toggle.radius` de `radius.pill` a `radius.field`.
  Se agregan: `button.primary.bg.hover`, `button.secondary.border.width`, `button.fab.size/glyph`,
  `select.bg/text/border/border.focus`, `badge.glyph.radius`, `card.footer.*`,
  `card.metric.emphasis.*`, la tipografía de `table.header.*` y `table.data.font`, `nav.bg`,
  `nav.logout.*`, `tab.active.border`, `tab.gap`, `tab.count.*`, `stepper.node.size`,
  `stepper.active/inactive/pending.bg`, `stepper.text`, `toggle.option.radius`,
  `toggle.active/inactive.bg`, `toggle.status.*`, `empty.icon.color`, `accordion.header.text`,
  `accordion.bar.width`, `accordion.mark.size`, `accordion.stage.radius`, `pagination.text` y la
  familia `login-panel`.
- 2026-09-02 v2.0.0 — Reemplazo completo por las once familias del Manual de marca Jiku v1.0:
  button (con sesión, flujo y FAB), input, select, badge, card, table, sidebar nav, tabs, stepper,
  toggle, empty state, dropzone, accordion, avatar, loader, tooltip y pagination. Deja de ser
  placeholder (MAJOR).
- 2026-08-18 v0.1.0 — Placeholder inicial.
