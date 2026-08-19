---
foundation: spacing
version: 0.1.0
last_updated: {{DATE}}
status: placeholder
---

# Espaciado

> **Placeholder inicial** — Reemplazá según las necesidades del producto.

## Propósito

Define la escala de espaciado (padding, margin, gap) basada en un baseline grid.
Garantiza ritmo visual consistente entre componentes y pantallas.

## Baseline

**Baseline: 4pt** (recomendado para mobile + desktop)

Todos los valores son múltiplos de 4. Alternativamente, baseline 8pt para
proyectos con menor densidad visual.

## Escala

| Token | Valor | Uso típico |
|-------|-------|------------|
| `space.0` | 0px | Reset |
| `space.xs` | 4px | Separación mínima (icono ↔ texto) |
| `space.sm` | 8px | Padding compacto, gap entre items inline |
| `space.md` | 12px | Padding default |
| `space.lg` | 16px | Padding holgado, gap entre secciones cortas |
| `space.xl` | 24px | Separación entre secciones |
| `space.2xl` | 32px | Padding de contenedores grandes |
| `space.3xl` | 48px | Separación entre bloques principales |
| `space.4xl` | 64px | Hero / aire alrededor de elementos clave |

## Tokens semánticos

| Token | Valor | Uso |
|-------|-------|-----|
| `space.inline.sm` | `space.sm` | Gap entre elementos en una fila |
| `space.inline.md` | `space.md` | Gap default inline |
| `space.stack.sm` | `space.md` | Gap entre líneas de texto |
| `space.stack.md` | `space.lg` | Gap entre párrafos |
| `space.stack.lg` | `space.xl` | Gap entre secciones |
| `space.padding.compact` | `space.sm` | Padding interno compacto |
| `space.padding.default` | `space.md` | Padding interno default |
| `space.padding.spacious` | `space.lg` | Padding interno holgado |

## Guidelines

**Do:**
- Usar la escala — nunca valores arbitrarios fuera de la lista.
- Mantener ritmo vertical consistente con `space.stack.*`.
- Espaciado interno (padding) y externo (gap) son distintos contextos.

**Don't:**
- No usar márgenes negativos para "ahorrar espacio".
- No mezclar baselines (todo el producto debe ser 4pt o 8pt, no ambos).

## Accesibilidad

- Targets táctiles: mínimo **44×44px** (Apple HIG) o **48×48px** (Material).
- Spacing entre targets táctiles: mínimo **8px**.

## Historial

- {{DATE}} v0.1.0 — Placeholder inicial.
