---
component: Tabs
version: 1.1.0
last_updated: 2026-09-04
status: normativo
surface: web
origin: Manual de marca Jiku v1.0 — «Navegación»
related:
  - sidebar-nav
  - table
---

# Tabs (web)

> **Normativo.** Especifica las pestañas con contador que filtran un listado por estado.

## Propósito

Divide un listado en subconjuntos mutuamente excluyentes, mostrando cuántos elementos tiene cada
uno.

**Cuándo usar:**

- Filtrar un listado por estado: «Backlog 0 · En curso 3 · En revisión 0 · Finalizado 43 ·
  Cancelado 0».

**Cuándo NO usar:**

- Navegar entre secciones del producto → [SidebarNav](./sidebar-nav.md).
- Filtrar por varios valores a la vez → [Select](./select.md) `multiple`.
- Dos opciones excluyentes que no son un listado → [Toggle group](./toggle-group.md).

## Anatomía

1. **Tablist** — fila de tabs con borde inferior, **con scroll horizontal cuando no caben**.
2. **Tab** — label + contador, sin padding lateral.
3. **Contador** — número en pill de **19 px**: tinte grafito en los inactivos, **pill de acento
   —fondo verde agua, texto azul oscuro— en el activo**.
4. **Indicador de activo** — barra verde agua de 2 px bajo el tab actual, del ancho del texto.

## Variants

Una sola: tabs horizontales con contador.

## Sizes

Sin sizes. Alto determinado por el `text.body-default` más el padding.

## States

| State | Descripción | Tokens |
|---|---|---|
| `default` | Tab inactivo, texto secundario | `tab.text` |
| `hover` | Bajo el puntero | `motion.base` |
| `focus` | Foco por teclado | `focus.ring` |
| `active` | Tab actual | `tab.active.text` + `tab.active.border` verde agua + **contador en pill de acento** (`tab.count.active.bg` / `tab.count.active.text`) y peso 600 en el label |
| `empty` | Contador en 0 | El tab **sigue disponible**, el contador muestra `0` |

> **Un tab con contador 0 no se oculta ni se deshabilita.** «Backlog 0» informa que no hay nada en
> backlog, y eso es información. Ocultarlo obligaría al usuario a recordar qué estados existen.

### El contador del activo es una pill de acento

El contador del tab activo pasa a **fondo verde agua con texto azul oscuro** (`tab.count.active.*`
→ `bg.active` / `text.on-action`); los inactivos quedan en **tinte grafito** con texto
`text.disabled`. Es lo que lo distingue de un contador cualquiera: el activo ya no es sólo «el que
tiene la barra debajo», su cifra también cambia de registro.

Sigue habiendo **tres señales** para el activo —barra, peso del texto y ahora el contador—, así que
no depende del color.

### El tablist scrollea

La v1.0.0 decía «NO SE DEBE poner más tabs de los que caben sin scroll horizontal: si son muchos,
es un Select». La pantalla real no deja esa salida: **el detalle de proyecto monta siete tabs** —los
siete estados de requisito, que son los siete y no se recortan— en una card de **~645 px**, y con
26 px de separación la fila mide **743 px**.

El tablist lleva **`overflow-x: auto`**, y cada tab **`flex: none`** para que se pueda scrollear en
lugar de comprimirse. Sin eso, la última tab quedaba cortada por el borde de la card y era
inalcanzable.

> **El scroll es necesario, no decorativo.** No habilita poner tabs de más: habilita mostrar
> completo un conjunto que ya es cerrado y que el dominio no permite recortar.

## Spacing & sizing rules

- **Gap entre tabs:** **26 px** (`space.tabs-gap`). Con el gap de 4 px anterior las tabs se leían
  como un grupo compacto y el subrayado del activo no alcanzaba a separarse de sus vecinas.
- **Padding del tab:** `space.2` (8 px) vertical, **0 horizontal** — el gap del tablist ya separa,
  y el subrayado del activo tiene que quedar del ancho del texto, no del texto más su padding.
- **Gap label–contador:** `space.2` (8 px).
- **Indicador:** 2 px de alto, ancho del tab.
- **Contador:** pill de radio 999 px, **19 px** de alto y de ancho mínimo, texto de **11 px /
  peso 700**. Fondo `bg.tint.neutral` en los inactivos, `bg.active` en el activo.
- **Borde inferior del tablist:** 1 px `border.default`.
- **Scroll:** `overflow-x: auto` en el tablist, `flex: none` en cada tab.

## Accesibilidad

- **DEBE** implementar el patrón ARIA de tabs: `role="tablist"`, `role="tab"` con
  `aria-selected`, y `role="tabpanel"` con `aria-labelledby`.
- **Teclado:** flechas ← → mueven entre tabs, `Home` / `End` van a los extremos. **`Tab` entra y
  sale del tablist**, no recorre los tabs uno por uno.
- El contador **DEBE** formar parte del nombre accesible del tab: «En curso, 3 elementos».
- El indicador verde agua es visual; `aria-selected` es lo que el lector anuncia.
- **Contraste:** el texto activo va en `text.primary` (14.0:1); **el tab activo no se distingue
  sólo por la barra**, también por el peso del texto y por la pill de acento del contador.
- **Contraste del contador activo:** azul oscuro sobre verde agua **9.8:1**.
- **El tablist con scroll DEBE ser alcanzable con teclado:** la navegación por flechas mueve el
  foco entre tabs y el navegador desplaza el contenedor hasta el tab enfocado, así que ninguna tab
  queda inalcanzable aunque esté fuera de vista.

## Guidelines de contenido

- El **nombre del estado**, escrito igual que en el [badge](./badge.md) y el stepper.
- Sentence case, sin versalitas.
- El contador es siempre visible, incluido el `0`.

## Do's & don'ts

**Do:**

- Mostrar el contador siempre, también en 0.
- Marcar el activo con barra verde agua **y** peso de texto **y** contador en pill de acento.
- Mantener el orden de los estados igual al del flujo del requisito.
- Dejar que el tablist scrollee cuando el conjunto de tabs es cerrado y no se puede recortar.

**Don't:**

- **NO SE DEBE** ocultar un tab con 0 elementos.
- **NO SE DEBE** usar tabs para navegar entre secciones del producto.
- **NO SE DEBE** comprimir las tabs para que quepan: el tablist scrollea, las tabs no se encogen.
- **NO SE DEBE** apoyarse en el scroll para agregar tabs discrecionales: existe para conjuntos
  cerrados que el dominio no permite recortar. Si el conjunto es abierto y largo, es un
  [Select](./select.md).
- **NO SE DEBE** poner padding lateral al tab: el subrayado del activo quedaría más ancho que su
  texto.

## API

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `tabs` | `{ key, label, count }[]` | — | Pestañas con su contador |
| `activeKey` | `string` | — | Pestaña actual |
| `onChange` | `(key) => void` | — | Callback de cambio |

## Componentes y patterns relacionados

- [Table](./table.md) — el listado que los tabs filtran.
- [Badge](./badge.md) — mismos nombres de estado.
- [Toggle group](./toggle-group.md) — alternativa para dos opciones.

## Historial

- **1.1.0** (2026-09-04) — Se corrige la especificación visual y de layout contra el código, sin
  cambiar la API. El **gap entre tabs pasa de 4 px a 26 px** (con 4 px las tabs se leían como un
  grupo compacto y el subrayado del activo no se separaba de sus vecinas) y el tab pierde su padding
  lateral, para que el subrayado quede del ancho del texto. El **contador del tab activo pasa a
  pill de acento** —fondo verde agua, texto azul oscuro—, mientras los inactivos quedan en tinte
  neutro; el contador queda especificado en 19 px con texto de 11 px / peso 700. **El tablist
  scrollea en horizontal cuando las tabs no caben**, con `flex: none` en cada tab para que no se
  compriman: el detalle de proyecto monta siete tabs en una card de ~645 px y la fila mide 743 px,
  así que sin scroll la última quedaba cortada e inalcanzable. Eso matiza el «NO SE DEBE poner más
  tabs de los que caben» de la v1.0.0, que se reescribe para distinguir un conjunto cerrado del
  dominio de una lista discrecional (MINOR).
- **1.0.0** (2026-09-02) — Spec nuevo, desde el Manual de marca Jiku v1.0: tabs con contador
  siempre visible, activo con barra verde agua, patrón ARIA de tablist (MINOR sobre el DS).
