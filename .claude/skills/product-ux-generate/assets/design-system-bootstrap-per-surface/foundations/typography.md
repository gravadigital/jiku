---
foundation: typography
version: 0.1.0
last_updated: {{DATE}}
status: placeholder
---

# Tipografía

> **Placeholder inicial** — Reemplazá con la fuente y type scale reales del producto.
> Para iterar, ejecutá `/product-design-system-update`.

## Propósito

Define la familia tipográfica, escala de tamaños, pesos y line-heights del producto.
Garantiza jerarquía visual consistente entre pantallas.

## Familia tipográfica

| Token | Familia | Fallback |
|-------|---------|----------|
| `font.sans` | Inter | system-ui, -apple-system, sans-serif |
| `font.mono` | JetBrains Mono | ui-monospace, monospace |

> Reemplazar `Inter` y `JetBrains Mono` con las fuentes reales del producto.

## Type scale (placeholder)

| Nivel | Tamaño | Peso | Line-height | Uso |
|-------|--------|------|-------------|-----|
| `display` | 48px | 700 | 1.1 | Hero |
| `h1` | 32px | 700 | 1.2 | Título de pantalla |
| `h2` | 24px | 600 | 1.3 | Sección |
| `h3` | 18px | 600 | 1.4 | Subsección |
| `body` | 16px | 400 | 1.5 | Texto principal |
| `body-sm` | 14px | 400 | 1.5 | Texto compacto |
| `caption` | 12px | 400 | 1.4 | Notas, labels |
| `code` | 14px | 400 (mono) | 1.5 | Código inline |

## Tokens

### Semánticos
| Token | Valor | Uso |
|-------|-------|-----|
| `text.display` | display | Hero headings |
| `text.heading.l` | h1 | Título de pantalla |
| `text.heading.m` | h2 | Sección |
| `text.heading.s` | h3 | Subsección |
| `text.body` | body | Texto principal |
| `text.caption` | caption | Labels secundarios |

### De componente
A definir cuando se documenten componentes.

## Guidelines

**Do:**
- Una sola `display` o `h1` por pantalla.
- Usar `caption` para metadata (fecha, autor, contador).
- Mantener jerarquía consistente entre pantallas similares.

**Don't:**
- No mezclar más de 3 niveles tipográficos en un mismo bloque.
- No usar tamaños arbitrarios fuera de la escala.
- No usar peso 700+ en textos largos (afecta legibilidad).

## Accesibilidad

- Body mínimo: **16px** en mobile, configurable hasta 200%.
- Line-height mínimo: **1.5** para body, **1.2** para headings.
- Letter-spacing aceptable: 0 a 0.05em.
- No texto en imágenes; usar HTML real.

## Ejemplos

A linkear cuando se documenten componentes (button label, input label, etc.).

## Historial

- {{DATE}} v0.1.0 — Placeholder inicial.
