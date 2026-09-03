---
component: ViewHeader
version: 1.1.0
last_updated: 2026-09-02
status: normativo
surface: web
origin: Manual de marca Jiku v1.0 — «Escala tipográfica» y «Navegación»
related:
  - badge
  - button
---

# ViewHeader (web)

> **Normativo.** Especifica la cabecera de una vista: el título en Sora 30/700, el breadcrumb y la
> zona de acciones.

## Propósito

Sitúa al usuario —dónde está y cómo llegó— y aloja la acción principal de la vista.

## Anatomía

1. **Breadcrumb (opcional)** — nivel padre + nivel actual.
2. **Título** — `text.view-title` (**Sora 30/700**, tracking −0,035 em).
3. **Badges (opcional)** — identificador y **badge editable de estado**, en detalle de entidad.
   Ese badge **es el control de cambio de estado** del requisito
   (ver [Badge](./badge.md#el-badge-editable-es-el-control-de-estado)).
4. **Acción principal** — un solo [botón](./button.md) primario.

## Variants

| Variant | Propósito | Ejemplo |
|---|---|---|
| `list` | Cabecera de listado | «Vaitty · Validación Fiscal» + «Nuevo proyecto» |
| `breadcrumb` | Vista con nivel padre | «Tareas / crear» |
| `detail` | Detalle de entidad | «#151» + badges editables de estado, tipo y prioridad — el de estado ofrece los **siete** |

### Breadcrumb

**El nivel padre va en texto secundario; el nivel actual, en caja baja y color principal.**

- Padre: `text.secondary` (`#6D727B`) — «Tareas /»
- Actual: `text.primary` (`#0B1934`), **caja baja** — «crear»

> El nivel actual en caja baja es deliberado: no es un título más, es el paso dentro de la sección.

## Sizes

Un solo tamaño. Título en 30 px con interlínea 1,05–1,15.

## States

Estado único. Los badges de `detail` tienen sus propios estados
(ver [Badge](./badge.md#states)).

## Spacing & sizing rules

- **Padding del área de contenido:** `space.8` (32 px) — lo hereda del layout.
- **Gap breadcrumb–título:** `space.1` (4 px).
- **Gap título–badges:** `space.2` (8 px).
- **Acción principal:** alineada a la derecha, al centro vertical del título.
- **Divisor inferior:** 1 px `#DFE1E7` cuando la vista lo necesita.

## Accesibilidad

- El título **DEBE** ser el `<h1>` de la vista: es el encabezado de nivel superior de la página.
- El breadcrumb **DEBE** ser un `<nav aria-label="Ruta">` con una lista, y el nivel actual
  **DEBE** llevar `aria-current="page"`.
- **NO SE DEBE** usar un `<div>` con tamaño 30 px en lugar de un encabezado real: la navegación por
  encabezados es la principal para muchos lectores de pantalla.
- Los badges editables de `detail` son controles, con su rol y su foco propios.
- **Contraste:** azul oscuro sobre niebla **14.0:1**.

## Guidelines de contenido

- **Título:** el nombre de la entidad o de la sección, sin prefijos redundantes.
- **Breadcrumb:** el nombre de la sección padre + la acción en caja baja — «Tareas / crear».
- **Una sola acción primaria**, verbo primero — «Nuevo proyecto».

## Do's & don'ts

**Do:**

- Usar Sora 30/700 sólo acá y en las cifras destacadas.
- Poner el nivel actual del breadcrumb en caja baja.
- Dejar una sola acción primaria por vista.

**Don't:**

- **NO SE DEBE** usar Sora en otros títulos: los de card van en Gabarito 16/700.
- **NO SE DEBEN** poner dos botones primarios en la cabecera.
- **NO SE DEBE** repetir el nombre de la sección en el título si ya está en el breadcrumb.

## API

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `variant` | `"list" \| "breadcrumb" \| "detail"` | `"list"` | Tipo de cabecera |
| `title` | `string` | — | Título visible |
| `parent` | `{ label, href }` | — | Nivel padre del breadcrumb |
| `badges` | Badge props[] | — | Sólo `detail` |
| `action` | Button props | — | Acción principal |

## Componentes y patterns relacionados

- [Badge](./badge.md) — badges editables del `detail`.
- [Button](./button.md) — la acción principal.
- [Tabs](./tabs.md) — suele ir justo debajo.

## Historial

- **1.1.0** (2026-09-02) — Se explicita que el badge de estado de la variant `detail` es el control
  de cambio de estado del requisito, en reparto con el stepper (MINOR).
- **1.0.0** (2026-09-02) — Spec nuevo, desde el Manual de marca Jiku v1.0: título en Sora 30/700,
  breadcrumb con nivel actual en caja baja, y una sola acción primaria (MINOR sobre el DS).
