---
component: SidebarNav
version: 1.2.0
last_updated: 2026-09-04
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

1. **Cabecera de marca** — [logo horizontal](../foundations/logo.md) a **26 px de alto**, con el
   wordmark en **Sora 19/700** cuando el ancho lo permite, **con separador de 1 px debajo** que la
   divide de la navegación.
2. **Ítems** — icono 22 px + label `text.nav-item` (Gabarito 15/500), alto 48 px.
3. **Subítems** — icono 19 px, sangrado 44 px.
4. **Barra de activo** — 3 px verde agua, al borde del ítem activo.
5. **Pie** — identidad de la persona (**si hay nombre**), slot opcional —el selector de tema— y
   **botón de sesión** «Cerrar sesión».

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
| Botón «Cerrar sesión» | **alto 46 px**, ancho completo, radio 10 px |
| Icono del botón de sesión | **18 px** |

### La cabecera de marca lleva separador

La firma va en un bloque propio con **borde inferior de 1 px** (`border.default`) y margen inferior
de `space.2`. Es lo que el prototipo del handoff muestra: el isotipo y el wordmark quedan
**divididos de la navegación por una línea**, no flotando sobre la primera sección.

### «Cerrar sesión» es el botón de sesión

| | |
|---|---|
| **Fondo** | **Verde agua** `nav.logout.bg` → `bg.action-primary`, con hover a `bg.action-primary-hover` |
| **Texto** | `nav.logout.text` → azul oscuro, 14 px / peso 600 |
| **Ancho** | Completo, al ancho del pie |
| **Alto** | **46 px** (`nav.logout.height`) |
| **Radio** | **10 px** (`nav.logout.radius` → `radius.field`) |
| **Icono** | Puerta con flecha saliente, **18 px**, trazo 1,9 px, a la izquierda del texto |

**Antes era texto pelado de 16 px, sin fondo ni icono.** Salir de sesión es una acción, no un
enlace, y el manual la trata como el botón de sesión: es la única acción del sidebar y el verde agua
la señala como tal. El icono es **decorativo** — el nombre accesible lo da el texto del botón.

### La identidad sólo se renderiza si hay nombre

El bloque de identidad —avatar + nombre— **se omite cuando no hay nombre que mostrar**.

La razón es concreta: la sesión de Zitadel no trae `name` (el callback `profile` devuelve sólo `id`
y `roles`), así que el bloque renderizaba **un avatar sin iniciales —un círculo azul vacío— al lado
de un nombre vacío**. El prototipo del handoff, de hecho, no lleva identidad en el pie del sidebar:
sólo el botón de cerrar sesión. Cuando la sesión traiga el nombre, el bloque aparece solo, sin
cambio de código.

### El slot del pie

El pie suma desde **REQ-013** el `selector-tema`, junto a Cerrar sesión — declarado de forma
normativa en `product-map.md`. **S-059** lo implementó reutilizando
[`ToggleGroup`](./toggle-group.md) variant `segmented`, pasado por la prop **`footerSlot`**, que se
renderiza **entre la identidad y el botón de sesión**.

Es aditivo: sin `footerSlot`, el pie se ve exactamente igual que antes de S-059. El componente **no
decide qué va ahí** — igual que no consulta la ruta para `activeKey` ni el tema para `mode`.

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
- **Cabecera de marca:** padding `space.4` (16 px), borde inferior de 1 px, margen inferior
  `space.2` (8 px).
- **Pie:** columna con gap `space.2` (8 px), padding `space.4` (16 px), borde superior de 1 px.
- **Botón de sesión:** alto 46 px, radio 10 px, gap icono–texto `space.2` (8 px).

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
- **El botón «Cerrar sesión» es un `<button>`** con su texto visible como nombre accesible; su
  icono es decorativo (`aria-hidden="true"`).
- **Contraste del botón de sesión:** azul oscuro sobre verde agua **9.8:1**.
- El separador de la cabecera de marca es decorativo: la relación entre firma y navegación la da la
  estructura (`<nav>` + lista), no la línea.

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
- Dividir la cabecera de marca de la navegación con el separador de 1 px.
- Tratar «Cerrar sesión» como el botón de sesión: verde agua, ancho completo, con su icono.
- Omitir el bloque de identidad cuando la sesión no trae nombre.

**Don't:**

- **NO SE DEBE** usar verde agua como fondo del ítem activo: es tarjeta blanca con barra.
- **NO SE DEBE** teñir el icono activo con verde agua de marca sobre fondo claro (1.9:1).
- **NO SE DEBE** repetir la firma en el pie si ya está en la cabecera
  ([una sola firma por pieza](../foundations/logo.md#jerarquía-de-uso)).
- **NO SE DEBE** colapsar el sidebar sin resolver antes la navegación en anchos chicos.
- **NO SE DEBE** dejar «Cerrar sesión» como texto pelado: es una acción y va como botón.
- **NO SE DEBE** renderizar el avatar del pie sin nombre: queda un círculo vacío que no identifica
  a nadie.

## API

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `items` | `{ key, label, icon, href, children? }[]` | — | Secciones y subsecciones |
| `activeKey` | `string` | — | Sección actual |
| `user` | `{ name, initials }` | — | Identidad del pie |
| `onLogout` | `() => void` | — | Salida de sesión |
| `mode` | `"light" \| "dark"` | `"light"` | Modo de la firma: `light` resuelve a `jikuLogo.svg`, `dark` a `jikuLogoDark.svg`. El componente no detecta el tema — lo decide el consumidor (S-058) |
| `footerSlot` | `ReactNode` | — | Contenido adicional del pie, renderizado **entre la identidad y «Cerrar sesión»**. Es donde vive el selector de tema (S-059) |

`user.name` vacío **omite el bloque de identidad completo**: sin nombre no se renderiza ni el
avatar.

## Migración

| Hoy | Pasa a |
|---|---|
| `logo-grava.png` | **`logo-jiku.png`** — firma horizontal a 26 px |
| Ancho 290 px (`(loggedin)/styles.module.scss:8`) | **300 px** |
| Fondo `--color-surface-light` `#f5f5f5` | Superficie del sistema |
| `z-index: 10` literal | Token `z.navbar` (**después** de corregir el orden, ver [spacing](../foundations/spacing.md#z-index)) |
| Activo con la paleta anterior | Tarjeta blanca + barra verde agua 3 px |
| «Cerrar sesión» como texto pelado de 16 px | **Botón de sesión** verde agua, ancho completo, alto 46, radio 10, icono 18 px |
| Cabecera de marca sin separación | Separador de 1 px debajo de la firma |

## Componentes y patterns relacionados

- [logo](../foundations/logo.md) — variantes de firma y resguardo.
- [Tabs](./tabs.md) — navegación secundaria dentro de una vista.
- [Avatar](./avatar.md) — identidad en el pie.

## Historial

- **1.2.0** (2026-09-04) — Se corrige la especificación del pie y de la cabecera contra el código.
  La **cabecera de marca lleva separador de 1 px debajo**, como en el prototipo: la firma queda
  dividida de la navegación en vez de flotar sobre la primera sección. **«Cerrar sesión» pasa de
  texto pelado a botón de sesión** —verde agua, ancho completo, alto 46 px, radio 10 px, con el
  icono de logout de 18 px a la izquierda del texto—, porque salir es una acción y no un enlace, y
  es la única acción del sidebar. El **bloque de identidad sólo se renderiza si hay nombre**: la
  sesión de Zitadel no trae `name` y el bloque dibujaba un avatar sin iniciales —un círculo azul
  vacío— al lado de un nombre vacío; el prototipo, de hecho, no lleva identidad en el pie.
  Se salda además la **nota pendiente de S-059**, que pasa a ser sección normativa: `footerSlot`
  entra a la tabla de API y el punto 5 de Anatomía nombra el slot. Y se corrige el `version:` del
  frontmatter, que había quedado en `1.0.0` cuando el Historial ya registraba la 1.1.0 de S-058
  (MINOR).
- **1.1.0** (2026-09-03, story S-058) — Se agrega `mode` (`"light" | "dark"`, default `"light"`)
  para resolver la firma correcta según el modo (CA-3: `jikuLogo.svg` / `jikuLogoDark.svg`).
  Backward compatible: sin la prop, el comportamiento es el mismo de antes (MINOR).
- **1.0.0** (2026-09-02) — Spec nuevo, desde el Manual de marca Jiku v1.0: sidebar de 300 px, ítem
  de 48 px con icono 22 px, activo como tarjeta blanca con barra verde agua de 3 px y subítem
  activo al 8 %, firma horizontal a 26 px reemplazando `logo-grava.png` (MINOR sobre el DS).
