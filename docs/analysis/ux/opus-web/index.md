---
document: UX Survey
service: opus-web
repo_path: opus-web/
date: 2026-08-18
status: relevamiento
---

# UX Survey: opus-web

> **Relevamiento del estado actual** del frontend `opus-web`, extraído del código.
> No es documentación UX: es el insumo que `/product-consolidate-services` transcribe
> para armar `docs/ux/`. Cada dato cita su origen. Lo que el código no dice —audiencias,
> JTBD, el porqué de cada decisión— no está acá y se releva en la entrevista.

## Stack de UI

| Aspecto | Valor | Origen |
|---|---|---|
| Framework | Next.js 16.1.1 (App Router) + React 19 | `opus-web/package.json` |
| Styling | Sass 1.97 + CSS Modules (33 módulos) + custom properties en `:root` | `src/styles/`, `next.config.js:6-8` |
| Librería de componentes | ninguna. 12 componentes propios en `src/shared/components/ui/` | `src/shared/components/ui/` |
| Componentes de terceros con UI | `react-markdown` (solo render de markdown) | `package.json` |
| i18n | **ninguna.** Todos los textos hardcodeados en JSX o en constantes de módulo, en español | sin dependencia de i18n en `package.json` |
| Tipografía | **Geist Mono se carga y no se aplica.** La fuente efectiva es la pila del sistema | `src/app/layout.tsx:6-10` vs `_typography.scss:4` |
| Iconografía | `lucide-react` (16 usos) + SVG inline en JSX (~20). Un solo PNG: `src/assets/logo.png` | `package.json`, `src/assets/` |

> **La fuente cargada no es la que se ve.** `layout.tsx:6-10` carga Geist Mono como
> `--font-geist-mono` y lo aplica al `<body>` como clase, pero `_typography.scss:4` fija
> `font-family: var(--font-family-sans)`, que es
> `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` (`_variables.scss:40`).
> `--font-geist-mono` no aparece en ningún `.scss`. Se descarga un woff variable que no se usa.

## Breakpoints

**Origen:** `src/styles/_mixins.scss:24-45` — variables Sass más tres mixins.

| Variable | Valor | Origen | ¿La usa un mixin? |
|---|---|---|---|
| `$breakpoint-sm` | 640px | `_mixins.scss:24` | **no** |
| `$breakpoint-md` | 768px | `_mixins.scss:25` | sí — `mobile` y `tablet` |
| `$breakpoint-lg` | 1024px | `_mixins.scss:26` | sí — `tablet` y `desktop` |
| `$breakpoint-xl` | 1280px | `_mixins.scss:27` | **no** |

| Mixin | Media query resultante | Origen |
|---|---|---|
| `mobile` | `max-width: 767px` | `_mixins.scss:29-33` |
| `tablet` | `min-width: 768px` y `max-width: 1023px` | `_mixins.scss:35-39` |
| `desktop` | `min-width: 1024px` | `_mixins.scss:41-45` |

**Y un cuarto breakpoint en JavaScript**, duplicando el valor de `$breakpoint-md`:

```ts
// src/shared/hooks/useIsMobile.ts:3
const MOBILE_BREAKPOINT = 768;
```

## Viewports en uso

| Mecanismo | Ocurrencias | Dónde |
|---|---|---|
| `@include mobile` | **25** en 11 archivos | ver desglose abajo |
| `@include tablet` | 2 | `ProjectList.module.scss:11` · `Modal.module.scss:35` — **los dos en código muerto** |
| `@include desktop` | 1 | `ProjectList.module.scss:15` — **código muerto** |
| `@media` cruda | **0** | — |
| `useIsMobile()` (768px en JS) | 2 componentes | `requirements/page.tsx:39` · `RequirementDetailModal.tsx:21` |

Desglose de los 25 `@include mobile`:

| Archivo | Usos | ¿Vivo? |
|---|---|---|
| `RequirementInfoPanel.module.scss` | 8 | sí |
| `Modal.module.scss` | 5 | **no** — el componente `Modal` no lo usa nadie |
| `Header.module.scss` | 3 | **no** — código muerto |
| `app/(dashboard)/projects/page.module.scss` | 2 | sí |
| `Sidebar.module.scss` | 1 | sí |
| `CreateRequirementModal.module.scss` | 1 | sí |
| `ListView.module.scss` | 1 | sí |
| `ListRequirementRow.module.scss` | 1 | sí |
| `RequirementDetailView.module.scss` | 1 | sí |
| `ProjectCard.module.scss` | 1 | **no** — código muerto |
| `PageContainer.module.scss` | 1 | **no** — código muerto |

**Conclusión: viewports `mobile` y `desktop`. El corte real está en `md` (768px).**

La evidencia es convergente y no deja lugar a duda:

1. **`@include mobile` (`max-width: 767px`) es el 89% del responsive** — 25 de 28 usos.
2. **Los tres usos de `tablet`/`desktop` están en componentes que no se renderizan.** En la
   aplicación viva, `$breakpoint-lg` (1024px) no separa nada.
3. **`useIsMobile` usa exactamente 768** y decide **qué árbol de componentes montar**, no solo
   cómo se ve: en `requirements/page.tsx:171-185` elige entre `MobileRequirementsBoard` y
   `ListView`/`KanbanBoard`; en `RequirementDetailModal.tsx:63` elige entre tabs y dos paneles.
   Es el corte más fuerte de toda la superficie.
4. **El shell cambia ahí:** el `Sidebar` desaparece con `display: none`
   (`Sidebar.module.scss:13-15`).

`$breakpoint-sm` (640) y `$breakpoint-xl` (1280) están declarados y no los usa nada.

> **El valor 768 vive en dos lugares** (`_mixins.scss:25` y `useIsMobile.ts:3`). Si alguna vez se
> cambia uno, el layout CSS y el árbol de componentes discrepan entre 768 y el valor nuevo.

## Tokens de diseño

**Origen:** `src/styles/_variables.scss` — custom properties en `:root`.

### Paleta

| Nombre en código | Valor | Uso observado |
|---|---|---|
| `--color-primary` | `#2563eb` | Botones primarios, logo del sidebar, focus ring, tab activo |
| `--color-primary-hover` | `#1d4ed8` | Hover de botón primario |
| `--color-primary-light` | `#dbeafe` | — |
| `--color-success` | `#16a34a` | Toast de éxito |
| `--color-warning` | `#ca8a04` | — |
| `--color-error` | `#dc2626` | Textos de error, botón `danger` |
| `--color-info` | `#0891b2` | — |
| `--color-background` | `#ffffff` | Fondo de página |
| `--color-surface` | `#f8fafc` | Fondo de paneles secundarios |
| `--color-surface-hover` | `#eef2f7` | Hover de fila en la tabla |
| `--color-border` | `#e2e8f0` | Todos los bordes y separadores |
| `--color-text-primary` | `#0f172a` | Texto principal |
| `--color-text-secondary` | `#64748b` | Texto secundario, metadatos |
| `--color-text-muted` | `#94a3b8` | Placeholders, valores vacíos |

**Dark mode declarado y nunca activado.** `_variables.scss:97-104` redefine seis variables bajo
`[data-theme='dark']`, y **nada setea ese atributo** — no hay toggle, ni lectura de
`prefers-color-scheme`, ni persistencia.

#### La paleta de dominio NO está en los tokens

Es el hallazgo más importante de esta sección. Los colores de estado y prioridad —los que el
usuario más ve— viven **duplicados en seis lugares**, ninguno de ellos `_variables.scss`.

**Estados** (`requirement.constants.ts:1-9`, campo `dotColor`):

| Estado | Etiqueta | Color |
|---|---|---|
| `analisis` | Análisis | `#94a3b8` |
| `planificacion` | Planificación | `#8b5cf6` |
| `en_cola` | En cola | `#0ea5e9` |
| `desarrollo` | Desarrollo | `#22c55e` |
| `revision` | Revisión | `#f59e0b` |
| `resuelto` | Resuelto | `#2563eb` |
| `cancelado` | Cancelado | `#ef4444` |

**Prioridades** (`requirement.constants.ts:11-17`, campo `color`):

| Prioridad | Etiqueta | Color |
|---|---|---|
| `sin_prioridad` | Sin prioridad | `#64748b` |
| `baja` | Baja | `#1d4ed8` |
| `media` | Media | `#b45309` |
| `alta` | Alta | `#c2410c` |
| `urgente` | Urgente | `#e11d48` |

Los mismos colores, **con valores que no siempre coinciden**, están hardcodeados en:
`RequirementInfoPanel.module.scss:77-114`, `KanbanCard.module.scss`, `KanbanColumn.module.scss`,
`ListRequirementRow.module.scss` y `RequirementGroupRow.module.scss`.

Ejemplo de divergencia real: prioridad `baja` es `#1d4ed8` en el TS y
`--color-priority-low: #3b82f6` en `RequirementInfoPanel.module.scss:104`. **Son azules
distintos para el mismo concepto en dos pantallas.**

### Tipografía

| Token | Valor | Uso |
|---|---|---|
| `--font-family-sans` | `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` | Todo el `body` |
| `--font-family-mono` | `'JetBrains Mono', 'Fira Code', monospace` | `code`, `pre` |
| `--font-size-xs` | 0.75rem (12px) | — |
| `--font-size-sm` | 0.875rem (14px) | Texto secundario, `h6` |
| `--font-size-base` | 1rem (16px) | Body, `h5` |
| `--font-size-lg` | 1.125rem (18px) | `h4` |
| `--font-size-xl` | 1.25rem (20px) | `h3` |
| `--font-size-2xl` | 1.5rem (24px) | `h2` |
| `--font-size-3xl` | 2rem (32px) | `h1` |
| `--font-weight-{normal,medium,semibold,bold}` | 400 / 500 / 600 / 700 | `semibold` en todos los encabezados |
| `--line-height-{tight,normal,relaxed}` | 1.25 / 1.5 / 1.75 | `tight` en encabezados, `normal` en body |

> **La escala de tokens no se respeta en los módulos de feature.** Los componentes del tablero
> usan px literales fuera de la escala: `11px` (etiquetas de sidebar y encabezados de columna,
> `RequirementInfoPanel.module.scss:52`), `13px` (`:117`), `14px` (`:61`), `26px` y `28px` (los
> títulos del modal y de la página de detalle). El título de detalle es 28px en la página y 26px
> en el modal, para el mismo contenido (`RequirementDetailView.module.scss:27-29`).

### Espaciado

| Token | Valor |
|---|---|
| `--spacing-xs` | 0.25rem (4px) |
| `--spacing-sm` | 0.5rem (8px) |
| `--spacing-md` | 1rem (16px) |
| `--spacing-lg` | 1.5rem (24px) |
| `--spacing-xl` | 2rem (32px) |
| `--spacing-2xl` | 3rem (48px) |

Igual que la tipografía: los módulos del tablero usan px literales (`padding: 14px 20px`,
`gap: 6px`, `padding: 12px 10px`) fuera de la escala.

### Otros

| Grupo | Valores |
|---|---|
| Radios | `--radius-sm` 4px · `md` 6px · `lg` 8px · `xl` 12px · `full` 9999px |
| Sombras | `--shadow-sm/md/lg/xl` |
| Transiciones | `--transition-fast` 150ms · `normal` 200ms · `slow` 300ms |
| Z-index | `--z-dropdown` 100 · `sticky` 200 · `modal` 300 · `tooltip` 400 · `toast` 500 |

Las medidas de layout fijas más relevantes: sidebar **263px** (`Sidebar.module.scss:4`), panel de
propiedades **220px** (`RequirementInfoPanel.module.scss:28`), panel de actividad **558px** en el
modal / **559px** en la página, modal de detalle **1632px** de ancho máximo
(`RequirementDetailModal.module.scss:19`).

## Rutas y pantallas

**Origen:** `src/app/` (App Router)

| # | Ruta | Pantalla | Auth | Archivo | Survey |
|---|---|---|---|---|---|
| 1 | `/login` | login | no | `app/(auth)/login/page.tsx` | [screens/login.md](./screens/login.md) |
| 2 | `/login/enter` | login-entrada | sí | `app/(auth)/login/enter/page.tsx` | [screens/login-entrada.md](./screens/login-entrada.md) |
| 3 | `/` | *(redirección sin UI)* | sí | `app/page.tsx` | — |
| 4 | `/projects` | proyectos-redireccion | sí | `app/(dashboard)/projects/page.tsx` | [screens/proyectos-redireccion.md](./screens/proyectos-redireccion.md) |
| 5 | `/projects/[projectId]/requirements` | tablero-requisitos | sí | `.../requirements/page.tsx` | [screens/tablero-requisitos.md](./screens/tablero-requisitos.md) |
| 6 | `/projects/[projectId]/requirements/[requirementId]` | detalle-requisito | sí | `.../[requirementId]/page.tsx` | [screens/detalle-requisito.md](./screens/detalle-requisito.md) |

`/` no tiene survey propio: es un server component sin JSX que llama a `auth()` y redirige a
`/projects` o `/login` (`app/page.tsx:4-11`).

**Auth:** todas salvo `/login` están protegidas por `middleware.ts:45-47`, cuyo matcher excluye
`api`, `attachments`, `_next/static`, `_next/image` y `favicon.ico`. La protección es por
exclusión: una ruta nueva queda protegida sola.

### Chrome compartido

El shell del grupo `(dashboard)` está en [screens/_shell.md](./screens/_shell.md).

| Bloque | Componente | Viewports | Origen |
|---|---|---|---|
| Sidebar de navegación | `<Sidebar>` | **solo desktop** | `(dashboard)/layout.tsx:13`, oculto en `Sidebar.module.scss:13` |
| Contenedor principal | `<main>` | ambos | `(dashboard)/layout.tsx:14` |
| Toasts | `<ToastContainer>` | ambos | `providers.tsx:50` (portal a `document.body`) |

El grupo `(auth)` no tiene chrome: su layout es un `<div>` con `display: contents`
(`(auth)/layout.module.scss:3-5`), o sea que no genera caja.

> **En mobile no hay ningún chrome de navegación.** El `Sidebar` es `display:none` bajo 768px y el
> layout no monta reemplazo. Ver Gaps.

### Overlays detectados

| Overlay | Tipo | Disparado desde | Archivo | Survey |
|---|---|---|---|---|
| Detalle de requisito | modal (desktop) / fullscreen con tabs (mobile) | tablero-requisitos | `RequirementDetailModal.tsx` | [screens/_overlays.md](./screens/_overlays.md) |
| Nuevo requisito | modal | Sidebar y tablero-requisitos | `CreateRequirementModal.tsx` | [screens/_overlays.md](./screens/_overlays.md) |
| Dropdown de estado | dropdown en portal | fila de lista, card de kanban | `Dropdown.tsx` | [screens/_overlays.md](./screens/_overlays.md) |
| Dropdown de prioridad | dropdown en portal | fila de lista, card de kanban | `Dropdown.tsx` | [screens/_overlays.md](./screens/_overlays.md) |
| Dropdowns del formulario (proyecto, prioridad, tipo) | panel posicionado a mano | Nuevo requisito | `CreateRequirementModal.tsx:581-645` | [screens/_overlays.md](./screens/_overlays.md) |
| Selector de suscriptores | panel posicionado a mano | Nuevo requisito | `UserSelector.tsx:65-83` | [screens/_overlays.md](./screens/_overlays.md) |
| Toast | notificación efímera (4 s) | `useUpdateRequirement` | `Toast.tsx` | [screens/_overlays.md](./screens/_overlays.md) |

**Overlays que existen en el código y no se pueden abrir** (componentes muertos): `Modal`
(genérico) y `MobileMenu` (drawer de navegación).

## Inventario de componentes

### Compartidos — `src/shared/components/ui/` (12)

| Componente | Usos | Variants observadas | ¿Candidato a DS? |
|---|---|---|---|
| `Spinner` | 7 | `size`: sm, md, lg | **sí** |
| `Dropdown` | 4 | `align`: left, right; `renderTrigger`/`renderItem` | **sí** |
| `Button` | 3 vivos (+3 en muertos) | `variant`: primary, secondary, danger · `size`: sm, md, lg · `loading` | **sí** |
| `RichContentRenderer` | 3 | — | sí |
| `AttachmentPreview` | 3 | con y sin `onRemove` | sí |
| `AttachmentDownload` | 3 | con y sin `onRemove` | sí |
| `AttachmentSkeleton` | 3 | `isImage` | sí |
| `RichTextEditor` | 2 | `disabled`, `uploading` | sí |
| `MarkdownRenderer` | 2 | — | sí |
| `Toast` / `ToastContainer` | 1 (montado global) | `type`: error, success | **sí** |
| `Card` | **0** | — | no — código muerto |
| `Badge` | **0** | `variant`: default, success, warning, error, info | no — código muerto |
| `Modal` | **0** | con y sin `footer` | no — código muerto |

`Button`, `Spinner`, `Badge` y `Modal` usan atributos `data-*` para las variantes, no clases.

### Layout — `src/shared/components/layout/` (3)

| Componente | Usos | Nota |
|---|---|---|
| `Header` | **0** | Shell de navegación superior completo. Segunda implementación en paralelo a `Sidebar` |
| `MobileMenu` | 1, desde `Header` | Drawer de navegación mobile. Inalcanzable |
| `PageContainer` | **0** | `maxWidth`: sm, md, lg, xl, full |

### De dominio — `src/features/*/components/` (19)

| Componente | Módulo | Usos | Nota |
|---|---|---|---|
| `Sidebar` | projects | 1 | El shell real. Vive en `projects/`, no en `layout/` |
| `ProjectCard` | projects | 1 (desde `ProjectList`) | Cadena muerta |
| `ProjectList` | projects | **0** | Código muerto |
| `BoardHeader` | requirements | 2 | Breadcrumb + toggle de vista / acciones de detalle |
| `ListView` | requirements | 1 | Tabla agrupada por estado |
| `ListRequirementRow` | requirements | 1 | Fila de 7 columnas |
| `RequirementGroupRow` | requirements | 1 | Cabecera de grupo colapsable |
| `KanbanBoard` | requirements | 1 | — |
| `KanbanColumn` | requirements | 1 | Colapsable |
| `KanbanCard` | requirements | 1 | — |
| `MobileRequirementsBoard` | requirements | 1 | Solo mobile |
| `StateAccordion` | requirements | 1 | Solo mobile |
| `RequirementCard` | requirements | 1 | Solo mobile, dentro del acordeón |
| `RequirementDetailModal` | requirements | 1 | — |
| `ModalTopbar` | requirements | 1 | — |
| `RequirementInfoPanel` | requirements | 2 | Compartido entre modal y página |
| `ActivityPanel` | requirements | 2 | Compartido |
| `CommentInput` | requirements | 2 | Compartido |
| `RequirementDetailView` | requirements | 1 | Versión página del detalle |
| `RequirementFilters` | requirements | **0** | Código muerto |
| `SubscribersList` | subscriptions | 1 | — |
| `UserSelector` | subscriptions | 1 | — |
| `SubscribeButton` | subscriptions | **0** | Código muerto |

### Patrones repetidos sin componente

| Patrón | Repeticiones | Archivos |
|---|---|---|
| **Pill de estado con punto de color** | 4 | `ListRequirementRow.tsx:155`, `KanbanCard.tsx:147`, `RequirementInfoPanel.tsx:90-93`, `RequirementGroupRow.tsx:36` |
| **Badge de prioridad con ícono de bandera** | 3 | `ListRequirementRow.tsx:97-110`, `KanbanCard.tsx:83-96`, `RequirementInfoPanel.tsx:104-114` — el mismo `<path>` SVG copiado |
| **Botón de acción de topbar** (ícono + texto) | 2 componentes, 7 instancias | `ModalTopbar.tsx:76-131`, `BoardHeader.tsx:97-143` |
| **Botón "Ver más" con spinner** | 2 | `KanbanColumn.tsx:80-96`, `StateAccordion.tsx:84-100` — idénticos |
| **Bloque loading/error/reintentar** | 4 | `Sidebar.tsx:60-68`, `Header.tsx:46-64`, `MobileMenu.tsx:67-88`, `projects/page.tsx:27-49` |
| **Chevron SVG inline** | 6+ | `Dropdown.tsx:123-139`, `ListRequirementRow.tsx:158-176`, `KanbanCard.tsx:150-169`, `CreateRequirementModal.tsx:399-413` (×3) |
| **X de cerrar SVG inline** | 4 | `Modal.tsx:71-83`, `MobileMenu.tsx:122-134`, `CreateRequirementModal.tsx:302-309`, `:535-542` |
| **Avatar de iniciales** | 2 | `Sidebar.tsx:103` (usuario), `ActivityPanel.tsx:82-84` (autor del comentario) — con dos implementaciones distintas de `getInitials` |
| **Validación de adjunto** (10MB + 12 extensiones) | 2 | `CommentInput.tsx:11-25,74-83`, `CreateRequirementModal.tsx:22-36,123-131` — literal |
| **Dropdown posicionado a mano** | 2 | `CreateRequirementModal.tsx:244-260`, `UserSelector.tsx:30-36` — reimplementan `Dropdown` |

El pill de estado y el badge de prioridad son los dos candidatos más claros a componente de design
system: aparecen en las tres vistas del tablero y en el detalle, con el mismo diseño y cuatro
implementaciones.

## Gaps detectados

| # | Pantalla | Gap | Categoría | Evidencia |
|---|---|---|---|---|
| 1 | _shell (mobile) | **Sin navegación alguna en mobile**: no se puede cambiar de proyecto ni cerrar sesión | responsive / navegación | `Sidebar.module.scss:13-15` (`display:none`) + `(dashboard)/layout.tsx:12-19` sin reemplazo |
| 2 | tablero-requisitos | Sin estado de error: si fallan las 7 queries, se muestra el tablero vacío | estado ausente | `requirements/page.tsx:153-162` — solo maneja `isLoading` |
| 3 | tablero-requisitos | Sin estado empty: un proyecto sin requisitos muestra 7 secciones en cero | estado ausente | `requirements/page.tsx:164-196` |
| 4 | tablero-requisitos | Si `useProjects` falla, el nombre del proyecto cae a "Proyecto" sin avisar | estado ausente | `requirements/page.tsx:132-135` |
| 5 | overlay: nuevo requisito | **Sin estado de error de creación**: el botón vuelve de "Creando..." a "Crear elemento" sin mensaje | estado ausente | `CreateRequirementModal.tsx:571-573` + `useCreateRequirement` sin `onError` |
| 6 | overlay: detalle | Sin reintentar en error, a diferencia de la página equivalente | estado ausente | `RequirementDetailModal.tsx:48-60` |
| 7 | overlay: suscripción | El error se muestra como la palabra "Error" dentro del botón y el motivo en un `title` (invisible en touch) | estado ausente | `ModalTopbar.tsx:105-118`, `BoardHeader.tsx:114-131` |
| 8 | overlay: selector de suscriptores | "Sin usuarios disponibles" tanto si la lista está vacía como si la query falló | estado ausente | `UserSelector.tsx:68-70` — no lee `isError` |
| 9 | todas | Sin `error.tsx`, `not-found.tsx` ni `loading.tsx` en ninguna ruta | estado ausente | `find src/app -name "error.tsx"` → vacío |
| 10 | tablero-requisitos (mobile) | Los 7 acordeones se pintan del mismo color: el mapa de estados usa etiquetas de un enum que ya no existe | bug visual | `StateAccordion.tsx:15-23` — mapea `Backlog`, `Activo`, `En revisión`, `Finalizado`; siempre cae a `'backlog'` |
| 11 | _shell | Los proyectos del sidebar son `<div onClick>` sin `role`, `tabIndex` ni teclado | accesibilidad | `Sidebar.tsx:71-75` |
| 12 | tablero-requisitos | Las filas de la tabla son `<div onClick>` sin rol ni teclado | accesibilidad | `ListRequirementRow.tsx:143` |
| 13 | overlay: nuevo requisito | Las opciones de los 3 dropdowns son `<div onClick>` sin rol ni teclado | accesibilidad | `CreateRequirementModal.tsx:584`, `:602`, `:631` |
| 14 | todos los overlays | Ningún modal atrapa el foco ni lo devuelve al cerrar | accesibilidad | `Modal.tsx:34-44`, `RequirementDetailModal.tsx`, `CreateRequirementModal.tsx:200-208` |
| 15 | tablero-requisitos | La tabla se construye con `<div>` + `display:grid`, sin roles ARIA de tabla | accesibilidad | `ListView.tsx:76-85`, `ListRequirementRow.tsx:143` |
| 16 | overlay: nuevo requisito | El error de título obligatorio es solo un borde rojo: sin mensaje ni `aria-invalid` | accesibilidad / validación | `CreateRequirementModal.tsx:217-221`, `:326` |
| 17 | todas | Estilos inline con color en vez de token en los indicadores de estado y prioridad | token | `ListRequirementRow.tsx:82-110`, `KanbanCard.tsx:68-96` |
| 18 | todas | La paleta de estados/prioridades vive duplicada en 6 archivos, con valores divergentes | token | `requirement.constants.ts` + 5 módulos SCSS |
| 19 | todas | `<html lang="en">` en una interfaz enteramente en español | accesibilidad / i18n | `app/layout.tsx:23` |
| 20 | todas | Tuteo inconsistente: "No tienes proyectos asignados" (tú) vs "Intentá de nuevo más tarde" (vos) | microcopy | `projects/page.tsx:55` vs `RequirementDetailModal.tsx:53` |
| 21 | detalle-requisito | Título a 28px en la página y 26px en el modal, para el mismo contenido | consistencia visual | `RequirementDetailView.module.scss:27-29` |
| 22 | detalle-requisito | Panel de actividad de 559px en la página y 558px en el modal | consistencia visual | `RequirementDetailView.module.scss:42` vs `RequirementDetailModal.module.scss:56` |
| 23 | tablero-requisitos | En desktop no hay ningún botón de "nuevo requisito" en la pantalla: el único acceso es el sidebar | navegación | `BoardHeader.tsx:24` recibe `onNewRequirement` y lo ignora |
| 24 | todas | Un requisito abierto en el modal no tiene URL: un refresh vuelve al tablero | estado / navegación | `requirements/page.tsx:40` — `useState`, no `searchParams` |
| 25 | proyectos-redireccion | La pantalla existe solo para redirigir; sus 3 estados son caminos de excepción | navegación | `projects/page.tsx:20-25` |

**Resumen: 25 gaps en 6 pantallas.**

Los dos más frecuentes, y los que más pesan:

- **Estados no-happy-path ausentes (gaps 2-9).** Ocho de los veinticinco. Ninguna pantalla del
  tablero maneja error, y tres de las cinco mutaciones no le dicen nada al usuario cuando fallan.
  El patrón bueno existe y está bien hecho en `/projects` y en la página de detalle — no está
  aplicado en el resto.
- **Accesibilidad de elementos interactivos (gaps 11-16).** Seis casos. Lo llamativo es que el
  código **sí sabe** cómo hacerlo: `ProjectCard.tsx:22-28` y `RequirementCard.tsx:46-53` tienen
  `role="button"`, `tabIndex={0}` y `onKeyDown` con Enter y Space. El patrón correcto está escrito
  y no se aplicó en las superficies principales.

Y el gap 1 es de otra categoría: **no es un detalle, es una superficie sin terminar.** En un
teléfono el usuario queda encerrado en el proyecto al que entró.

## No determinable desde el código

- **Audiencias y JTBD** — el código no dice para quién es cada pantalla. Los roles (`admin`,
  `user`, `external-user`) son de autorización, no de audiencia de producto. Se releva en la
  entrevista de consolidación.
- **Por qué** el portal no corta navegación por rol, mientras `web` sí redirige a
  `/unauthorized`.
- **Por qué** hay dos shells (`Sidebar` y `Header`) y cuál era el previsto.
- **Si el portal debe usarse en mobile.** El código tiene tratamiento mobile en las pantallas
  (25 `@include mobile`, un tablero mobile propio, un modal con tabs) pero no tiene navegación
  mobile. No se puede saber si es un olvido o una superficie que se abandonó a mitad.
- **Qué notificación recibe un suscriptor.** El portal permite suscribirse y no muestra ninguna
  notificación: el canal está fuera de este servicio.
- **Si "requisito" o "tarea" es el término correcto.** La UI viva dice "requisito"; el código
  muerto (`MobileMenu.tsx:150`, `Sidebar` prop `onNewObjective`) dice "tarea" y "objetivo".
- **El contenido real de los requisitos** — títulos, descripciones y comentarios vienen de la API.
  El survey registra los campos, no muestras.
- **Si los adjuntos tienen preview en todos los tipos declarados.** El código acepta 12
  extensiones pero solo renderiza preview para `image/*`; para el resto muestra descarga. Si eso
  es lo esperado para un PDF, no se puede saber desde acá.
