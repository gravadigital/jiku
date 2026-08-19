---
id: styling
display_name: Estilado (Sass + CSS Modules + custom properties)
language: nextjs
description: CSS Modules con Sass, tokens en :root, un solo breakpoint en uso real, sin librería de componentes
applies_to: [frontend]
required_by: []
package: sass
---

# Estilado (opus-web)

> **Reemplaza** la convención `styling` del catálogo, que usa Tailwind CSS con `cn()` y `cva`.
> Acá se usa Sass + CSS Modules + custom properties. **No hay helper `cn()`**: las clases
> condicionales se componen con template strings.

## Estructura

```
src/
├── app/globals.scss            @use de variables, reset y typography
├── styles/
│   ├── globals.scss            @use 'variables' + 'reset' + 'typography'
│   ├── _variables.scss         ~60 custom properties en :root + dark mode
│   ├── _reset.scss             reset moderno
│   ├── _typography.scss        estilos de elemento tipográficos
│   └── _mixins.scss            flex, truncate, breakpoints, focus, button-reset
└── **/Componente.module.scss   un módulo por componente, junto al .tsx
```

`next.config.js:6-8` agrega `src/styles` a los `includePaths` de Sass, que es lo que permite
`@use '@/styles/mixins' as *;` desde cualquier módulo.

Hay dos `globals.scss`: `src/app/globals.scss` (el que importa `layout.tsx`) y
`src/styles/globals.scss`. Los dos hacen lo mismo — `@use` de los tres parciales.

## Un módulo por componente

```
shared/components/ui/Button/
├── Button.tsx
├── Button.module.scss
└── index.ts
```

```tsx
import styles from './Button.module.scss';
<button className={styles.button} data-variant={variant}>
```

**Reglas:**

- Nombre del módulo = nombre del componente. Las páginas usan `page.module.scss` y los layouts
  `layout.module.scss`, porque el nombre del archivo ya dice cuál es.
- **Clases en `camelCase`**, no `kebab-case`: CSS Modules las expone como propiedades de un objeto
  y `styles.pillWrapper` es válido mientras `styles.pill-wrapper` no.
- El módulo empieza con `@use '@/styles/mixins' as *;` cuando necesita mixins. Sin eso los
  `@include` no resuelven.

## Variantes: atributos `data-*`, no clases

Es el patrón distintivo del servicio, consistente en todos los componentes de `shared/ui/`:

```tsx
// src/shared/components/ui/Button/Button.tsx:28-36
<button className={`${styles.button} ${className ?? ''}`} data-variant={variant} data-size={size}>
```

```scss
// Button.module.scss
&[data-variant='primary'] { /* ... */ }
&[data-size='sm']         { /* ... */ }
```

Lo usan `Button` (`variant`, `size`), `Badge` (`variant`), `Spinner` (`size`), `StateAccordion`
(`data-state`, `data-expanded`), `RequirementCard` (`data-state`) y los tabs del modal
(`data-active`).

**Ventaja sobre las clases:** no hay que mapear un valor a un nombre de clase en JS, y el atributo
queda visible en el DOM al depurar.

**Regla:** un componente con variantes acotadas usa `data-*`. Un modificador booleano puntual puede
ir como clase.

## Clases condicionales: template strings

**No hay `cn()`.** El patrón es template string con `?:` o `??`:

```tsx
// src/features/requirements/components/ListRequirementRow/ListRequirementRow.tsx:155
<span className={`${styles.pill} ${pillClass}`}>

// src/features/projects/components/Sidebar/Sidebar.tsx:73
className={`${styles.navItem} ${String(project.id) === activeProjectId ? styles.active : ''}`}

// src/shared/components/ui/Button/Button.tsx:30
className={`${styles.button} ${className ?? ''}`}
```

**La regla que hay que respetar:** el falsy siempre se resuelve a `''`, nunca se deja el `&&`
suelto.

```tsx
// ✗ escribe la clase "false" en el DOM
className={`${styles.a} ${cond && styles.b}`}

// ✓ el patrón del código
className={`${styles.a} ${cond ? styles.b : ''}`}
```

En `opus-web` el patrón correcto se cumple en todos los casos revisados. (En `web` el bug existe en
tres archivos; acá no.)

Cuando hay tres o más condicionales encadenados el resultado es largo:

```tsx
// src/features/requirements/components/RequirementDetailModal/components/ModalTopbar/ModalTopbar.tsx:101
className={`${styles.actionBtn} ${isSubscribed ? styles.actionBtnSubscribed : ''} ${isError ? styles.actionBtnError : ''}`}
```

Es el límite práctico de este enfoque.

### Mapas de estado a clase

Para traducir un valor de dominio a una clase, el patrón es un `Record` a nivel de módulo:

```ts
// src/features/requirements/components/ListRequirementRow/ListRequirementRow.tsx:24-42
const PILL_CLASSES: Record<string, string> = {
  analisis: styles.backlog,
  planificacion: styles.planificacion,
  // ...
};
const pillClass = PILL_CLASSES[requirement.state] || styles.backlog;
```

Siempre con fallback. Aparece en `ListRequirementRow`, `KanbanCard`, `KanbanColumn` y
`RequirementInfoPanel` — **cuatro copias del mismo mapa** con nombres de clase distintos.

## Tokens

Custom properties en `:root`, todas en `_variables.scss`.

| Grupo | Valores |
|---|---|
| Primarios | `--color-primary` #2563eb · `--color-primary-hover` #1d4ed8 · `--color-primary-light` #dbeafe |
| Estado | `--color-success` #16a34a · `--color-warning` #ca8a04 · `--color-error` #dc2626 · `--color-info` #0891b2 |
| Neutrales | `--color-background` #ffffff · `--color-surface` #f8fafc · `--color-surface-hover` #eef2f7 · `--color-border` #e2e8f0 |
| Texto | `--color-text-primary` #0f172a · `--color-text-secondary` #64748b · `--color-text-muted` #94a3b8 |
| Espaciado | `--spacing-{xs,sm,md,lg,xl,2xl}` = 0.25 / 0.5 / 1 / 1.5 / 2 / 3 rem |
| Tipografía | `--font-size-{xs,sm,base,lg,xl,2xl,3xl}` = 12 / 14 / 16 / 18 / 20 / 24 / 32 px |
| Pesos | `--font-weight-{normal,medium,semibold,bold}` = 400 / 500 / 600 / 700 |
| Interlineado | `--line-height-{tight,normal,relaxed}` = 1.25 / 1.5 / 1.75 |
| Sombras | `--shadow-{sm,md,lg,xl}` |
| Radios | `--radius-{sm,md,lg,xl,full}` = 4 / 6 / 8 / 12 px / 9999px |
| Transiciones | `--transition-{fast,normal,slow}` = 150 / 200 / 300 ms |
| Z-index | `--z-{dropdown,sticky,modal,tooltip,toast}` = 100 / 200 / 300 / 400 / 500 |

**Reglas:**

- Usar el token, nunca el hex literal.
- Color nuevo: agregarlo a `_variables.scss` en el grupo que corresponda.
- Los z-index salen de la escala. No inventar un `z-index: 9999`.

### Los tokens no alcanzan, y se nota

Hay **hex literales por todos lados** en los módulos de feature. No son excepciones puntuales: son
el patrón real en los componentes del tablero.

| Dónde | Qué |
|---|---|
| `RequirementInfoPanel.module.scss:77-114` | 12 hex: los siete colores de estado y los cinco de prioridad |
| `KanbanCard.module.scss`, `KanbanColumn.module.scss`, `ListRequirementRow.module.scss` | los mismos colores, otra vez |
| `RequirementDetailModal.module.scss:22`, `:60`, `:71` | `#fff`, `#f8fafc`, `#d1d5db` |
| `requirement.constants.ts:2-17` | los mismos colores **en TypeScript**, como `dotColor` y `color` |

**La paleta de estados y prioridades no está en los tokens.** Vive duplicada en cinco módulos SCSS
y un archivo TS. Cambiar el color de "Revisión" implica tocar los seis.

También hay estilos inline con colores calculados: `StateDot` y `PriorityIcon`
(`ListRequirementRow.tsx:82-110`, `KanbanCard.tsx:68-96`) reciben el color como prop desde
`requirement.constants.ts` y lo aplican con `style={{ background: color }}`.

**Regla para código nuevo:** un color de dominio nuevo va a `_variables.scss` como token, no a un
módulo ni a un `Record` de TypeScript.

## Dark mode: declarado, sin activar

```scss
// src/styles/_variables.scss:97-104
[data-theme='dark'] {
  --color-background: #0f172a;
  --color-surface: #1e293b;
  --color-border: #334155;
  --color-text-primary: #f1f5f9;
  --color-text-secondary: #94a3b8;
  --color-text-muted: #64748b;
}
```

**Nada setea `data-theme` en ningún lado.** No hay toggle, ni lectura de `prefers-color-scheme`, ni
persistencia. Son seis variables de las ~60: aunque se activara, los hex literales de los módulos
de feature no cambiarían.

## Mixins

`_mixins.scss` es corto — siete mixins y cuatro variables de breakpoint:

| Mixin | Qué hace |
|---|---|
| `flex-center` | `display:flex` + centrado en los dos ejes |
| `flex-between` | `display:flex` + `align-items:center` + `space-between` |
| `truncate` | `overflow:hidden` + `text-overflow:ellipsis` + `white-space:nowrap` |
| `focus-ring` | `outline: 2px solid var(--color-primary)` en `:focus-visible` |
| `button-reset` | quita apariencia, borde, padding y hereda la fuente |
| `mobile` / `tablet` / `desktop` | los breakpoints |

**Regla:** antes de escribir `display:flex; align-items:center; justify-content:space-between` a
mano, usar `flex-between`.

## Breakpoints

```scss
// src/styles/_mixins.scss:24-45
$breakpoint-sm: 640px;
$breakpoint-md: 768px;
$breakpoint-lg: 1024px;
$breakpoint-xl: 1280px;

@mixin mobile  { @media (max-width: #{$breakpoint-md - 1px}) { @content; } }
@mixin tablet  { @media (min-width: $breakpoint-md) and (max-width: #{$breakpoint-lg - 1px}) { @content; } }
@mixin desktop { @media (min-width: $breakpoint-lg) { @content; } }
```

| Mixin | Media query | Origen |
|---|---|---|
| `mobile` | `max-width: 767px` | `_mixins.scss:30` |
| `tablet` | `min-width: 768px` y `max-width: 1023px` | `_mixins.scss:36` |
| `desktop` | `min-width: 1024px` | `_mixins.scss:42` |

`$breakpoint-sm` (640px) y `$breakpoint-xl` (1280px) se declaran y **no los usa ningún mixin**.

### El uso real

**`mobile` domina, y el corte real de la aplicación es 768px.**

| Mecanismo | Ocurrencias | Dónde |
|---|---|---|
| `@include mobile` | **25** | 11 archivos |
| `@include tablet` | 2 | `ProjectList.module.scss:11` (código muerto), `Modal.module.scss:35` (código muerto) |
| `@include desktop` | 1 | `ProjectList.module.scss:15` (código muerto) |
| `@media` cruda | **0** | — |
| `useIsMobile` (768px en JS) | 2 componentes | `requirements/page.tsx:39`, `RequirementDetailModal.tsx:21` |

Dos cosas importantes:

- **Cero `@media` crudas.** Todo pasa por los mixins. Es más disciplinado que `web`, que tiene 14.
- **Los tres usos de `tablet`/`desktop` están en componentes que no se renderizan.** `ProjectList`
  y `Modal` son código muerto. En la aplicación viva, **el único breakpoint que existe es 768px**.

Los 25 `@include mobile` se reparten así:

| Archivo | Usos |
|---|---|
| `RequirementInfoPanel.module.scss` | 8 |
| `Modal.module.scss` | 5 *(código muerto)* |
| `Header.module.scss` | 3 *(código muerto)* |
| `page.module.scss` de `/projects` | 2 |
| `Sidebar.module.scss`, `CreateRequirementModal`, `ListView`, `ListRequirementRow`, `ProjectCard`, `PageContainer`, `RequirementDetailView` | 1 c/u |

**Regla:** responsive con `@include mobile`, nunca `@media` cruda. Si hace falta un corte nuevo,
agregarlo como mixin en `_mixins.scss`.

**Y la advertencia que importa:** `useIsMobile` duplica el 768 en JavaScript
(`useIsMobile.ts:3`). Si alguna vez se cambia `$breakpoint-md`, hay que cambiar los dos o el
layout y el árbol de componentes van a discrepar entre 768 y el valor nuevo.

## El patrón responsive real

Casi todo el responsive de la aplicación es una de estas tres cosas:

**1. Ocultar.** `Sidebar.module.scss:13-15` — `display: none` bajo 768px. Sin reemplazo; ver
[overview](../overview.md).

**2. Apilar.** El layout de dos paneles pasa a columna:

```scss
// src/features/requirements/components/RequirementDetailView/RequirementDetailView.module.scss:91-99
@include mobile {
  .body { flex-direction: column; }
  .rightPanel { width: 100%; flex-shrink: 1; }
}
```

**3. Esconder columnas de la grilla.** La tabla de requisitos pasa de siete a tres columnas:

```scss
// src/features/requirements/components/ListRequirementRow/ListRequirementRow.module.scss:221-231
@include mobile {
  .row { grid-template-columns: 64px 1fr 140px; }
  .td:nth-child(4), .td:nth-child(5), .td:nth-child(6), .td:nth-child(7) { display: none; }
}
```

La misma regla está duplicada en `ListView.module.scss:56-67` para la cabecera. Las dos definiciones
de `grid-template-columns` (`64px 1fr 140px 140px 160px 120px 150px`) tienen que coincidir o la
cabecera se desalinea de las filas.

## Estilos globales

`_reset.scss` — box-sizing, márgenes en cero, `img` como `block` con `max-width:100%`, listas sin
viñeta, links sin subrayado.

`_typography.scss` — estilos de elemento para `body`, `h1`-`h6`, `p`, `small`, `code`/`pre`. Los
encabezados salen de acá, no de un componente.

**Regla:** no agregar más estilos de elemento. Lo que hay ya obliga a pelearlo desde los módulos.

**No hay overrides de librerías de terceros** — el servicio no usa ninguna que renderice DOM
propio.

## Fuentes

```tsx
// src/app/layout.tsx:6-10, :24
const geistMono = localFont({ src: './fonts/GeistMonoVF.woff', variable: '--font-geist-mono', weight: '100 900' });
<body className={geistMono.variable}>
```

> **La fuente cargada no se usa.** `layout.tsx` carga Geist Mono y expone `--font-geist-mono`, pero
> `_typography.scss:4` pone `font-family: var(--font-family-sans)` en el `body`, que es la pila del
> sistema (`_variables.scss:40`). `--font-geist-mono` no aparece en ningún `.scss`.
>
> Se descarga un woff variable que no se aplica. Y `--font-family-mono` (`_variables.scss:41`)
> declara `'JetBrains Mono', 'Fira Code', monospace`, otra pila distinta, para `code`/`pre`.

## Qué NO hacer

- No hex literales en código nuevo: usar tokens. (Que el tablero los tenga no lo hace el patrón.)
- No `@media` cruda: usar los mixins. Hoy hay cero; mantenerlo así.
- No clases en `kebab-case`.
- No `&&` en un template string de clase: usar `?:` con `''`.
- No `z-index` fuera de la escala de `--z-*`.
- No un cuarto mapa `Record<string, string>` de estado a clase: ya hay cuatro.
- No introducir Tailwind ni una librería de componentes sin decidir qué pasa con los módulos
  existentes.
