---
foundation: typography
version: 1.0.0
last_updated: 2026-08-18
status: relevado-desde-código
origin: relevamiento de código — opus-web/src/styles/_variables.scss
---

# Tipografía (opus-web)

> **Sembrado desde el código existente.**

## Familias

| Token DS | Variable | Valor | Uso |
|---|---|---|---|
| `font.family.sans` | `--font-family-sans` | `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` | Todo el `body` |
| `font.family.mono` | `--font-family-mono` | `'JetBrains Mono', 'Fira Code', monospace` | `code`, `pre` |

> **Es un stack de fuentes de sistema**, a diferencia de `web`, que carga Archivo desde Google
> Fonts. Las dos superficies del producto tienen tipografía distinta.

> ⚠️ **Geist Mono se carga y no se aplica**: `--font-geist-mono` no aparece en ningún SCSS.

## Escala

| Token DS | Variable | Valor | Uso |
|---|---|---|---|
| `font.size.xs` | `--font-size-xs` | 0.75rem (12px) | (sin uso observado) |
| `font.size.sm` | `--font-size-sm` | 0.875rem (14px) | Texto secundario, `h6` |
| `font.size.base` | `--font-size-base` | 1rem (16px) | Body, `h5` |
| `font.size.lg` | `--font-size-lg` | 1.125rem (18px) | `h4` |
| `font.size.xl` | `--font-size-xl` | 1.25rem (20px) | `h3` |
| `font.size.2xl` | `--font-size-2xl` | 1.5rem (24px) | `h2` |
| `font.size.3xl` | `--font-size-3xl` | 2rem (32px) | `h1` |

**Pesos:** `--font-weight-normal` 400 · `-medium` 500 · `-semibold` 600 · `-bold` 700.
`semibold` en todos los encabezados.

**Line heights:** `--line-height-tight` 1.25 (encabezados) · `-normal` 1.5 (body) · `-relaxed` 1.75

La escala es **coherente y con base 16px**, más convencional que la de `web` (que arranca en 10px).

## La escala no se respeta en los módulos de feature

Los componentes del tablero usan **px literales fuera de la escala**:

| Valor | Dónde |
|---|---|
| `11px` | Etiquetas del sidebar y encabezados de columna (`RequirementInfoPanel.module.scss:52`) |
| `13px` | `RequirementInfoPanel.module.scss:117` |
| `14px` | `RequirementInfoPanel.module.scss:61` |
| `26px` | Título del modal de detalle |
| `28px` | Título de la página de detalle |

> ⚠️ **El título de detalle es 28px en la página y 26px en el modal, para el mismo contenido**
> (`RequirementDetailView.module.scss:27-29`). El usuario ve el mismo requisito con dos tamaños de
> título según por dónde entró.

## Reglas de implementación

- Todo tamaño de texto **DEBE** usar un token `--font-size-*`. **NO SE DEBEN** usar px literales.
- Si un componente necesita 11px o 13px, la respuesta es **agregar el token**, no hardcodearlo.
- El mismo contenido **DEBE** tener el mismo tamaño en todas sus superficies de presentación: el
  detalle de requisito no puede medir distinto en modal y en página.

## Gaps registrados

- Px literales (11, 13, 14, 26, 28) fuera de la escala en los módulos del tablero
- **Título del detalle de requisito: 28px en página, 26px en modal**, mismo contenido
- Geist Mono cargada y nunca aplicada
- `--font-size-xs` declarado sin uso
- Las dos superficies del producto usan familias tipográficas distintas, sin decisión registrada
