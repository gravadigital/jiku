---
component: SidebarNav
version: 1.0.0
last_updated: 2026-09-02
status: normativo
surface: web
origin: Manual de marca Jiku v1.0 — «Navegación»
related:
  - logo (foundation)
  - tabs
  - avatar
---

# SidebarNav (web)

> **Normativo.** Especifica la navegación principal. Es el lugar donde la firma de Jiku reemplaza
> a `logo-grava.png`, y donde el verde agua hace su trabajo más visible: marcar el ítem activo.

## Propósito

Navegación principal persistente entre las secciones del producto.

## Anatomía

1. **Firma** — [logo horizontal](../foundations/logo.md) a **26 px de alto**, con el wordmark en
   **Sora 19/700** cuando el ancho lo permite.
2. **Ítems** — icono 22 px + label `text.nav-item` (Gabarito 15/500), alto 48 px.
3. **Subítems** — icono 19 px, sangrado 44 px.
4. **Barra de activo** — 3 px verde agua, al borde del ítem activo.
5. **Pie** — identidad de la persona y salida de sesión.

## Variants

Una sola: sidebar de **300 px fijo**. **No hay estado colapsado ni drawer en esta versión** — ver
[grid](../foundations/grid.md), esta superficie es de un solo viewport.

## Sizes

| Elemento | Valor |
|---|---|
| Ancho del sidebar | **300 px fijo** |
| Alto de ítem | **48 px** |
| Sangrado de subítem | **44 px** |
| Icono de ítem | **22 px** |
| Icono de subítem | **19 px** |
| Firma | **26 px** de alto |

## States

| State | Descripción | Tokens |
|---|---|---|
| `default` | Ítem en reposo, icono grafito `#626C78` | `nav.item.icon` |
| `hover` | Bajo el puntero | `bg.surface.sunken`, `motion.fast` |
| `focus` | Foco por teclado | `focus.ring` |
| **`active`** | Sección actual | **Tarjeta blanca + barra verde agua de 3 px** + `elevation.raised`; icono en `#12897A` |
| `subitem-active` | Subsección actual | **Tinte verde agua al 8 %** (`bg.active.subtle`) |

> «El ítem activo es una tarjeta blanca con barra verde agua de 3 px; el subítem activo, un tinte
> verde agua al 8 %.» El activo se marca con **tres señales a la vez** —superficie, barra y color
> de icono— y por eso no depende del color.

## Spacing & sizing rules

- **Ancho:** 300 px. **Divisor con el contenido:** 1 px `#DFE1E7`.
- **Gap icono–label:** `space.2` (8 px).
- **Barra de activo:** 3 px de ancho, alto completo del ítem.
- **Padding horizontal del ítem:** `space.4` (16 px).
- **Área de resguardo de la firma:** `1x` en los cuatro lados
  (ver [logo](../foundations/logo.md#área-de-resguardo-y-medidas)).

## Accesibilidad

- **DEBE** ser un `<nav>` con `aria-label` («Navegación principal»).
- La lista de secciones **DEBE** ser una lista real (`<ul>`/`<li>`).
- El ítem activo **DEBE** llevar `aria-current="page"` — la barra verde agua es visual y no llega
  al lector de pantalla.
- Los subítems **DEBEN** anidarse en una lista dentro de su ítem padre, con la relación expuesta.
- **Teclado:** `Tab` recorre los ítems en orden visual; `Enter` navega. **NO SE DEBE** atrapar el
  foco en el sidebar.
- El icono del ítem es decorativo (`aria-hidden`) porque el label está visible.
- **Contraste:** icono activo `#12897A` sobre tarjeta blanca cumple AA; **el verde agua de la barra
  no porta información por sí solo**.
- La firma lleva texto alternativo «Jiku».

## Guidelines de contenido

- **Labels:** el término de dominio en plural — «Actores», «Proyectos», «Requisitos», «Tareas».
- **Sentence case**, sin iconografía en el texto.
- **Subítems:** el criterio de corte — «Backlog», «Por proyecto».
- El nombre de la persona en el pie, con su [avatar](./avatar.md).

## Do's & don'ts

**Do:**

- Marcar el activo con superficie blanca **y** barra verde agua **y** `aria-current`.
- Usar `#12897A` para el icono activo, no `#61CCB9`.
- Mantener el orden de las secciones estable entre sesiones.

**Don't:**

- **NO SE DEBE** usar verde agua como fondo del ítem activo: es tarjeta blanca con barra.
- **NO SE DEBE** teñir el icono activo con verde agua de marca sobre fondo claro (1.9:1).
- **NO SE DEBE** repetir la firma en el pie si ya está en la cabecera
  ([una sola firma por pieza](../foundations/logo.md#jerarquía-de-uso)).
- **NO SE DEBE** colapsar el sidebar sin resolver antes la navegación en anchos chicos.

## API

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `items` | `{ key, label, icon, href, children? }[]` | — | Secciones y subsecciones |
| `activeKey` | `string` | — | Sección actual |
| `user` | `{ name, initials }` | — | Identidad del pie |
| `onLogout` | `() => void` | — | Salida de sesión |
| `mode` | `"light" \| "dark"` | `"light"` | Modo de la firma: `light` resuelve a `jikuLogo.svg`, `dark` a `jikuLogoDark.svg`. El componente no detecta el tema — lo decide el consumidor (S-058) |

## Migración

| Hoy | Pasa a |
|---|---|
| `logo-grava.png` | **`logo-jiku.png`** — firma horizontal a 26 px |
| Ancho 290 px (`(loggedin)/styles.module.scss:8`) | **300 px** |
| Fondo `--color-surface-light` `#f5f5f5` | Superficie del sistema |
| `z-index: 10` literal | Token `z.navbar` (**después** de corregir el orden, ver [spacing](../foundations/spacing.md#z-index)) |
| Activo con la paleta anterior | Tarjeta blanca + barra verde agua 3 px |

## Componentes y patterns relacionados

- [logo](../foundations/logo.md) — variantes de firma y resguardo.
- [Tabs](./tabs.md) — navegación secundaria dentro de una vista.
- [Avatar](./avatar.md) — identidad en el pie.

## Nota pendiente (story S-059, sin bump de versión)

El pie (anatomía, punto 5) suma desde REQ-013 un `selector-tema`, junto a Cerrar sesión —
declarado de forma normativa en `product-map.md` («el pie de la sidebar suma el `selector-tema`,
junto a Cerrar sesión»), pero esta ficha todavía no lo documenta en su anatomía ni en su API.
S-059 lo implementó reutilizando `ToggleGroup` variant `segmented` (ver `toggle-group.md`) y
agregando `footerSlot?: React.ReactNode` a la API de `SidebarNav` — aditivo, sin la prop el pie
se ve igual que antes. Queda para el próximo `/product-design-system-update` (MINOR, aditivo):
sumar el punto 5 de Anatomía ("Pie — identidad de la persona, selector de tema y salida de
sesión") y la fila `footerSlot` a la tabla de API.

## Historial

- **1.1.0** (2026-09-03, story S-058) — Se agrega `mode` (`"light" | "dark"`, default `"light"`)
  para resolver la firma correcta según el modo (CA-3: `jikuLogo.svg` / `jikuLogoDark.svg`).
  Backward compatible: sin la prop, el comportamiento es el mismo de antes (MINOR).
- **1.0.0** (2026-09-02) — Spec nuevo, desde el Manual de marca Jiku v1.0: sidebar de 300 px, ítem
  de 48 px con icono 22 px, activo como tarjeta blanca con barra verde agua de 3 px y subítem
  activo al 8 %, firma horizontal a 26 px reemplazando `logo-grava.png` (MINOR sobre el DS).
