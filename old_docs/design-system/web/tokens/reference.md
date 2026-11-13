---
tokens: reference
version: 2.1.0
last_updated: 2026-09-04
status: normativo
origin: Manual de marca Jiku v1.0 (septiembre 2026)
---

# Tokens — Reference (primitivos)

> **Normativo.** Reemplaza el placeholder genérico (paleta azul/gris inventada) por los valores
> reales del Manual de marca Jiku v1.0.

## Propósito

Tier 1 de la jerarquía de tokens:

```
Reference (primitivos)  ←  ESTE NIVEL
        ↓
Semantic (alias)
        ↓
Component (por componente)
```

Es el **inventario crudo** de valores. **NO se consumen directamente desde componentes:** siempre
vía tokens semánticos.

## Color — marca

```
color.deep-blue     : #0B1934   /* azul oscuro */
color.graphite      : #626C78   /* grafito primario */
color.mist          : #F6F6F9   /* niebla */
color.aqua          : #61CCB9   /* verde agua */
color.aqua-hover    : #7BD8C7   /* hover del acento */
color.aqua-deep     : #12897A   /* verde profundo (derivado) */
```

> **`color.aqua-hover` es MÁS CLARO que el acento, no más oscuro.** El manual lo fija así: el
> hover del botón primario aclara el verde agua en vez de oscurecerlo.

## Color — neutros

```
color.white         : #FFFFFF
color.ink           : #34383F   /* tinta suave — cuerpo */
color.gray.600      : #6D727B   /* texto secundario */
color.gray.400      : #9AA1AC   /* texto deshabilitado */
color.gray.300      : #C9D0DA   /* borde punteado del dropzone en modo claro */
color.gray.200      : #DFE1E7   /* borde claro */
color.gray.100      : #EDEEF1   /* tinte grafito */
```

## Color — modo oscuro

El manual declara para oscuro un **trío propio** —fondo, superficie y primario— y **no** una
inversión de la paleta clara. Todos los valores de esta sección vienen del handoff de identidad
(`design_handoff_jiku_identity/tokens/jiku-tokens.css`), copiados literalmente: **no se derivan de
los claros por fórmula.**

```
color.dark.canvas   : #0E121A   /* fondo de aplicación */
color.dark.surface  : #1B202C   /* superficie de card */
color.dark.primary  : #7D8699   /* primario / texto secundario */
color.dark.text     : #F6F6F9   /* texto principal */
```

### Superficies, bordes y textos propios del modo oscuro

```
color.dark.sidebar     : #0B1319   /* el sidebar es MÁS oscuro que el canvas */
color.dark.border      : #2A3141
color.dark.dash        : #3A4356  /* borde punteado del dropzone */
color.dark.body        : #C6CCD8  /* cuerpo de texto */
color.dark.placeholder : #6D727B
color.dark.row-alt     : #161C27  /* fila alterna, superficie hundida */
color.dark.input-bg    : #141A24  /* el campo es más hundido que la card */
```

### Tintes, bordes y textos de estado en modo oscuro

Cada familia declara su **trío completo: tinte, borde Y texto**. Son valores explícitos del
manual, uno por familia y por modo — no la composición por opacidad del tinte claro.

```
color.dark.tint.green    : #12312D   color.dark.tint-border.green    : #1D4A43   color.dark.deep.green    : #61CCB9
color.dark.tint.aqua     : #14322F   color.dark.tint-border.aqua     : #205049   color.dark.deep.aqua     : #A9E4DA
color.dark.tint.amber    : #33240E   color.dark.tint-border.amber    : #5A3F16   color.dark.deep.amber    : #FEC97A
color.dark.tint.red      : #351514   color.dark.tint-border.red      : #5C2320   color.dark.deep.red      : #FF8A84
color.dark.tint.violet   : #1B1740   color.dark.tint-border.violet   : #2E2769   color.dark.deep.violet   : #A9A0FF
color.dark.tint.graphite : #232A38   color.dark.tint-border.graphite : #313A4B   color.dark.deep.graphite : #B9C0CC
```

> **Por qué existen los seis `deep` oscuros.** Antes el texto de estado no se redeclaraba en
> oscuro: cada familia conservaba su profundo del modo claro sobre un tinte oscuro. El violeta
> daba **1.38:1** de contraste y el ámbar **2.07:1** — las **seis** familias fallaban AA. Con
> estos valores dan entre **7.2:1 y 9.9:1**, y el test `styles/dark-mode-tints.test.ts` calcula el
> ratio en vez de asumirlo.

### Sombras de modo oscuro

Las sombras claras usan `rgba(11,25,52,…)` (azul oscuro), invisible sobre un canvas oscuro. Estas
se componen sobre negro con la misma intención (elevación / foco).

```
shadow.dark.card   : 0 1px 3px rgba(0,0,0,.32)
shadow.dark.active : 0 2px 8px rgba(0,0,0,.48)
shadow.dark.focus  : 0 0 0 3px rgba(97,204,185,.22)
```

> El anillo de foco conserva **el mismo verde agua al 22 %** que en modo claro: el acento no
> cambia entre modos.

## Color — sistema

```
color.system.resolved : #1B998B
color.system.medium   : #FEA82F
color.system.urgent   : #F72C25
color.system.analysis : #1F01B9
```

### Tintes (12 %) y bordes (26 %)

```
color.tint.green    : #E7F6F3   color.tint-border.green  : #CDEBE5
color.tint.aqua     : #E1F4F0   color.tint-border.aqua   : #BFE7DF
color.tint.amber    : #FFF2DE   color.tint-border.amber  : #FBE0B6
color.tint.red      : #FDECEB   color.tint-border.red    : #FBC9C7
color.tint.violet   : #E9E7FA   color.tint-border.violet : #D5D1F5
color.tint.graphite : #EDEEF1   color.tint-border.graphite: #DFE1E7
```

### Texto profundo por familia

```
color.deep.green    : #12897A
color.deep.amber    : #8A5405
color.deep.red      : #C41F19
color.deep.violet   : #1F01B9
```

## Tipografía

```
font.family.display : Sora, Helvetica Neue, Helvetica, Arial, sans-serif
font.family.ui      : Gabarito, Helvetica Neue, Helvetica, Arial, sans-serif

font.size.9  : 9px     /* único uso: label del pie de métricas de la card de tarea */
font.size.10 : 10px    /* label de la card de métrica y pie del login — el más chico en versalitas */
font.size.11 : 11px
font.size.12 : 12px    /* dato del pie de métricas, responsable de la card, código de proyecto */
font.size.13 : 13px
font.size.14 : 14px
font.size.15 : 15px
font.size.16 : 16px
font.size.17 : 17px    /* glifo «+» del FAB de sección */
font.size.19 : 19px
font.size.30 : 30px
font.size.34 : 34px
font.size.44 : 44px    /* único uso: el «Bienvenido» del login */

font.weight.regular  : 400
font.weight.medium   : 500
font.weight.semibold : 600
font.weight.bold     : 700

font.tracking.tight      : -0.035em
font.tracking.snug       : -0.02em
font.tracking.normal     : 0
font.tracking.caps-table : 0.08em    /* cabecera de tabla */
font.tracking.caps       : 0.12em    /* labels de filtro */
font.tracking.caps-wide  : 0.14em    /* label de métrica y pie del login */

font.leading.title   : 1.1     /* 1,05–1,15 */
font.leading.display : 1.05    /* título del login (44px) */
font.leading.body    : 1.6     /* 1,55–1,7 */
font.leading.table   : 1.5
```

> **Los tres trackings de versalitas no son intercambiables.** `caps-table` (.08em) es **más
> cerrado** que el de los labels de filtro porque la cabecera de tabla tiene más columnas en menos
> ancho; `caps-wide` (.14em) es el más abierto, para el label de métrica y el pie del login.
> `font.leading.display` es más cerrado que `title` porque el tamaño es mayor.

## Espaciado

```
space.1  : 4px
space.2  : 8px
space.4  : 16px
space.18 : 18px    /* gap de grilla de tarjetas */
space.6  : 24px
space.26 : 26px    /* separación entre tabs — el manual la fija aparte de la escala */
space.8  : 32px    /* padding de contenido */
space.12 : 48px
```

## Layout

```
layout.sidebar.width : 300px    /* ancho fijo del sidebar */
layout.app.min-width : 1400px   /* ancho mínimo del producto */
```

> **El producto es desktop-only, por decisión.** Por debajo de `layout.app.min-width` la app
> **scrollea en horizontal, no se reacomoda**: el handoff no define diseño responsive móvil.

## Radios

```
radius.8   : 8px      /* botón */
radius.10  : 10px     /* input */
radius.14  : 14px     /* card */
radius.999 : 999px    /* pill */

radius.glyph : 3px    /* esquina del glifo cuadrado (10×10) de la etiqueta de card */
```

> **`radius.glyph` está deliberadamente FUERA de la escala de radios de superficie**, que sigue
> cerrada en cuatro valores (8 / 10 / 14 / 999). Esto no es una superficie: es el redondeo de un
> glifo.

## Alturas

```
size.19 : 19px    /* alto y ancho mínimo del contador de la tab */
size.28 : 28px    /* diámetro del FAB de sección (el «+» de una card) */
size.34 : 34px    /* diámetro del nodo del stepper */
size.40 : 40px    /* botón */
size.44 : 44px    /* input, sangrado de subítem */
size.46 : 46px    /* botón de sesión */
size.48 : 48px    /* fila de tabla, ítem de sidebar */
```

> `size.28` y `size.34` los fija el manual **aparte** de la altura de control: el FAB no es un
> botón de 40 y el nodo del stepper no es una fila.

## Panel decorativo del login

El único fondo con textura del sistema, y la única superficie con **geometría propia**.

```
login.panel.corner : 22px    /* radio del panel */
login.panel.gap    : 22px    /* separación respecto del borde de la ventana */
login.stack.gap    : 40px    /* separación entre bloques de la columna */
login.title.gap    : 14px    /* separación entre el título y su bajada */
```

> **Deliberadamente FUERA del namespace `radius.*` y de la escala de espaciado**, que son escalas
> cerradas: estas no son medidas del sistema, son las medidas de una pieza única que el manual fija
> para esta pantalla.

## Sombras y foco

```
shadow.card   : 0 1px 3px rgba(11,25,52,.04)
shadow.active : 0 2px 8px rgba(11,25,52,.06)
shadow.focus  : 0 0 0 3px rgba(97,204,185,.22)

shadow.step-ring : 0 0 0 4px rgba(97,204,185,.2)   /* anillo del nodo actual del stepper */
```

> **`shadow.step-ring` no es `shadow.focus`.** El anillo del nodo actual del stepper es
> **decoración**, no foco de teclado: por eso es un valor propio (4px al 20 %, no 3px al 22 %).

## Motion

```
duration.fast : 150ms
duration.base : 200ms
duration.slow : 300ms
easing.default : ease
```

## Iconos

```
icon.14 : 14px    icon.16 : 16px    icon.19 : 19px
icon.22 : 22px    icon.24 : 24px
icon.stroke : 1.6px
icon.grid   : 24px

border.width.emphasis : 1.5px   /* borde de secundarios y del nodo actual del stepper */
```

> `border.width.emphasis` es **más marcado** que el borde de 1px de las superficies: el manual fija
> 1,5px para el borde de los botones secundarios y del stepper actual.

## Z-index

```
z.dropdown : 100
z.navbar   : 200
z.modal    : 300
z.tooltip  : 400
```

> El orden se corrigió respecto del código actual, donde `navbar` (400) estaba por encima de
> `modal` (200). Ver [spacing](../foundations/spacing.md#z-index).

## Reglas

- **No consumir desde componentes directamente.** Siempre vía tokens semánticos.
- **No agregar valores arbitrarios.** Un valor nuevo requiere justificación y entra al manual.
- **Cambios acá afectan TODO** — modificar un valor existente es MAJOR.
- Los primitivos se nombran por **lo que son** (`color.aqua`), no por lo que hacen.

## Historial

- 2026-09-04 v2.1.0 — Se documenta la paleta completa de modo oscuro (superficies, bordes, textos,
  los seis tríos tinte/borde/**texto** de estado y las tres sombras oscuras), el hover del acento
  `color.aqua-hover`, `color.gray.300`, los tamaños de fuente 9/10/12/17/44, los trackings
  `caps-table` y `caps-wide`, `font.leading.display`, `space.26`, `size.19/28/34`, `radius.glyph`,
  `border.width.emphasis`, `shadow.step-ring`, `layout.app.min-width` y la geometría del panel del
  login. Todo additivo (MINOR).
- 2026-09-02 v2.0.0 — Reemplazo completo por los primitivos del Manual de marca Jiku v1.0: paleta
  de marca, neutros, modo oscuro, sistema con tintes, el par Sora/Gabarito con su escala, radios,
  alturas, sombras y motion. Se corrige el orden de `z-index`. Deja de ser placeholder (MAJOR).
- 2026-08-18 v0.1.0 — Placeholder inicial.
