---
tokens: semantic
version: 0.1.0
last_updated: {{DATE}}
status: placeholder
---

# Tokens — Semantic (alias)

> **Placeholder inicial** — Tier 2: tokens semánticos. Mapean primitivos a
> roles funcionales (qué hace, no qué es).

## Propósito

Tier 2 de la jerarquía de tokens. Cada semántico mapea a uno o más
primitivos (`tokens/reference.md`). Los componentes consumen estos
semánticos, NUNCA los primitivos directamente.

Los semánticos comunican **intención** (`bg.action.primary`), no apariencia
(`color.blue.500`). Esto permite cambiar la paleta sin tocar componentes.

## Color (placeholder)

### Background
| Token | Valor | Uso |
|-------|-------|-----|
| `bg.surface` | `color.gray.0` | Fondo de cards, modales |
| `bg.canvas` | `color.gray.50` | Fondo general de la página |
| `bg.action.primary` | `color.blue.500` | Botón primario |
| `bg.action.primary.hover` | `color.blue.600` | Hover de botón primario |
| `bg.success` | `color.green.500` | Estado de éxito |
| `bg.error` | `color.red.500` | Estado de error |

### Text
| Token | Valor | Uso |
|-------|-------|-----|
| `text.primary` | `color.gray.900` | Texto principal |
| `text.secondary` | `color.gray.500` | Texto secundario |
| `text.inverse` | `color.gray.0` | Texto sobre fondo oscuro |
| `text.action.primary` | `color.blue.500` | Links, botón secondary |
| `text.error` | `color.red.500` | Mensaje de error |

### Border
| Token | Valor | Uso |
|-------|-------|-----|
| `border.default` | `color.gray.300` | Bordes neutros |
| `border.focus` | `color.blue.500` | Borde de elemento focused |
| `border.error` | `color.red.500` | Borde de elemento inválido |

## Spacing (placeholder)

| Token | Valor | Uso |
|-------|-------|-----|
| `space.inline.sm` | `space.2` | Gap inline pequeño |
| `space.inline.md` | `space.3` | Gap inline default |
| `space.stack.sm` | `space.3` | Gap vertical entre líneas |
| `space.stack.md` | `space.4` | Gap vertical entre párrafos |
| `space.stack.lg` | `space.5` | Gap vertical entre secciones |
| `space.padding.compact` | `space.2` | Padding interno compacto |
| `space.padding.default` | `space.3` | Padding interno default |
| `space.padding.spacious` | `space.4` | Padding interno holgado |

## Typography (placeholder)

| Token | Valor | Uso |
|-------|-------|-----|
| `text.heading.l` | `font.size.2xl` + `font.weight.bold` | h1 |
| `text.heading.m` | `font.size.xl` + `font.weight.semibold` | h2 |
| `text.heading.s` | `font.size.lg` + `font.weight.semibold` | h3 |
| `text.body` | `font.size.md` + `font.weight.regular` | Body |
| `text.caption` | `font.size.xs` + `font.weight.regular` | Caption |

## Reglas

- **Componentes consumen semánticos, NUNCA primitivos.**
- **Cambiar el mapeo de un semántico** = MAJOR (rompe consumidores).
- **Agregar nuevos semánticos** = MINOR.
- **Ajuste de valor primitivo subyacente** = patch en `reference.md`, no acá.

## Historial

- {{DATE}} v0.1.0 — Placeholder inicial.
