---
tokens: reference
version: 2.0.0
last_updated: 2026-09-02
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
color.aqua-deep     : #12897A   /* verde profundo (derivado) */
```

## Color — neutros

```
color.white         : #FFFFFF
color.ink           : #34383F   /* tinta suave — cuerpo */
color.gray.600      : #6D727B   /* texto secundario */
color.gray.400      : #9AA1AC   /* texto deshabilitado */
color.gray.200      : #DFE1E7   /* borde claro */
color.gray.100      : #EDEEF1   /* tinte grafito */
```

## Color — modo oscuro

```
color.dark.canvas   : #0E121A
color.dark.surface  : #1B202C
color.dark.primary  : #7D8699
```

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

font.size.11 : 11px
font.size.13 : 13px
font.size.14 : 14px
font.size.15 : 15px
font.size.16 : 16px
font.size.19 : 19px
font.size.30 : 30px
font.size.34 : 34px

font.weight.regular  : 400
font.weight.medium   : 500
font.weight.semibold : 600
font.weight.bold     : 700

font.tracking.tight  : -0.035em
font.tracking.snug   : -0.02em
font.tracking.normal : 0
font.tracking.caps   : 0.12em

font.leading.title : 1.1     /* 1,05–1,15 */
font.leading.body  : 1.6     /* 1,55–1,7 */
font.leading.table : 1.5
```

## Espaciado

```
space.1  : 4px
space.2  : 8px
space.4  : 16px
space.18 : 18px    /* gap de grilla de tarjetas */
space.6  : 24px
space.8  : 32px    /* padding de contenido */
space.12 : 48px
```

## Radios

```
radius.8   : 8px      /* botón */
radius.10  : 10px     /* input */
radius.14  : 14px     /* card */
radius.999 : 999px    /* pill */
```

## Alturas

```
size.40 : 40px    /* botón */
size.44 : 44px    /* input, sangrado de subítem */
size.46 : 46px    /* botón de sesión */
size.48 : 48px    /* fila de tabla, ítem de sidebar */
```

## Sombras y foco

```
shadow.card   : 0 1px 3px rgba(11,25,52,.04)
shadow.active : 0 2px 8px rgba(11,25,52,.06)
shadow.focus  : 0 0 0 3px rgba(97,204,185,.22)
```

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
```

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

- 2026-09-02 v2.0.0 — Reemplazo completo por los primitivos del Manual de marca Jiku v1.0: paleta
  de marca, neutros, modo oscuro, sistema con tintes, el par Sora/Gabarito con su escala, radios,
  alturas, sombras y motion. Se corrige el orden de `z-index`. Deja de ser placeholder (MAJOR).
- 2026-08-18 v0.1.0 — Placeholder inicial.
