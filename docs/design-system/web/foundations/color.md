---
foundation: color
version: 1.0.0
last_updated: 2026-08-18
status: relevado-desde-código
origin: relevamiento de código — web/src/styles/_variables.scss
---

# Color (web)

> **Sembrado desde el código existente.** Los valores son los que el producto usa hoy, con los
> nombres que el código les da. Las incoherencias detectadas están registradas, no corregidas:
> corregirlas es trabajo de implementación (FG-5), no de documentación.

## Propósito

Define la paleta del producto y su rol semántico. La consumen los diseñadores al componer
pantallas y los desarrolladores al implementar componentes vía tokens.

**Fuente en el código:** `web/src/styles/_variables.scss` (~70 custom properties en `:root`).

> ⚠️ **Los tokens están declarados dos veces.** `web/src/app/globals.scss:4-77` redeclara el mismo
> `:root` con los mismos valores, además de hacer `@use '@/styles/variables'` en su primera línea.
> **La fuente es `_variables.scss`**; la duplicación está registrada como gap.

## Brand

| Token DS | Variable en código | Hex | Uso observado |
|---|---|---|---|
| `color.brand.primary` | `--color-button` | **`#DA2C6A`** | Botón primario, día seleccionado del datepicker, opción seleccionada de `react-select` |
| `color.brand.accent` | `--color-general-primary` | `#FF3C3C` | Título del login, textos de error del login |
| `color.brand.link` | `--color-link-primary` | `#ed2c6c` | Links de acento |
| `color.brand.link-hover` | `--color-link-primary-hover` | `#a31342` | Hover de links de acento |

> **`color.brand.primary` es `#DA2C6A`** — el magenta de los botones primarios, que es lo que el
> usuario identifica como el color del producto. Es el valor que lee el generador de wireframes y
> el que el implementador consume vía `bg.action.primary`.
>
> `--color-general-primary` (`#FF3C3C`) **no** es el primario a pesar de su nombre: se usa solo en
> el login y en textos de error. El nombre en el código es engañoso.

## Neutrales

| Token DS | Variable en código | Hex | Uso |
|---|---|---|---|
| `color.neutral.0` | `--color-background` | `#ffffff` | Superficie de cards e inputs |
| `color.neutral.50` | `--color-surface-light` | `#f5f5f5` | Fondo de la sidebar, panel derecho del login |
| `color.neutral.75` | `--color-surface-alt` | `#f8f9fa` | (sin uso observado) |
| `color.neutral.100` | `--color-general-background` | `#F5F2F0` | Fondo del `body` y del área de contenido |
| `color.neutral.200` | `--color-surface-hover` | `#e0e0e0` | Hover de fila de tabla |
| `color.neutral.250` | `--color-general-disabled` | `#D9D9D9` | Fondo de `th`, bordes de tabla, botón secundario |
| `color.neutral.300` | `--color-general-border` | `#E2E8F0` | Borde de inputs |
| `color.neutral.500` | `--color-general-text` | `#5f6d7f` | Texto de párrafo, labels, placeholders |
| `color.neutral.900` | `--color-general-title` | `#1F2633` | Títulos `h1`/`h2`, texto de `<span>` |

**Grises secundarios de texto:** `--color-text-dark` `#222` · `-muted` `#666` · `-light` `#888` ·
`-placeholder` `#a0aec0`

**Grises de borde sin nombre semántico:** `--color-border-light` `#ccc` · `-default` `#ddd` ·
`-medium` `#e5e5e5`

> **Hay tres escalas de gris conviviendo**: la semántica (`--color-general-*`), la de texto
> (`--color-text-*`) y la de borde (`--color-border-*`), con valores que se superponen. Un
> componente nuevo no tiene una regla clara sobre cuál usar.

## Semánticos

| Token DS | Variable en código | Hex | Uso |
|---|---|---|---|
| `color.semantic.danger` | `--color-button-delete` | `#FB033F` | Botón de borrado, borde de input con error |
| `color.semantic.focus` | `--color-highlighted` | `rgb(54, 0, 136)` | Outline de foco de inputs y selects |
| `color.semantic.tooltip-bg` | `--color-tooltip-bg` | `#625F5F` | Fondo de tooltip |

**No hay tokens de `success`, `warning` ni `info` genéricos.** Los estados se expresan con la
paleta de dominio de abajo.

## Paleta de dominio

Es lo que el usuario más ve, y por eso importa que esté acá.

### Estado de proyecto

| Estado | Variable | Hex |
|---|---|---|
| `analisis` | `--color-status-analisis` | `#208CEF` |
| `activo` | `--color-status-activo` | `#2EBE27` |
| `inactivo` | `--color-status-inactivo` | `#5F6D7F` |
| `finalizado` | `--color-status-finalizado` | `#B8CBDD` |
| `cancelado` | `--color-status-cancelado` | `#FB033F` |
| `backlog` | `--color-status-backlog` | `#5F6D7F` |
| `en-revision` | `--color-status-en-revision` | `#208CEF` |

> ⚠️ **Dos pares de estados distintos son visualmente indistinguibles:**
> `inactivo` = `backlog` = `#5F6D7F`, y `analisis` = `en-revision` = `#208CEF`.

### Área de tarea

| Área | Variable | Hex |
|---|---|---|
| `diseño` | `--color-area-diseño` | `#6B5FF8` |
| `gestion` | `--color-area-gestion` | `#9AD183` |
| `desarrollo` | `--color-area-desarrollo` | `#06DAF6` |
| `investigacion` | `--color-area-investigacion` | `#FF6363` |

> La clave `diseño` lleva **`ñ`** en el nombre de la custom property.

### Prioridad (0 → 5)

Gradiente amarillo → rojo: `#FBC403` · `#ffa800` · `#ff8b04` · `#FB6B03` · `#ff472f` · `#FB033F`

### Vencimiento de tarea

`--color-objective-close-to-deadline` `#DA2C6A` · `-expired` `#FB2A2A` · `-finished` `#AAAAAA`

### Badges

`--color-badge-active` `#2e7d32` / `-bg` `#e8f5e8` · `-finished` `#757575` / `-bg` `#f5f5f5`

### Semánticos

`--color-success` `#004D20` / `-bg` `#CCFFE1` · `--color-danger` `#d32f2f` / `-bg` `#fabec8`

> Heredan los valores de los antiguos `--color-stage-{active,finished}`. Las etapas fueron
> eliminadas del modelo de datos (la tabla `stages` ya no existe) y sus tokens se removieron;
> estos dos pares sobrevivieron con nombre semántico porque no se usaban como color de etapa
> sino como verde/rojo genéricos.

## Reglas de implementación

- Todo color **DEBE** referenciar una custom property. **NO SE DEBEN** hardcodear hexadecimales en
  los módulos SCSS.
- La fuente de los tokens es **`_variables.scss`**. **NO SE DEBE** agregar ni modificar el `:root`
  de `globals.scss`, que es la copia duplicada.
- Un color de dominio nuevo (estado, área, prioridad) **DEBE** declararse como custom property,
  no inline en el componente.
- **NO SE DEBE** usar `--color-general-primary` como color primario de acción: el primario es
  `--color-button`.

## Gaps registrados

Ver [`docs/ux/gaps-as-is.md`](../../../ux/gaps-as-is.md):

- Todo el bloque `:root` está **duplicado** entre `_variables.scss` y `globals.scss`
- `inactivo`/`backlog` y `analisis`/`en-revision` comparten color: estados distintos indistinguibles
- Tres escalas de gris superpuestas sin regla de cuál usar
- Tokens de color de etapas, para un concepto eliminado del modelo
- Sin tokens semánticos de `success`/`warning`/`info`
