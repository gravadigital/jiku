---
foundation: typography
version: 2.0.0
last_updated: 2026-09-02
status: normativo
origin: Manual de marca Jiku v1.0 (septiembre 2026)
---

# Tipografía (web)

> **Normativo.** Define la tipografía que el producto **debe** usar. El código actual sirve
> **Archivo** vía `next/font/google`; la migración la reemplaza por el par Sora + Gabarito.

## Propósito

Dos familias con un reparto claro: **Sora** para el logotipo y los títulos de vista;
**Gabarito** para toda la interfaz, los datos y el microcopy.

## Familias

| Token DS | Familia | Origen | Pesos en uso |
|---|---|---|---|
| `font.family.display` | **Sora** | Google Fonts | 600 SemiBold · 700 Bold |
| `font.family.ui` | **Gabarito** | Google Fonts | 400 Regular · 500 Medium · 600 SemiBold · 700 Bold |

**Tracking:** Sora lleva tracking negativo (**−0,02 a −0,035 em**) en tamaños grandes. Gabarito va
con tracking normal; **+0,12 em sólo en labels en versalitas**.

**Sustitutas:** sin las webfonts, `Helvetica Neue, Helvetica, Arial, sans-serif`.
**Nunca Times ni ninguna serif.**

## Escala tipográfica

Siete estilos cubren toda la aplicación. **Cada uno tiene tamaño, peso y color fijos: no se
improvisan intermedios.**

| Token DS | Estilo | Familia | Tamaño / Peso | Ejemplo |
|---|---|---|---|---|
| `text.view-title` | Título de vista | Sora | **30 / 700** | «Vaitty · Validación Fiscal» |
| `text.card-title` | Título de card | Gabarito | **16 / 700** | «Información general» |
| `text.nav-item` | Ítem de sidebar | Gabarito | **15 / 500** | «Asignación de tiempo» |
| `text.body` | Cuerpo | Gabarito | **14 / 400** | «Servicio de validación fiscal de facturas» |
| `text.field-label` | Label de campo | Gabarito | **13 / 400** | «Fecha de cierre estimada» |
| `text.table-data` | Dato en tabla | Gabarito | **13 / 400** | «Grava · sys-admin — Actualización de servidores» |
| `text.filter-label` | Label de filtro | Gabarito | **11 / 600 caps** | «Ordenar por» |

### Números y métricas

| Token DS | Uso | Especificación |
|---|---|---|
| `text.metric` | Cifras destacadas | **Sora 34 / 700** — «2h» |
| `text.metric-unit` | Unidad de la métrica | **Gabarito 12 / 600 versalitas** — «total horas» |

### Breadcrumb en título

El nivel padre va en **texto secundario** (`#6D727B`); el nivel actual, en **caja baja y color
principal** (`#0B1934`). Ejemplo: «Tareas / crear».

## Interlínea

| Contexto | Valor |
|---|---|
| Títulos | **1,05 – 1,15** |
| Cuerpo | **1,55 – 1,7** |
| Datos en tabla | **1,5** |

## Tokens

### Semánticos

| Token | Valor | Uso |
|---|---|---|
| `text.view-title` | `font.family.display` 30/700, `text.primary` | Título de vista |
| `text.card-title` | `font.family.ui` 16/700, `text.primary` | Cabecera de tarjeta y panel |
| `text.body` | `font.family.ui` 14/400, `text.ink` | Cuerpo de texto |
| `text.field-label` | `font.family.ui` 13/400, `text.secondary` | Label de formulario |
| `text.filter-label` | `font.family.ui` 11/600 + `+0.12em` caps | Label de filtro y estado |

## Guidelines

**Do:**

- Usar Sora **sólo** en el logotipo, los títulos de vista y las cifras destacadas.
- Usar Gabarito para todo lo demás: interfaz, datos y microcopy.
- Declarar tamaño **y** `line-height` explícitamente en cada componente.
- Reservar las versalitas a labels y estados.

**Don't:**

- **Nunca cursiva en interfaz.**
- **NO SE DEBEN** improvisar tamaños intermedios: los siete estilos cubren la aplicación.
- **NO SE DEBE** usar una serif en ningún contexto.
- **NO SE DEBE** dejar un `line-height` igual al `font-size`.

## Deuda heredada a resolver en la migración

El relevamiento del código registró tres problemas que **esta especificación deja sin lugar**, y
que la migración debe corregir en vez de arrastrar:

1. `globals.scss` define estilos de elemento (`h1`, `h2`, `p`, `span`) que compiten con la escala
   de tokens. La escala normativa de arriba es la única fuente.
2. `line-height` igual al `font-size` en `h1`, `h2` y `p` — el texto de más de una línea se toca.
   Los valores de [Interlínea](#interlínea) los reemplazan.
3. `span` estilado globalmente a 20 px, más grande que el `p` que lo contiene. **No se estila `span`
   globalmente.**

## Accesibilidad

- Cuerpo de texto ≥ 14 px con interlínea ≥ 1,55.
- Contraste de texto según [color](./color.md#accesibilidad): ≥ 4.5:1 en cuerpo.
- Las versalitas con `+0,12 em` mejoran la legibilidad en tamaños chicos; no se usan en párrafos.
- El tamaño de texto **DEBE** poder escalar con el zoom del navegador: unidades relativas.

## Ejemplos

- [View header](../components/view-header.md) — título de vista en Sora 30/700 con breadcrumb.
- [Card](../components/card.md) — título 16/700, cuerpo 14/400, metadatos en versalitas.
- [Table](../components/table.md) — dato en tabla 13/400, interlínea 1,5.

## Historial

- 2026-09-02 v2.0.0 — Reemplazo completo por el Manual de marca Jiku v1.0. La familia pasa de
  **Archivo** al par **Sora** (display) + **Gabarito** (interfaz). Se define la escala de siete
  estilos con tamaño, peso y color fijos, la interlínea por contexto y el estilo de métricas.
  Pasa de `relevado-desde-código` a `normativo` (MAJOR).
- 2026-08-18 v1.0.0 — Sembrado desde el código existente durante la importación del producto.
