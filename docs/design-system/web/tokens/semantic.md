---
tokens: semantic
version: 2.0.0
last_updated: 2026-09-02
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

## Background

| Token | Valor | Uso |
|---|---|---|
| `bg.canvas` | `color.mist` | Fondo de aplicación en modo claro |
| `bg.surface` | `color.white` | Tarjetas, paneles, inputs, documentos |
| `bg.surface.sunken` | `color.mist` | Superficie de apoyo dentro de una tarjeta |
| `bg.inverse` | `color.deep-blue` | Login, cabeceras densas, cabecera de tabla densa |
| `bg.action.primary` | **`color.aqua`** | Fondo de botón primario |
| `bg.action.secondary` | `transparent` | Botón secundario (outline) |
| `bg.action.disabled` | `color.mist` | Control deshabilitado |
| `bg.tint.neutral` | `color.gray.100` | Chips y campos sin valor |
| `bg.active` | `color.aqua` | Barra e indicador de ítem activo |
| `bg.active.subtle` | `rgba(97,204,185,.08)` | Fondo de subítem activo — verde agua al 8 % |

### Modo oscuro

| Token | Valor | Uso |
|---|---|---|
| `bg.canvas.dark` | `color.dark.canvas` | Fondo de aplicación |
| `bg.surface.dark` | `color.dark.surface` | Tarjeta, **sin borde** |

## Text

| Token | Valor | Uso |
|---|---|---|
| `text.primary` | `color.deep-blue` | Títulos, jerarquía, texto principal |
| `text.body` | `color.ink` | Cuerpo de texto |
| `text.secondary` | `color.gray.600` | Labels, metadatos, nivel padre del breadcrumb |
| `text.disabled` | `color.gray.400` | Placeholders, texto inactivo |
| `text.inverse` | `color.mist` | Texto sobre fondo oscuro |
| `text.on-action` | **`color.deep-blue`** | Texto sobre el botón primario verde agua |
| `text.link` | **`color.aqua-deep`** | Enlaces y texto verde sobre fondo claro |
| `text.dark` | `color.dark.text` | Texto en modo oscuro |

> **`text.link` es `#12897A`, no `#61CCB9`.** El verde agua sobre blanco da 1.9:1 y **nunca** se
> usa para texto.

## Border

| Token | Valor | Uso |
|---|---|---|
| `border.default` | `color.gray.200` | Bordes de 1 px, divisores, borde de input |
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

## Tipografía

| Token | Valor | Uso |
|---|---|---|
| `text.view-title` | `font.family.display` · 30 · 700 · `tracking.tight` · `leading.title` | Título de vista |
| `text.metric` | `font.family.display` · 34 · 700 | Cifra destacada |
| `text.metric-unit` | `font.family.ui` · 12 · 600 · `tracking.caps` | Unidad en versalitas |
| `text.card-title` | `font.family.ui` · 16 · 700 | Título de tarjeta y panel |
| `text.nav-item` | `font.family.ui` · 15 · 500 | Ítem de sidebar |
| `text.body-default` | `font.family.ui` · 14 · 400 · `leading.body` | Cuerpo |
| `text.field-label` | `font.family.ui` · 13 · 400 | Label de campo |
| `text.table-data` | `font.family.ui` · 13 · 400 · `leading.table` | Dato en tabla |
| `text.filter-label` | `font.family.ui` · 11 · 600 · `tracking.caps` | Label de filtro, versalitas |
| `text.wordmark` | `font.family.display` · 19 · 700 | Wordmark en el sidebar |

## Espaciado

| Token | Valor | Uso |
|---|---|---|
| `space.inline.sm` | `space.1` | Gap glifo–texto |
| `space.inline.md` | `space.2` | Gap inline en pills y badges |
| `space.padding.card` | `space.4` | Padding interno de tarjeta |
| `space.stack.md` | `space.4` | Separación entre bloques |
| `space.grid.gap` | `space.18` | Gap de la grilla de tarjetas |
| `space.padding.content` | `space.8` | Padding del área de contenido |
| `space.stack.section` | `space.8` | Separación entre secciones |

## Forma y elevación

| Token | Valor | Uso |
|---|---|---|
| `radius.action` | `radius.8` | Botones |
| `radius.field` | `radius.10` | Inputs, selects, botón de sesión |
| `radius.surface` | `radius.14` | Tarjetas, paneles, dropzone |
| `radius.pill` | `radius.999` | Pills, badges, chips, toggles |
| `elevation.surface` | `shadow.card` | Tarjeta en reposo |
| `elevation.raised` | `shadow.active` | Elemento activo o flotante |
| `focus.ring` | `shadow.focus` | Anillo de foco, único del sistema |

## Reglas

- **Los componentes consumen semánticos, NUNCA primitivos.**
- **Cambiar el mapeo de un semántico = MAJOR** (rompe consumidores).
- **Agregar un semántico nuevo = MINOR.**
- Ajustar el valor de un primitivo se hace en [`reference.md`](./reference.md), no acá.
- **NO SE DEBE** crear un semántico que nombre apariencia (`bg.green`): nombra rol
  (`bg.action.primary`).

## Historial

- 2026-09-02 v2.0.0 — Remapeo completo al Manual de marca Jiku v1.0. `bg.action.primary` pasa a
  verde agua con `text.on-action` en azul oscuro; `text.link` a verde profundo `#12897A`; se
  agregan `bg.active.subtle` (8 %), la matriz de feedback de estado con tinte/borde/texto por
  familia, los diez estilos tipográficos y los tokens de forma y elevación (MAJOR).
- 2026-08-18 v0.1.0 — Placeholder inicial.
