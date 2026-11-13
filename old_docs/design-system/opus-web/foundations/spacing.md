---
foundation: spacing
version: 1.0.0
last_updated: 2026-08-18
status: relevado-desde-código
origin: relevamiento de código — opus-web/src/styles/_variables.scss
---

# Espaciado (opus-web)

> **Sembrado desde el código existente.**

## Escala

| Token DS | Variable | Valor |
|---|---|---|
| `space.xs` | `--spacing-xs` | 0.25rem (4px) |
| `space.sm` | `--spacing-sm` | 0.5rem (8px) |
| `space.md` | `--spacing-md` | 1rem (16px) |
| `space.lg` | `--spacing-lg` | 1.5rem (24px) |
| `space.xl` | `--spacing-xl` | 2rem (32px) |
| `space.2xl` | `--spacing-2xl` | 3rem (48px) |

Es la misma escala que `web` — el único elemento de diseño que las dos superficies comparten.

## La escala no se usa en los módulos del tablero

Igual que la tipografía: los componentes del tablero usan px literales fuera de la escala
(`padding: 14px 20px`, `gap: 6px`, `padding: 12px 10px`).

## Radios

| Token DS | Variable | Valor |
|---|---|---|
| `radius.sm` | `--radius-sm` | 4px |
| `radius.md` | `--radius-md` | 6px |
| `radius.lg` | `--radius-lg` | 8px |
| `radius.xl` | `--radius-xl` | 12px |
| `radius.full` | `--radius-full` | 9999px |

Escala más granular que la de `web` (que tiene 3 radios por rol, no por tamaño).

## Z-index

| Token DS | Variable | Valor |
|---|---|---|
| `z.dropdown` | `--z-dropdown` | 100 |
| `z.sticky` | `--z-sticky` | 200 |
| `z.modal` | `--z-modal` | 300 |
| `z.tooltip` | `--z-tooltip` | 400 |
| `z.toast` | `--z-toast` | 500 |

**El orden es correcto**, a diferencia del de `web`: dropdown < sticky < modal < tooltip < toast.

## Medidas de layout fijas

| Medida | Valor | Origen |
|---|---|---|
| Sidebar | 263px | `Sidebar.module.scss:4` |
| Panel de propiedades | 220px | `RequirementInfoPanel.module.scss:28` |
| Panel de actividad | 558px (modal) / 559px (página) | dos implementaciones |
| Ancho máximo del modal de detalle | 1632px | `RequirementDetailModal.module.scss:19` |

> El panel de actividad difiere **1 px** entre las dos implementaciones del mismo contenido.

## Otros

**Sombras:** `--shadow-sm` / `-md` / `-lg` / `-xl`

**Transiciones:** `--transition-fast` 150ms · `-normal` 200ms · `-slow` 300ms

## Reglas de implementación

- Todo espaciado **DEBE** usar un token `--spacing-*`. **NO SE DEBEN** usar px literales.
- Todo `z-index` **DEBE** usar un token. El orden actual es correcto y conviene preservarlo.
- Las medidas de layout fijas **DEBERÍAN** ser tokens de componente, no literales repetidos.

## Gaps registrados

- Px literales de padding y gap fuera de la escala en los módulos del tablero
- Panel de actividad con 1 px de diferencia entre modal y página
- Medidas de layout fijas (263, 220, 558/559, 1632) sin tokenizar
