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
├── app/globals.scss        reset + tokens en :root + estilos de librerías de terceros
├── styles/
│   ├── index.scss          @forward de variables y mixins
│   ├── _variables.scss     ~70 custom properties en :root
│   └── _mixins.scss        tipografía, layout, componentes, breakpoints, accesibilidad
└── **/Componente.module.scss   un módulo por componente, junto al .tsx
```

117 módulos `.scss`. `next.config.js:17-24` agrega `styles/` a los `includePaths` de Sass.

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

Todos son custom properties en `:root`, declaradas en `_variables.scss`.

### Categorías

| Grupo | Ejemplos |
|---|---|
| Base | `--color-general-title`, `--color-general-text`, `--color-general-background`, `--color-general-border`, `--color-general-primary`, `--color-general-disabled` |
| Botones | `--color-button` (#DA2C6A), `--color-button-delete`, `--color-highlighted` |
| Estado de proyecto | `--color-status-{analisis,activo,cancelado,inactivo,finalizado,backlog,en-revision}` |
| Área de tarea | `--color-area-{diseño,gestion,desarrollo,investigacion}` |
| Prioridad | `--color-priority-0` … `--color-priority-5` |
| Semánticos | `--color-success`, `--color-danger` y su `-bg` |
| Superficie | `--color-background`, `--color-surface-{light,hover,alt}`, `--color-tooltip-bg` |
| Espaciado | `--spacing-{xs,sm,md,lg,xl,2xl}` = 0.25 / 0.5 / 1 / 1.5 / 2 / 3 rem |
| Tipografía | `--font-size-{xs,sm,base,md,lg,xl,2xl}` = 10 / 12 / 14 / 16 / 20 / 24 / 32 px |
| Pesos | `--font-weight-{normal,medium,semibold,bold,extrabold}` |
| Radios | `--radius-items` (0.5rem), `--radius-cards` (1rem), `--radius-buttons` |
| Sombras | `--box-shadow`, `--box-shadow-hover` |
| Transiciones | `--transition-{fast,base,slow}` = 150 / 200 / 300 ms |
| Z-index | `--z-index-{dropdown,modal,tooltip,navbar}` = 100 / 200 / 300 / 400 |

La tipografía es **Archivo** de Google Fonts, cargada con `next/font/google` y expuesta como
`--font-primary` (`app/layout.tsx:6-10`).

**Reglas:**

- Usar el token, nunca el hex literal. Los hex que quedan hardcodeados están en los objetos
  `selectStyles` de `react-select` y en `unauthorized/page.tsx` (estilos inline) — no son el
  patrón.
- Color nuevo: agregarlo a `_variables.scss` en el grupo que corresponda.

> **Los tokens están duplicados.** `globals.scss:4-77` declara un `:root` con los mismos valores
> que `_variables.scss:6-160`. Los dos se cargan (`globals.scss` hace `@use '@/styles/variables'`
> en su primera línea *y además* redeclara). Al agregar o cambiar un token hay que revisar los dos
> archivos, o el valor viejo puede ganar según el orden de carga.

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

`globals.scss` tiene, además de los tokens:

- Un reset (`* { box-sizing; padding: 0; margin: 0 }` + reset tipo Meyer).
- **Estilos de elemento**: `table`, `th`, `td`, `tr:hover`, `h1`, `h2`, `p`, `span`, `input`. Las
  tablas y los inputs base salen de acá, no de un componente.
- Overrides de librerías: `.react-datepicker__*` y `.CodeMirror` / `.editor-toolbar` (EasyMDE).
- La clase `.sr-only`.

**Reglas:**

- Los overrides de terceros van en `globals.scss`, no en un módulo. Un módulo hashea la clase y
  no matchea con lo que renderiza la librería.
- **No agregar más estilos de elemento.** `span { font-size: 1.25rem }` y
  `td { max-width: 9.4rem }` ya obligan a pelearlos desde los módulos.

## Qué NO hacer

- No estilos inline salvo valores calculados en runtime (una barra de progreso:
  `style={{ width: `${pct}%` }}`). `unauthorized/page.tsx` está todo inline y es la excepción, no
  el modelo.
- No hex literales: usar tokens.
- No `@media` cruda: usar los mixins.
- No template strings para clases condicionales: usar `cn()`.
- No introducir Tailwind ni una librería de componentes sin decidir qué pasa con los 117 módulos
  existentes.
