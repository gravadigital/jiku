---
foundation: grid
version: 1.0.0
last_updated: 2026-08-18
status: relevado-desde-código
platform: web
origin: relevamiento de código — docs/analysis/ux/opus-web/index.md
---

# Grid (opus-web)

> **Sembrado desde el código existente**, no es un placeholder. Los valores son los que el
> producto tiene hoy.
>
> Los **nombres de viewport** se declaran por superficie en
> [`docs/ux/product-overview.md`](../../../ux/product-overview.md) → "Inventario de Superficies".

## Propósito

Sistema de grilla y breakpoints para layout responsive.

**Este archivo es la fuente única de los valores de breakpoint.** Lo consumen
`/service-planify-story`, `/service-implement-story` y `/product-ux-wireframes`.

Si un valor de acá cambia, cambia el comportamiento del código ya implementado: tratalo como un
cambio breaking y versionalo como tal (ver `governance.md`).

## Viewports de UX ↔ breakpoints

**El corte real de esta superficie está en 768px (`md`).** La evidencia es convergente:

| Viewport UX | Ancho del frame | Breakpoint desde el que aplica | Columnas |
|---|---|---|---|
| `mobile` | 390px | 0 | 4 |
| `desktop` | 1440px | **768px** (`$breakpoint-md`) | 12 |

**Los anchos intermedios se comportan como `desktop`.** No hay layout de tablet: `$breakpoint-lg`
(1024px) no separa nada en la aplicación viva — sus tres usos están en componentes que no se
renderizan.

## Por qué 768 y no otro valor

1. **`@include mobile` (`max-width: 767px`) es el 89% del responsive** — 25 de 28 usos, en 11
   archivos.
2. **Los 3 usos de `tablet`/`desktop` están en código muerto** (`ProjectList`, `Modal`). En la
   aplicación viva `$breakpoint-lg` no separa nada.
3. **`useIsMobile()` usa exactamente 768** y decide **qué árbol de componentes montar**, no solo
   cómo se ve. Es el corte más fuerte de toda la superficie.
4. **El shell cambia ahí:** el `Sidebar` desaparece con `display: none`
   (`Sidebar.module.scss:13-15`).

## El corte de 768 es de árbol de componentes, no de CSS

Esto es lo más importante de este documento para quien implemente.

```ts
// opus-web/src/shared/hooks/useIsMobile.ts:3
const MOBILE_BREAKPOINT = 768;
```

En dos lugares el ancho **elige qué componente montar**:

| Componente | Bajo 768 | Sobre 768 | Origen |
|---|---|---|---|
| Tablero de requisitos | `MobileRequirementsBoard` (acordeones por estado) | `ListView` (tabla) o `KanbanBoard` | `requirements/page.tsx:171-185` |
| Detalle de requisito | Fullscreen con **tabs excluyentes** | Modal con **dos paneles** | `RequirementDetailModal.tsx:63` |

**Una media query no puede hacer esto**: en mobile los paneles son tabs excluyentes, no dos
columnas que se apilan. Por eso la decisión está en JS y no en CSS.

> **Consecuencia conocida:** `useIsMobile` arranca en `false`, así que en un teléfono hay un frame
> con el layout de desktop antes de corregir.

## Breakpoints declarados en el código

**Origen:** `opus-web/src/styles/_mixins.scss:24-45`

| Variable | Valor | ¿La usa un mixin? |
|---|---|---|
| `$breakpoint-sm` | 640px | **no** — declarada sin uso |
| `$breakpoint-md` | **768px** | sí — `mobile` y `tablet` |
| `$breakpoint-lg` | 1024px | sí — `tablet` y `desktop`, ambos en código muerto |
| `$breakpoint-xl` | 1280px | **no** — declarada sin uso |

| Mixin | Media query | Usos vivos |
|---|---|---|
| `mobile` | `max-width: 767px` | **25** en 11 archivos (18 vivos) |
| `tablet` | `min-width: 768px` y `max-width: 1023px` | **0 vivos** (2 en código muerto) |
| `desktop` | `min-width: 1024px` | **0 vivos** (1 en código muerto) |

**No hay ninguna `@media` cruda**: todo el responsive pasa por los mixins. Es notablemente más
prolijo que en `web`.

## El valor 768 vive en dos lugares

```
opus-web/src/styles/_mixins.scss:25    →  $breakpoint-md: 768px
opus-web/src/shared/hooks/useIsMobile.ts:3  →  const MOBILE_BREAKPOINT = 768
```

**Si alguna vez se cambia uno solo, el layout CSS y el árbol de componentes discrepan** en el
rango entre 768 y el valor nuevo: la pantalla montaría el componente de desktop con los estilos de
mobile, o al revés.

## Medidas de layout fijas

| Medida | Valor | Origen |
|---|---|---|
| Ancho de sidebar | **263px** | `Sidebar.module.scss:4` |
| Panel de propiedades | **220px** | `RequirementInfoPanel.module.scss:28` |
| Panel de actividad | **558px** (modal) / **559px** (página) | `RequirementDetailModal` / `RequirementDetailView` |
| Ancho máximo del modal de detalle | **1632px** | `RequirementDetailModal.module.scss:19` |

> El panel de actividad mide **1 px distinto** entre el modal y la página, para el mismo contenido.

## Reglas de implementación

- El corte de viewport **DEBE** ser 768px. **NO SE DEBEN** usar `$breakpoint-sm` (640) ni
  `$breakpoint-xl` (1280): están declarados y sin uso.
- Todo responsive **DEBE** pasar por los mixins de `_mixins.scss`. **NO SE DEBEN** escribir
  `@media` crudas — hoy no hay ninguna y conviene que siga así.
- Si un cambio toca el valor 768, **DEBE** cambiarse en **los dos lugares** a la vez.
- Un cambio de **árbol de componentes** por ancho **DEBE** usar `useIsMobile()`, no una media
  query. Un cambio de **layout** debe usar los mixins, no JS.

## Gaps registrados

Ver [`docs/ux/gaps-as-is.md`](../../../ux/gaps-as-is.md):

- **Bloqueante:** bajo 768px no hay navegación — el `Sidebar` desaparece y el layout no monta
  reemplazo. No se puede cambiar de proyecto ni cerrar sesión desde un teléfono
- El valor 768 duplicado entre SCSS y JS
- `$breakpoint-sm` y `$breakpoint-xl` declarados y sin uso
- El panel de actividad difiere 1 px entre dos implementaciones del mismo contenido
