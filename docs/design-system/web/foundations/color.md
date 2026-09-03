---
foundation: color
version: 2.0.0
last_updated: 2026-09-02
status: normativo
origin: Manual de marca Jiku v1.0 (septiembre 2026)
---

# Color (web)

> **Normativo.** Los valores de este archivo son los que el producto **debe** usar, definidos por
> el [Manual de marca Jiku v1.0](#origen). No describen el código actual: la web todavía sirve la
> paleta rosa, que queda **descontinuada**. La conversión está en
> [Mapeo del sistema anterior](#mapeo-del-sistema-anterior) y es el insumo de la migración.

## Propósito

Define la paleta de Jiku y su rol semántico. La consumen los diseñadores al componer pantallas y
los desarrolladores al implementar componentes vía tokens.

**Principio de reparto:** el azul oscuro carga el texto y la jerarquía; el verde agua es **acento,
nunca fondo de página**; los colores de sistema informan estado y **no son marca**.

## Paleta principal

Cuatro colores sostienen la marca, con proporción de uso constante:
**60 % niebla · 24 % azul oscuro · 10 % grafito · 6 % verde agua**.

| Token DS | Nombre | Hex | RGB | CMYK | Uso |
|---|---|---|---|---|---|
| `color.brand.deep-blue` | Azul oscuro | **`#0B1934`** | 11 · 25 · 52 | 79 · 52 · 0 · 80 | Texto principal, botones secundarios, cabeceras densas |
| `color.brand.graphite` | Grafito primario | **`#626C78`** | 98 · 108 · 120 | 18 · 10 · 0 · 53 | Piezas del símbolo, iconos, estructura, glifos de área |
| `color.brand.mist` | Niebla | **`#F6F6F9`** | 246 · 246 · 249 | 1 · 1 · 0 · 2 | Fondo de aplicación en modo claro, superficies de apoyo |
| `color.brand.primary` | Verde agua | **`#61CCB9`** | 97 · 204 · 185 | 52 · 0 · 9 · 20 | Estado en curso, foco, sesión, ítem activo |

### Derivado

| Token DS | Nombre | Hex | Uso |
|---|---|---|---|
| `color.brand.primary-deep` | Verde profundo | **`#12897A`** | Texto y enlaces en verde **sobre fondos claros** |

> **`#61CCB9` sobre blanco da 1.9:1: nunca se usa para texto.** Cuando hace falta texto verde en
> fondo claro, el color es `#12897A`. El verde agua queda para superficies, bordes, barras de ítem
> activo y anillos de foco.

## Neutros de texto y borde

| Token DS | Nombre | Hex | Uso |
|---|---|---|---|
| `color.neutral.ink` | Tinta suave | `#34383F` | Cuerpo de texto |
| `color.neutral.secondary` | Texto secundario | `#6D727B` | Labels, metadatos |
| `color.neutral.disabled` | Texto deshabilitado | `#9AA1AC` | Placeholders, texto inactivo |
| `color.neutral.border` | Borde claro | `#DFE1E7` | Bordes de 1 px, divisores |
| `color.neutral.tint` | Tinte grafito | `#EDEEF1` | Chips, campos sin valor |
| `color.neutral.white` | Blanco | `#FFFFFF` | Superficies de tarjeta y documento |

**Nunca se usa negro puro ni blanco puro para texto.**

## Modo oscuro

El modo oscuro **no invierte** la paleta clara: usa su propio trío de fondo, superficie y primario.

| Token DS | Nombre | Hex | Uso |
|---|---|---|---|
| `color.dark.canvas` | Fondo oscuro | `#0E121A` | Fondo de aplicación |
| `color.dark.surface` | Superficie oscura | `#1B202C` | Tarjetas y paneles, **sin borde** |
| `color.dark.primary` | Primario en oscuro | `#7D8699` | Estructura, iconos |
| `color.dark.text` | Texto en oscuro | `#F6F6F9` | Texto sobre fondo oscuro |
| `color.brand.primary` | Acento | `#61CCB9` | **Sin cambios** entre modos |

**Reglas de superficie:**

- Modo claro: fondo niebla, tarjeta blanca, borde `#DFE1E7`.
- Modo oscuro: fondo `#0E121A`, tarjeta `#1B202C`, **sin borde** — la separación la da el contraste
  de superficie.

## Colores de sistema

Informan **estado, no identidad**. Se aplican en superficies pequeñas —puntos, pills, bordes— y
nunca compiten con la marca en fondos amplios.

| Token DS | Nombre | Hex | Estados que cubre |
|---|---|---|---|
| `color.system.resolved` | Resuelto | `#1B998B` | Finalizado, en curso |
| `color.system.medium` | Media | `#FEA82F` | Revisión, prioridad media |
| `color.system.urgent` | Urgente | `#F72C25` | Vencido, prioridad alta |
| `color.system.analysis` | Análisis | `#1F01B9` | Planificación, incidencia |

> **El verde agua de marca nunca se usa como color de sistema.** Cuando un estado necesita verde, el
> dato va en `#1B998B` y `#61CCB9` queda **sólo** para el elemento activo de interfaz.

### Tintes y bordes derivados

El tinte se calcula al **12 %** del color pleno sobre blanco; el borde, al **26 %**.

| Familia | Tinte (12 %) | Borde (26 %) | Texto (versión profunda) |
|---|---|---|---|
| Resuelto — tinte verde | `#E7F6F3` | `#CDEBE5` | `#12897A` |
| Desarrollo — tinte agua | `#E1F4F0` | `#BFE7DF` | `#12897A` |
| Revisión — tinte ámbar | `#FFF2DE` | `#FBE0B6` | `#8A5405` |
| Alta — tinte rojo | `#FDECEB` | `#FBC9C7` | `#C41F19` |
| Planificación — tinte violeta | `#E9E7FA` | `#D5D1F5` | `#1F01B9` |
| Neutro — tinte grafito | `#EDEEF1` | `#DFE1E7` | `#6D727B` |

## Fondos permitidos

La firma y la interfaz se aplican sobre **blanco, niebla o azul oscuro**.

| Fondo | Hex | Uso |
|---|---|---|
| Blanco | `#FFFFFF` | Superficies de tarjeta y documento |
| Niebla | `#F6F6F9` | Fondo de aplicación en modo claro |
| Azul oscuro | `#0B1934` | Login, cabeceras y modo oscuro |

**Panel decorativo de login** — el único fondo con textura del sistema: azul oscuro + trama de
puntos al 10 % y dos halos, verde agua arriba a la izquierda y grafito abajo a la derecha.

## Mapeo del sistema anterior

Tabla de conversión para migrar las pantallas existentes. **La paleta rosa queda descontinuada en
todos los productos.**

| Rol | Antes | Ahora |
|---|---|---|
| Primario | `#DA2C6B` | **`#61CCB9`** |
| Sesión | `#FF3B3C` | **`#61CCB9`** |
| Fondo de aplicación | `#F6F2EF` | **`#F6F6F9`** |
| Texto principal | `#192437` | **`#0B1934`** |
| Activo / resuelto | `#22C55E` | **`#1B998B`** |
| Revisión / media | `#F59E0B` | **`#FEA82F`** |
| Alta / vencido | `#B91C1C` | **`#F72C25`** |
| Planificación | `#6D28D9` | **`#1F01B9`** |

**Criterio:** todo rosa o rojo de marca se convierte en verde agua; **los rojos se reservan a
estados de vencimiento**.

**Assets reemplazados:** `logo-grava.png` → `logo-jiku.png`; el panel de login pasa del gradiente
`#EB1433 → #FEAE97` al azul oscuro con trama.

> **Correspondencia con el relevamiento.** El código servía `--color-button` `#DA2C6A` (un dígito
> de diferencia con el `#DA2C6B` que el manual nombra: es el mismo magenta) y
> `--color-general-primary` `#FF3C3C` para el login. Ambos van a `#61CCB9`. La paleta de dominio
> relevada —estados de proyecto, áreas, prioridades— **no tiene mapeo 1:1 en el manual**: se
> resuelve con las cuatro familias de sistema y sus tintes, y los pares que el relevamiento marcó
> como indistinguibles (`inactivo`/`backlog`, `analisis`/`en-revision`) dejan de serlo porque el
> estado se comunica con **punto de color + texto**, no con color solo.

## Accesibilidad

Contrastes verificados en el manual:

| Combinación | Ratio | Apto para |
|---|---|---|
| Niebla sobre azul oscuro | **14.6:1** | Texto y firma |
| Azul oscuro sobre niebla | **14.0:1** | Interfaz clara |
| Azul oscuro sobre verde agua | **9.8:1** | Botones primarios |
| Verde agua sobre blanco | **1.9:1** | **Nunca para texto** |

- Texto sobre fondo: ≥ 4.5:1 (WCAG AA, cuerpo).
- Texto grande (≥ 18 pt, o ≥ 14 pt bold): ≥ 3:1.
- Bordes interactivos visibles: ≥ 3:1 contra el fondo adyacente.
- **No comunicar estado sólo con color:** los estados combinan punto de color + texto.
- Foco visible: anillo verde agua de 3 px al 22 % — `0 0 0 3px rgba(97,204,185,.22)`.

## Reglas de implementación

- Todo color **DEBE** referenciar un token semántico. **NO SE DEBEN** hardcodear hexadecimales en
  los módulos SCSS ni consumir primitivos desde un componente.
- **NO SE DEBE** usar verde agua como fondo de página ni como color de texto sobre fondo claro.
  Para texto verde sobre claro, `#12897A`.
- **NO SE DEBE** usar un color de sistema en fondos amplios: van en puntos, pills y bordes.
- **NO SE DEBE** reintroducir ningún valor de la columna "Antes" del mapeo.
- Un color de dominio nuevo **DEBE** resolverse con una de las cuatro familias de sistema y sus
  tintes derivados, no con un hex nuevo.
- La duplicación del bloque `:root` entre `_variables.scss` y `globals.scss` **DEBE** resolverse
  durante la migración: un solo origen de tokens.

## Ejemplos

- [Button](../components/button.md) — `#61CCB9` de fondo con texto `#0B1934`.
- [Badge](../components/badge.md) — punto de color + borde derivado por familia.
- [Sidebar nav](../components/sidebar-nav.md) — ítem activo con barra verde agua de 3 px.

## Historial

- 2026-09-02 v2.0.0 — Reemplazo completo por el Manual de marca Jiku v1.0. La paleta rosa
  (`#DA2C6A`) queda descontinuada; el primario pasa a verde agua `#61CCB9` sobre azul oscuro
  `#0B1934`. Se agregan modo oscuro, colores de sistema con tintes al 12 %/26 % y la tabla de
  mapeo del sistema anterior. Pasa de `relevado-desde-código` a `normativo` (MAJOR).
- 2026-09-01 v1.0.1 — Tokens de etapa eliminados; `--color-stage-{active,finished}` renombrados a
  `--color-success`/`--color-danger`.
- 2026-08-18 v1.0.0 — Sembrado desde el código existente durante la importación del producto.
