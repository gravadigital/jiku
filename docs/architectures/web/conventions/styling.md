---
id: styling
display_name: Estilado (Sass + CSS Modules + custom properties)
language: nextjs
description: CSS Modules con Sass, tokens en :root, mixins compartidos, sin librería de componentes
applies_to: [frontend]
required_by: []
package: sass
---

# Estilado (web)

> **Reemplaza** la convención `styling` del catálogo, que usa Tailwind CSS con `cn()` y `cva`.
> Acá se usa Sass + CSS Modules + custom properties. El helper `cn()` sí existe, con otra
> implementación (no hay `clsx` ni `tailwind-merge`).

## Estructura

```
src/
├── app/globals.scss        reset + estilos de elemento residuales + estilos de librerías de terceros
├── styles/
│   ├── index.scss          @forward del resto del directorio
│   ├── _reference.scss     tier 1 — primitivos: color.aqua, radius.8, space.4 (hex legítimos acá)
│   ├── _semantic.scss      tier 2 — alias: bg.action.primary, text.body, radius.field
│   ├── _component.scss     tier 3 — por componente: button.primary.bg, dropzone.radius
│   ├── _variables.scss     sistema VIEJO (pre-identidad Jiku): 13 tokens legacy, ~52 hex, paleta
│   │                       de dominio (estado/área/prioridad) sin tier nuevo todavía
│   └── _mixins.scss        tipografía, layout, componentes, breakpoints, accesibilidad
└── **/Componente.module.scss   un módulo por componente, junto al .tsx
```

`next.config.js` agrega `styles/` a los `includePaths` de Sass.

### Los tres tiers de tokens (identidad Jiku, REQ-013)

Los componentes consumen **semánticos o de componente, nunca primitivos ni hex**. La regla es
absoluta: `--color-aqua` no se usa directo en un módulo, se usa `--bg-action-primary` (que
resuelve a `--color-aqua`) o `--button-primary-bg` (que resuelve a `--bg-action-primary`).

| Tier | Archivo | Ejemplo | Consume |
|---|---|---|---|
| 1 — Referencia | `_reference.scss` | `--color-aqua: #61CCB9` | Hex literal — **el único lugar donde es legítimo** |
| 2 — Semántico | `_semantic.scss` | `--bg-action-primary: var(--color-aqua)` | Sólo tier 1 |
| 3 — Componente | `_component.scss` | `--button-primary-bg: var(--bg-action-primary)` | Sólo tier 2 |

`_variables.scss` es el **sistema anterior**, previo a la identidad Jiku: 13 tokens
(`--font-primary`, `--color-button`, etc.) que un guardia de regresión
(`features/design-system-migration.guard.test.ts`) impide reintroducir en el resto de la
superficie. Sobrevive porque la paleta de dominio (estado de proyecto, área, prioridad) todavía no
tiene equivalente en el tier nuevo — ver `docs/ux/gaps-as-is.md`.

## Un módulo por componente

```
shared/components/ui/Button/
├── Button.tsx
├── Button.module.scss
└── index.ts
```

```tsx
import styles from './Button.module.scss';
<span className={styles.buttonContainer}>
```

**Reglas:**

- Nombre del módulo = nombre del componente. Las páginas usan `styles.module.scss` (sin prefijo)
  porque el nombre del archivo ya es `page.tsx`.
- Clases en `camelCase`, no `kebab-case`: CSS Modules las expone como propiedades de un objeto y
  `styles.buttonContainer` es válido mientras `styles.button-container` no.
- El módulo empieza con `@use '@/styles' as *;` cuando necesita mixins. Sin eso, los `@include`
  no resuelven.

## Composición de clases: `cn()`

```ts
// src/shared/utils/cn.ts
type ClassValue = string | undefined | null | false | Record<string, boolean>;
export const cn = (...classes: ClassValue[]): string => /* ... */;
```

Acepta strings y objetos `{ clase: condición }`:

```tsx
className={cn(styles.row, styles.level1)}
className={cn(styles.option, { [styles.active]: value === option.key })}
className={cn(styles.dot, styles[status])}
```

**Reglas:**

- Usar `cn()` para clases condicionales. **No** template strings: el patrón
  `` `${styles.a} ${cond && styles.b}` `` escribe el string `"false"` en el `class` cuando la
  condición no se cumple. Existe hoy en `NavItem.tsx:48-51`, `NavSubItem.tsx:49-52` y
  `ObjectiveComment.tsx` — es un bug latente, no el patrón.
- No es `clsx` ni hace merge de clases de Tailwind. No acepta arrays.

## Tokens

Todos son custom properties en `:root`, en el tier que corresponda (ver arriba). Categorías del
sistema vigente (identidad Jiku):

| Grupo | Ejemplos | Tier |
|---|---|---|
| Color de marca | `--color-aqua`, `--color-deep-blue`, `--color-mist`, `--color-graphite` | 1 |
| Fondo | `--bg-canvas`, `--bg-surface`, `--bg-action-primary`, `--bg-tint-neutral`, `--bg-active` | 2 |
| Texto | `--text-primary`, `--text-body`, `--text-secondary`, `--text-disabled`, `--text-link`, `--text-on-action` | 2 |
| Borde | `--border-default`, `--border-focus`, `--border-action` | 2 |
| Feedback de estado (6 familias) | `--state-{resolved,in-progress,review,urgent,analysis,neutral}-{full,tint,border,text}` | 2 |
| Tipografía semántica (7 estilos) | `--text-view-title-*`, `--text-body-default-*`, `--text-field-label-*`, `--text-table-data-*`, `--text-filter-label-*` | 2 |
| Espaciado | `--space-{1,2,4,6,8,18}` = 4 / 8 / 16 / 24 / 32 / 72 px | 1 |
| Tipografía primitiva | `--font-size-{11,13,14,15,16,19,30,34}` (px), `--font-family-ui` (Gabarito), `--font-family-display` (Sora) | 1 |
| Pesos | `--font-weight-{regular,medium,semibold,bold}` = 400/500/600/700 | 1 |
| Radios | `--radius-{8,10,14,999}` (primitivo) → `--radius-{action,field,surface,pill}` (semántico) | 1/2 |
| Sombras | `--shadow-card`, `--shadow-active`, `--shadow-focus` → `--elevation-{surface,raised}`, `--focus-ring` | 1/2 |
| Duración | `--duration-{fast,base,slow}` = 150 / 200 / 300 ms | 1 |
| Z-index | `--z-{dropdown,modal,tooltip}` = 100 / 300 / 400 | 1 |
| Por componente | `--button-primary-bg`, `--dropzone-radius`, `--select-radius`, `--avatar-radius`, … | 3 |

La tipografía es **Sora** (títulos de vista y cifras destacadas) + **Gabarito** (interfaz, datos,
microcopy), ambas de `next/font/google`, expuestas como `--font-family-display` y
`--font-family-ui`.

**Reglas:**

- Usar el token semántico o de componente, nunca el primitivo directo ni el hex literal. Los hex
  legítimos viven **sólo** en `_reference.scss` — el guardia de regresión
  (`features/design-system-migration.guard.test.ts`) falla si aparecen en cualquier otro
  `.module.scss`/`.tsx` de la superficie.
- Color nuevo: agregarlo a `_reference.scss` (primitivo) y derivarlo en `_semantic.scss` o
  `_component.scss` según su rol — nunca consumirlo directo desde un componente.
- La paleta de dominio (estado de proyecto, área, prioridad) todavía referencia `_variables.scss`
  (el sistema anterior): no tiene tier nuevo. Ver `docs/ux/gaps-as-is.md`.

Los tokens se declaran **una sola vez**: `globals.scss` no redeclara ningún custom property — sólo
consume los que `_reference.scss`/`_semantic.scss`/`_component.scss` ya definen.

## Modo oscuro (S-059)

Selector `:root[data-theme='dark']` en `_semantic.scss`, activado por `ThemeToggle`
(`features/theme/`) y persistido en `localStorage`. **Es una paleta propia, no una inversión
matemática de la clara**: cada token semántico que cambia entre modos tiene su propio valor
declarado explícitamente (`--bg-canvas`, `--text-primary`, los `-tint`/`-border` de las 6 familias
de estado, las sombras), nunca un `filter: invert()` ni una fórmula.

**El acento no se redeclara.** `--bg-action-primary`, `--bg-active`, `--border-action`,
`--border-focus`, `--border-required`, `--text-link` y `--text-on-action` quedan **iguales en los
dos modos** — el verde agua no cambia entre claro y oscuro.

Un componente nuevo no necesita saber en qué modo está: consume el token semántico y el modo
resuelve el valor correcto por sí solo. No escribir `[data-theme='dark'] &` en un módulo de
componente salvo que el componente declare su propio token de tier 3 con variante oscura — el
patrón vive en `_semantic.scss`, no repartido por los módulos.

## Mixins

`_mixins.scss` agrupa lo repetido. Los más usados:

| Categoría | Mixins |
|---|---|
| Tipografía | `heading-1`, `heading-2`, `heading-3`, `body-text`, `body-large`, `body-small`, `label-text` |
| Layout | `flex-center`, `flex-between`, `flex-start`, `flex-end`, `flex-column`, `flex-column-center`, `grid-auto-fill`, `grid-auto-fit` |
| Componentes | `card-base`, `card-interactive`, `table-container`, `button-{base,primary,secondary,danger}`, `input-base`, `input-error`, `tag-base`, `status-tag` |
| Utilidades | `truncate`, `truncate-lines($n)`, `visually-hidden`, `scrollbar-thin`, `no-select`, `aspect-ratio`, `hover-lift`, `smooth-scroll` |
| Accesibilidad | `focus-ring`, `focus-ring-light`, `focus-ring-shadow`, `sr-only` |
| Resets | `button-reset`, `link-reset` |
| Iconos | `icon-tint($color, $size)` |

`icon-tint` merece nota: recolorea un SVG importado como asset vía CSS mask, sin duplicar el
archivo. La URL llega por la custom property `--icon-mask-url` que el componente setea, porque
Next resuelve el import del asset a una ruta de build que Sass no puede referenciar. Es lo que usa
`<TintedIcon>`.

**Regla:** antes de escribir un `display: flex; align-items: center; justify-content: space-between`
a mano, buscar el mixin. Existe (`flex-between`).

## Breakpoints

Declarados como mixins en `_mixins.scss:316-339`:

| Mixin | Media query | Origen |
|---|---|---|
| `mobile` | `max-width: 767px` | `_mixins.scss:318` |
| `tablet` | `min-width: 768px` y `max-width: 1023px` | `_mixins.scss:324` |
| `desktop` | `min-width: 1024px` | `_mixins.scss:330` |
| `large-desktop` | `min-width: 1440px` | `_mixins.scss:336` |

```scss
.summaryCards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  @include mobile { grid-template-columns: repeat(2, 1fr); }
}
```

### El uso real

**Solo `mobile` se usa.** Seis veces, en cinco archivos:

| Archivo | Línea |
|---|---|
| `features/projects/components/ProjectDetails/ProjectDetails.module.scss` | 25 — *el componente es código muerto* |
| `features/objectives/components/ObjectiveDetails/ObjectiveDetails.module.scss` | 106 |
| `features/clients/components/ClientListFilters/ClientListFilters.module.scss` | 19 |
| `features/worked-times/components/SummaryCards/SummaryCards.module.scss` | 8 |
| `features/worked-times/components/ReportPage/ReportPage.module.scss` | 13, 24 |

`tablet`, `desktop` y `large-desktop` tienen **cero usos**.

En paralelo hay **14 `@media` crudas** que no pasan por los mixins, con ocho valores distintos:

| Valor | Ocurrencias | Dónde |
|---|---|---|
| `max-width: 640px` | 3 | `CreateRequirementForm.module.scss:322,479`, `EditRequirementForm.module.scss:416` |
| `max-width: 1024px` | 2 | `CreateRequirementForm.module.scss:94`, `EditRequirementForm.module.scss:94` |
| `max-width: 1023px` | 2 | `RequirementHeader.module.scss:10`, `RequirementDetail.module.scss:12` |
| `min-width: 1680px` | 1 | `ObjectivesGroup.module.scss:93` |
| `max-width: 1200px` | 1 | `app/(loggedin)/projects/[id]/styles.module.scss:85` |
| `max-width: 900px` | 1 | `app/(loggedin)/clients/edit/[id]/styles.module.scss:108` |

**Regla para código nuevo:** usar los mixins, no `@media` cruda. Y si un valor nuevo hace falta,
agregarlo como mixin en `_mixins.scss` en vez de escribirlo inline.

**Contexto honesto:** el shell de la aplicación no tiene tratamiento responsive —
`(loggedin)/styles.module.scss` define `display: flex; height: 100vh; overflow: hidden` con la
sidebar en `width: 290px` y ningún media query. Por debajo de ~900 px el contenido queda con muy
poco ancho. El detalle por pantalla está en el relevamiento UX.

## Estilos globales y de terceros

`globals.scss` **no declara ningún custom property** — sólo consume los que los tres tiers ya
definen. Tiene:

- Un reset (`* { box-sizing; padding: 0; margin: 0 }` + reset tipo Meyer).
- **Estilos de elemento residuales**: `table`, `th`, `td`, `tr:hover`, `span`, `input`. Las tablas
  y los inputs base ad-hoc salen de acá, no de un componente — para casos nuevos, usar
  [`Table`](../../../design-system/web/components/table.md) o
  [`Input`](../../../design-system/web/components/input.md) del DS.
- Overrides de librerías: `.react-datepicker__*` y `.CodeMirror` / `.editor-toolbar` (EasyMDE).
- La clase `.sr-only`.

**Ya no declara `h1`, `h2` ni `p` desnudos** (S-060): esas reglas usaban `--font-primary` y
literales fuera de la escala tipográfica. Cada vista resuelve su propio `<h1>` con clase propia
sobre `--text-view-title-*` — ver [`ViewHeader`](../../../design-system/web/components/view-header.md)
para el patrón normativo, y `ErrorPageContent` (`app/(loggedin)/`) como ejemplo de una vista sin
componente de cabecera dedicado.

**Reglas:**

- Los overrides de terceros van en `globals.scss`, no en un módulo. Un módulo hashea la clase y
  no matchea con lo que renderiza la librería.
- **No agregar estilos de elemento nuevos.** El `span`/`td` que quedan son deuda heredada, no el
  patrón — un componente nuevo styling con clase propia, nunca con un selector de elemento global.

## Qué NO hacer

- No estilos inline salvo valores calculados en runtime (una barra de progreso:
  `style={{ width: `${pct}%` }}`). `unauthorized/page.tsx` está todo inline y es la excepción, no
  el modelo.
- No hex literales: usar tokens.
- No `@media` cruda: usar los mixins.
- No template strings para clases condicionales: usar `cn()`.
- No introducir Tailwind ni una librería de componentes sin decidir qué pasa con los 117 módulos
  existentes.
