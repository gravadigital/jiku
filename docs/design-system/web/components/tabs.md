---
component: Tabs
version: 1.0.0
last_updated: 2026-09-02
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

1. **Tab** — label + contador.
2. **Contador** — número en pill de tinte grafito.
3. **Indicador de activo** — barra verde agua bajo el tab actual.

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
| `active` | Tab actual | `tab.text.active` + `tab.indicator` verde agua |
| `empty` | Contador en 0 | El tab **sigue disponible**, el contador muestra `0` |

> **Un tab con contador 0 no se oculta ni se deshabilita.** «Backlog 0» informa que no hay nada en
> backlog, y eso es información. Ocultarlo obligaría al usuario a recordar qué estados existen.

## Spacing & sizing rules

- **Padding del tab:** `space.2` (8 px) vertical, `space.4` (16 px) horizontal.
- **Gap label–contador:** `space.1` (4 px).
- **Indicador:** 2 px de alto, ancho del tab.
- **Contador:** pill de radio 999 px, fondo `bg.tint.neutral`.

## Accesibilidad

- **DEBE** implementar el patrón ARIA de tabs: `role="tablist"`, `role="tab"` con
  `aria-selected`, y `role="tabpanel"` con `aria-labelledby`.
- **Teclado:** flechas ← → mueven entre tabs, `Home` / `End` van a los extremos. **`Tab` entra y
  sale del tablist**, no recorre los tabs uno por uno.
- El contador **DEBE** formar parte del nombre accesible del tab: «En curso, 3 elementos».
- El indicador verde agua es visual; `aria-selected` es lo que el lector anuncia.
- **Contraste:** el texto activo va en `text.primary` (14.0:1); **el tab activo no se distingue
  sólo por la barra**, también por el peso del texto.

## Guidelines de contenido

- El **nombre del estado**, escrito igual que en el [badge](./badge.md) y el stepper.
- Sentence case, sin versalitas.
- El contador es siempre visible, incluido el `0`.

## Do's & don'ts

**Do:**

- Mostrar el contador siempre, también en 0.
- Marcar el activo con barra verde agua **y** contraste de texto.
- Mantener el orden de los estados igual al del flujo del requisito.

**Don't:**

- **NO SE DEBE** ocultar un tab con 0 elementos.
- **NO SE DEBE** usar tabs para navegar entre secciones del producto.
- **NO SE DEBE** poner más tabs de los que caben sin scroll horizontal: si son muchos, es un
  [Select](./select.md).

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

- **1.0.0** (2026-09-02) — Spec nuevo, desde el Manual de marca Jiku v1.0: tabs con contador
  siempre visible, activo con barra verde agua, patrón ARIA de tablist (MINOR sobre el DS).
