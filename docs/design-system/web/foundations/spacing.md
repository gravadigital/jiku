---
foundation: spacing
version: 1.0.0
last_updated: 2026-08-18
status: relevado-desde-código
origin: relevamiento de código — web/src/styles/_variables.scss
---

# Espaciado (web)

> **Sembrado desde el código existente.**

## Escala

Escala propia en `rem`, base 4px.

| Token DS | Variable | Valor |
|---|---|---|
| `space.xs` | `--spacing-xs` | 0.25rem (4px) |
| `space.sm` | `--spacing-sm` | 0.5rem (8px) |
| `space.md` | `--spacing-md` | 1rem (16px) |
| `space.lg` | `--spacing-lg` | 1.5rem (24px) |
| `space.xl` | `--spacing-xl` | 2rem (32px) |
| `space.2xl` | `--spacing-2xl` | 3rem (48px) |

## La escala existe y no se usa

**Los módulos usan mayoritariamente valores literales en `rem`** (`1.25rem`, `0.75rem`, `1.375rem`)
en vez de los tokens.

> **`1.25rem` (20px) es el gap más frecuente en los layouts de dos columnas, y NO está en la
> escala.** Es el valor que más se repite en el producto y el único que no tiene token.

Es la deuda de espaciado principal: la escala está declarada, es razonable, y el código la esquiva.

## Radios

| Token DS | Variable | Valor | Uso |
|---|---|---|---|
| `radius.items` | `--radius-items` | 0.5rem | Inputs, tags, botones |
| `radius.cards` | `--radius-cards` | 1rem | Cards |
| `radius.buttons` | `--radius-buttons` | 0.5rem | Botones |

Varios módulos usan **`10px` literal** (`RequirementDetail.module.scss:29`), fuera de la escala.

## Z-index

| Token DS | Variable | Valor |
|---|---|---|
| `z.dropdown` | `--z-index-dropdown` | 100 |
| `z.modal` | `--z-index-modal` | 200 |
| `z.tooltip` | `--z-index-tooltip` | 300 |
| `z.navbar` | `--z-index-navbar` | 400 |

> ⚠️ **`--z-index-navbar` (400) es MAYOR que `-modal` (200) y `-tooltip` (300).** Un modal abierto
> quedaría por debajo de la barra de navegación si ambos usaran sus tokens.
>
> **En la práctica no ocurre**, porque la sidebar usa `z-index: 10` literal
> (`(loggedin)/styles.module.scss:15`) en vez de su token. El bug está latente en los tokens y
> neutralizado por no usarlos.

## Otros

**Sombras:** `--box-shadow` y `--box-shadow-hover`, ambas de dos capas.

**Transiciones:** `--transition-fast` 150ms · `-base` 200ms · `-slow` 300ms, todas `ease`.

## Reglas de implementación

- Todo espaciado **DEBE** usar un token `--spacing-*`. **NO SE DEBEN** usar valores literales.
- Si un layout necesita `1.25rem`, la respuesta correcta es **agregar el token a la escala**, no
  hardcodearlo por vigésima vez.
- Todo `z-index` **DEBE** usar un token. **Antes de usarlos hay que corregir el orden**: `navbar`
  no puede ser mayor que `modal`.
- Los radios **DEBEN** usar `--radius-*`. **NO SE DEBE** usar `10px` literal.

## Gaps registrados

- La escala de espaciado existe y el código la esquiva con literales
- `1.25rem`, el gap más frecuente del producto, no está en la escala
- **`--z-index-navbar` (400) > `--z-index-modal` (200)**: orden invertido, latente
- La sidebar usa `z-index: 10` literal en vez de su token
- Radios `10px` literales fuera de la escala
