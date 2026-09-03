---
foundation: spacing
version: 2.0.0
last_updated: 2026-09-02
status: normativo
origin: Manual de marca Jiku v1.0 (septiembre 2026), «Geometría del sistema»
---

# Espaciado y geometría (web)

> **Normativo.** La geometría de abajo es la que el producto **debe** cumplir. El código actual
> declara una escala propia que sus módulos esquivan con literales; esta especificación fija los
> valores y la migración los aplica.

## Propósito

Define el ritmo espacial, los radios, las alturas y el layout del producto. **Una sola familia de
radios y una sola sombra por nivel** — es uno de los cuatro principios de aplicación de la marca.

## Radios

Cuatro valores. **Sin valores intermedios.**

| Token DS | Valor | Aplica a |
|---|---|---|
| `radius.button` | **8 px** | Botones (primario, secundario, acción de flujo) |
| `radius.input` | **10 px** | Campos de formulario, selects, botones de sesión |
| `radius.card` | **14 px** | Tarjetas, paneles, dropzone |
| `radius.pill` | **999 px** | Pills, badges, chips, toggles |

> **Excepción documentada:** el icono de app usa radio del **22 % del lienzo** (ver
> [iconography](./iconography.md)). No es parte de la escala de interfaz.

## Alturas

| Token DS | Valor | Aplica a |
|---|---|---|
| `size.input.height` | **44 px** | Campos de formulario |
| `size.button.height` | **40 px** | Botón primario y secundario |
| `size.button.session.height` | **46 px** | Botones de sesión (login / logout) |
| `size.table-row.height` | **48 px** | Fila de tabla |
| `size.nav-item.height` | **48 px** | Ítem de sidebar |
| `size.nav-subitem.indent` | **44 px** | Sangrado de subítem de sidebar |

## Layout

| Token DS | Valor | Nota |
|---|---|---|
| `layout.sidebar.width` | **300 px fijo** | Sin estado colapsado en esta versión |
| `layout.divider` | **1 px** `#DFE1E7` | Divisor de estructura |
| `layout.content.padding` | **32 px** | Padding del área de contenido |
| `layout.cards.grid` | **4 columnas · gap 18 px** | Grilla de tarjetas |

> El sidebar pasa de **290 px** (código actual) a **300 px**. Ver
> [grid](./grid.md) para el viewport único de esta superficie.

## Escala de espaciado

La escala base es de **4 px**. Los valores que la geometría del manual usa explícitamente
—18, 32, 44, 46, 48— están todos en múltiplos de 2 y son parte del sistema.

| Token DS | Valor | Uso |
|---|---|---|
| `space.xs` | 4 px | Gap mínimo entre glifo y texto |
| `space.sm` | 8 px | Gap inline en pills y badges |
| `space.md` | 16 px | Gap interno de tarjeta |
| `space.grid-gap` | **18 px** | Gap de la grilla de tarjetas |
| `space.lg` | 24 px | Separación entre bloques |
| `space.xl` | **32 px** | Padding de contenido, separación de secciones |
| `space.2xl` | 48 px | Separación entre grandes bloques de vista |

> **Deuda heredada:** el relevamiento registró que `1.25rem` (20 px) era el gap más frecuente del
> producto y no tenía token. **No se incorpora**: la grilla del manual usa 18 px y la separación de
> secciones, 32 px. Los 20 px literales se migran al valor de la escala que corresponda.

## Sombras y foco

**Una sola sombra por nivel.**

| Token DS | Valor | Uso |
|---|---|---|
| `elevation.card` | `0 1px 3px rgba(11,25,52,.04)` | Tarjetas y paneles en reposo |
| `elevation.active` | `0 2px 8px rgba(11,25,52,.06)` | Elemento activo o elevado |
| `focus.ring` | `0 0 0 3px rgba(97,204,185,.22)` | Anillo de foco — verde agua al 22 % |

Ver [elevation](./elevation.md) para el detalle y las reglas de uso.

## Z-index

| Token DS | Valor |
|---|---|
| `z.dropdown` | 100 |
| `z.modal` | 200 |
| `z.tooltip` | 300 |
| `z.navbar` | 400 |

> ⚠️ **El orden heredado está invertido y hay que corregirlo en la migración.** `z.navbar` (400) es
> mayor que `z.modal` (200) y `z.tooltip` (300): un modal abierto quedaría por debajo del sidebar.
> En el código actual el bug está neutralizado porque el sidebar usa `z-index: 10` literal. **El
> orden correcto es** `dropdown < navbar < modal < tooltip`; fijarlo es parte del trabajo de
> migración y **cambia el contrato**, así que se versiona como breaking cuando se aplique.

## Transiciones

| Token DS | Valor |
|---|---|
| `motion.fast` | 150 ms `ease` |
| `motion.base` | 200 ms `ease` |
| `motion.slow` | 300 ms `ease` |

Ver [motion](./motion.md).

## Reglas de implementación

- Todo espaciado **DEBE** usar un token. **NO SE DEBEN** usar valores literales en los módulos.
- Los radios **DEBEN** ser 8 / 10 / 14 / 999 px. **NO SE DEBE** introducir un radio intermedio
  —el `10px` literal que el relevamiento encontró ahora **es** el token de input, pero se consume
  vía token, no literal.
- Las alturas de control **DEBEN** respetar la tabla: un input mide 44 px y un botón primario,
  40 px.
- **NO SE DEBE** agregar una tercera sombra ni un segundo anillo de foco.
- Todo `z-index` **DEBE** usar un token, y **antes** hay que corregir el orden.

## Ejemplos

- [Button](../components/button.md) — radio 8 px, alto 40 px.
- [Input](../components/input.md) — radio 10 px, alto 44 px, anillo de foco al 22 %.
- [Card](../components/card.md) — radio 14 px, sombra `elevation.card`.

## Historial

- 2026-09-02 v2.0.0 — Reemplazo por la «Geometría del sistema» del Manual de marca Jiku v1.0.
  Radios fijados en 8/10/14/999 px, alturas de control, layout con sidebar de 300 px y gap de
  grilla de 18 px, dos sombras y un anillo de foco. Se descarta la incorporación de `1.25rem`.
  Pasa de `relevado-desde-código` a `normativo` (MAJOR).
- 2026-08-18 v1.0.0 — Sembrado desde el código existente durante la importación del producto.
