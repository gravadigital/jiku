---
tokens: component
version: 2.0.0
last_updated: 2026-09-02
status: normativo
origin: Manual de marca Jiku v1.0 (septiembre 2026)
---

# Tokens — Component-level

> **Normativo.** Reemplaza el placeholder. Cubre las once familias de componentes que el Manual de
> marca Jiku v1.0 especifica.

## Propósito

Tier 3 de la jerarquía. Cada token nombra **una propiedad de un componente**, y resuelve a un
token semántico de [`semantic.md`](./semantic.md).

Formato: `{componente}.{variant}.{propiedad}.{estado}`

## Button

```
button.radius              : radius.action        /* 8px */
button.height              : size.40
button.font                : text.body-default

button.primary.bg          : bg.action.primary    /* #61CCB9 */
button.primary.text        : text.on-action       /* #0B1934 */
button.primary.border      : transparent

button.disabled.bg         : bg.action.disabled   /* niebla */
button.disabled.text       : text.disabled        /* #9AA1AC */
button.disabled.border     : border.default

button.secondary.bg        : transparent
button.secondary.text      : text.primary
button.secondary.border.nav     : border.action   /* verde agua — navegar */
button.secondary.border.dismiss : border.default  /* borde claro — descartar */

button.session.radius      : radius.field         /* 10px */
button.session.height      : size.46

button.flow.bg             : bg.action.primary
button.flow.text           : text.on-action

button.focus               : focus.ring
```

## FAB de sección

```
fab.radius   : radius.pill
fab.bg       : bg.action.primary
fab.icon     : text.on-action
```

## Input

```
input.radius            : radius.field    /* 10px */
input.height            : size.44
input.bg                : bg.surface
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

## Select y multiselección

```
select.radius        : radius.field
select.height        : size.44
select.chevron       : text.secondary
select.chip.bg       : bg.tint.neutral
select.chip.radius   : radius.pill
select.chip.remove   : text.secondary
```

## Badge / pill de estado

```
badge.radius        : radius.pill
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

card.bg.dark         : bg.surface.dark
card.border.dark     : none
```

## Table

```
table.row.height          : size.48
table.font                : text.table-data
table.border              : border.default

table.header.light.bg     : bg.canvas        /* listado navegable */
table.header.light.text   : text.secondary
table.header.dense.bg     : bg.inverse       /* seguimiento denso */
table.header.dense.text   : text.inverse

table.row.hover.bg        : bg.surface.sunken
```

## Sidebar nav

```
nav.width               : layout.sidebar.width   /* 300px */
nav.item.height         : size.48
nav.subitem.indent      : size.44
nav.item.font           : text.nav-item
nav.icon.size           : icon.22
nav.subicon.size        : icon.19

nav.item.active.bg      : bg.surface            /* tarjeta blanca */
nav.item.active.bar     : bg.active             /* barra verde agua 3px */
nav.item.active.shadow  : elevation.raised
nav.item.active.icon    : text.link             /* #12897A */
nav.subitem.active.bg   : bg.active.subtle      /* verde agua 8% */
nav.item.icon           : color.graphite        /* inactivo */
nav.wordmark            : text.wordmark
```

## Tabs

```
tab.font            : text.body-default
tab.text            : text.secondary
tab.text.active     : text.primary
tab.indicator       : bg.active
tab.counter.bg      : bg.tint.neutral
tab.counter.text    : text.secondary
```

## Stepper

```
stepper.done.bg       : bg.action.primary   /* verde agua pleno */
stepper.done.icon     : text.on-action
stepper.current.ring  : border.focus        /* anillo */
stepper.current.text  : text.primary
stepper.pending.border: border.default
stepper.pending.text  : text.disabled
stepper.connector     : border.default
```

## Toggle segmentado y pills de rango

```
toggle.radius         : radius.pill
toggle.bg             : bg.tint.neutral
toggle.item.text      : text.secondary
toggle.item.active.bg : bg.action.primary
toggle.item.active.text : text.on-action

range-pill.radius     : radius.pill
range-pill.border     : border.default
range-pill.active.bg  : bg.action.primary
```

## Empty state

```
empty.text     : text.secondary
empty.bg       : bg.surface.sunken
empty.radius   : radius.surface
```

## Dropzone

```
dropzone.radius       : radius.surface
dropzone.border       : border.default      /* punteado */
dropzone.bg           : bg.surface.sunken
dropzone.text         : text.secondary
dropzone.icon.size    : icon.24
dropzone.hover.border : border.focus
```

## Accordion

```
accordion.radius        : radius.surface
accordion.border        : border.default
accordion.title         : text.card-title
accordion.chevron       : text.secondary
accordion.pending.mark  : state.review.pleno    /* «!» */
accordion.done.mark     : state.resolved.pleno  /* «✓» */
```

## Avatar

```
avatar.radius       : radius.pill
avatar.bg           : bg.inverse
avatar.text         : text.inverse
avatar.symbol.ratio : 62%
```

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

## Pagination

```
pagination.item.radius   : radius.action
pagination.item.text     : text.secondary
pagination.active.bg     : bg.action.primary
pagination.active.text   : text.on-action
pagination.border        : border.default
```

## Reglas

- **Cada componente declara sus tokens al crearse** vía `/product-design-system-update`.
- Un component token **DEBE** resolver a un semántico, no a un primitivo ni a un hex.
- **Ajustar el valor** de un component token = PATCH si es fino; MINOR si introduce un subtoken.
- **Renombrar o remover** un component token = MAJOR.

## Historial

- 2026-09-02 v2.0.0 — Reemplazo completo por las once familias del Manual de marca Jiku v1.0:
  button (con sesión, flujo y FAB), input, select, badge, card, table, sidebar nav, tabs, stepper,
  toggle, empty state, dropzone, accordion, avatar, loader, tooltip y pagination. Deja de ser
  placeholder (MAJOR).
- 2026-08-18 v0.1.0 — Placeholder inicial.
