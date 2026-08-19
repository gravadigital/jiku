---
foundation: color
version: 0.1.0
last_updated: {{DATE}}
status: placeholder
---

# Color

> **Placeholder inicial** — Reemplazá esta paleta con la real del producto.
> Para iterar, ejecutá `/product-design-system-update` y describí los cambios.

## Propósito

Define la paleta de colores del producto y su rol semántico (brand, neutral, semántico).
Consumido por diseñadores al componer pantallas y por desarrolladores al implementar
componentes vía tokens.

## Paleta

### Brand (placeholder)
| Token | Hex | Uso |
|-------|-----|-----|
| `color.brand.primary` | `#2563eb` | Acciones primarias, links |
| `color.brand.secondary` | `#1e293b` | Acciones secundarias, header |

### Neutral (placeholder — paleta gris recomendada)
| Token | Hex | Uso |
|-------|-----|-----|
| `color.neutral.0` | `#ffffff` | Fondo base |
| `color.neutral.50` | `#f8fafc` | Fondo de superficies (cards) |
| `color.neutral.100` | `#f1f5f9` | Fondo alternativo |
| `color.neutral.300` | `#cbd5e1` | Bordes neutros |
| `color.neutral.500` | `#64748b` | Texto secundario |
| `color.neutral.700` | `#334155` | Texto primario alternativo |
| `color.neutral.900` | `#0f172a` | Texto principal |

### Semántico (placeholder)
| Token | Hex | Uso |
|-------|-----|-----|
| `color.success` | `#10b981` | Estados de éxito |
| `color.warning` | `#f59e0b` | Estados de advertencia |
| `color.error` | `#ef4444` | Estados de error / destructivo |
| `color.info` | `#3b82f6` | Estados informativos |

## Tokens

### Semánticos (placeholder)
| Token | Valor | Uso |
|-------|-------|-----|
| `bg.surface` | `color.neutral.0` | Fondo de superficies |
| `bg.action.primary` | `color.brand.primary` | Fondo botón primario |
| `text.primary` | `color.neutral.900` | Texto principal |
| `text.muted` | `color.neutral.500` | Texto secundario |
| `border.default` | `color.neutral.300` | Bordes neutros |

### De componente
A definir cuando se documenten componentes específicos (ver `components/`).

## Guidelines

**Do:**
- Usar tokens semánticos en componentes, NUNCA primitivos directos.
- Reservar `color.brand.primary` para acciones críticas (1 por pantalla).
- Usar `color.error` solo para errores reales del usuario.

**Don't:**
- No usar más de 2 tonos del brand en una misma pantalla.
- No usar colores semánticos para decoración.
- No declarar hex hardcoded en componentes.

## Accesibilidad

- Contraste texto sobre fondo: **≥4.5:1** (WCAG AA para body ≥16pt).
- Contraste texto grande (≥18pt o ≥14pt bold): **≥3:1**.
- Bordes interactivos visibles: **≥3:1** contra fondo adyacente.
- No comunicar estado solo con color (combinar con icono o texto).

## Ejemplos

A linkear cuando se documenten componentes que usen esta foundation.

## Historial

- {{DATE}} v0.1.0 — Placeholder inicial (bootstrap automático).
