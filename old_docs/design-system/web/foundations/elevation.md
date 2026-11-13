---
foundation: elevation
version: 2.0.0
last_updated: 2026-09-02
status: normativo
origin: Manual de marca Jiku v1.0 (septiembre 2026) — «Geometría del sistema»
---

# Elevación (web)

> **Normativo.** Define las sombras del sistema. **Una sola sombra por nivel** es uno de los cuatro
> principios de aplicación de la marca.

## Propósito

Define cómo se separan las superficies entre sí. En modo claro, con sombra mínima y borde; en modo
oscuro, **con contraste de superficie y sin borde ni sombra**.

## Niveles

| Token DS | Valor | Uso |
|---|---|---|
| `elevation.flat` | `none` | Superficies al ras: fondo de aplicación, filas de tabla |
| `elevation.card` | `0 1px 3px rgba(11,25,52,.04)` | Tarjetas y paneles en reposo |
| `elevation.active` | `0 2px 8px rgba(11,25,52,.06)` | Elemento activo, hover de tarjeta, dropdown abierto |

**Sólo hay dos sombras.** Ambas se construyen con el azul oscuro de marca a muy baja opacidad
—nunca con negro puro— para que la sombra pertenezca a la paleta.

## Foco

El anillo de foco no es una elevación, pero comparte el mecanismo de `box-shadow`:

| Token DS | Valor |
|---|---|
| `focus.ring` | `0 0 0 3px rgba(97,204,185,.22)` |

Verde agua al **22 %**, 3 px, sin desplazamiento. Es el único indicador de foco del sistema.

## Separación de superficies por modo

| Modo | Fondo | Tarjeta | Separación |
|---|---|---|---|
| Claro | Niebla `#F6F6F9` | Blanco `#FFFFFF` | Borde `1 px #DFE1E7` + `elevation.card` |
| Oscuro | `#0E121A` | `#1B202C` | **Contraste de superficie, sin borde ni sombra** |

## Tokens

| Token semántico | Valor | Uso |
|---|---|---|
| `surface.raised` | `elevation.card` + `border.default` | Tarjeta en modo claro |
| `surface.raised.dark` | `color.dark.surface`, sin borde | Tarjeta en modo oscuro |
| `surface.overlay` | `elevation.active` | Dropdown, tooltip, elemento flotante |

## Guidelines

**Do:**

- Usar `elevation.card` para tarjetas en reposo y `elevation.active` para lo que flota o está
  activo.
- En modo oscuro, separar por contraste de superficie.
- Construir cualquier sombra con `rgba(11,25,52,·)`.

**Don't:**

- **NO SE DEBE** agregar un tercer nivel de sombra.
- **NO SE DEBE** usar sombra negra pura ni sombras de varias capas.
- **NO SE DEBE** poner borde **y** sombra fuerte a la vez: el borde claro ya separa.
- **NO SE DEBE** usar sombra en modo oscuro.

## Accesibilidad

- La elevación **NO DEBE** ser el único indicador de estado: un elemento activo se marca además
  con color o barra.
- El anillo de foco **DEBE** ser visible en ambos modos y **NO DEBE** suprimirse con
  `outline: none` sin reemplazo.
- La sombra no aporta contraste: los bordes de un control interactivo cumplen ≥ 3:1 por sí solos.

## Ejemplos

- [Card](../components/card.md) — `elevation.card` con borde claro.
- [Sidebar nav](../components/sidebar-nav.md) — ítem activo con `elevation.active`.
- [Input](../components/input.md) — `focus.ring` al recibir foco.

## Historial

- 2026-09-02 v2.0.0 — Definición desde la «Geometría del sistema» del Manual de marca Jiku v1.0:
  dos sombras construidas con el azul de marca, anillo de foco verde agua al 22 % y separación de
  superficies por modo. Reemplaza el placeholder (MAJOR).
- 2026-08-18 v0.1.0 — Placeholder inicial.
