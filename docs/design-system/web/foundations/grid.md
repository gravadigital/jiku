---
foundation: grid
version: 1.0.0
last_updated: 2026-08-18
status: relevado-desde-código
platform: web
origin: relevamiento de código — docs/analysis/ux/web/index.md
---

# Grid (web)

> **Sembrado desde el código existente**, no es un placeholder. Los valores de abajo son los que
> el producto tiene hoy — incluidas sus incoherencias, que están registradas como tales.
>
> Los **nombres de viewport** se declaran por superficie en
> [`docs/ux/product-overview.md`](../../../ux/product-overview.md) → "Inventario de Superficies".

## Propósito

Sistema de grilla y breakpoints para layout responsive.

**Este archivo es la fuente única de los valores de breakpoint.** Lo consumen
`/service-planify-story`, `/service-implement-story` y `/product-ux-wireframes`.

Si un valor de acá cambia, cambia el comportamiento del código ya implementado: tratalo como un
cambio breaking y versionalo como tal (ver `governance.md`).

## El hallazgo central: esta superficie es de un solo viewport

**`web` se comporta como una superficie `desktop` única.** No es una interpretación: es lo que
el shell impone.

```scss
/* web/src/app/(loggedin)/styles.module.scss:1-26 */
.layoutContainer { display: flex; height: 100vh; overflow: hidden; }
.sidebarContainer { width: 290px; height: 100vh; overflow-y: auto; }
.mainContainer { flex: 1; height: 100vh; overflow-y: auto; padding: 1rem 2rem; }
```

La sidebar ocupa **290 px fijos a cualquier ancho**. No hay drawer, no hay botón de hamburguesa,
no hay estado colapsado, y el layout **no tiene ningún media query**. A 400 px de ancho el
contenido queda con ~46 px útiles.

Las 21 pantallas autenticadas viven dentro de ese shell, así que **el tratamiento responsive que
sí existe en 11 archivos aplica a un contenido al que no se puede llegar desde un teléfono.**

## Viewports de UX ↔ breakpoints

| Viewport UX | Ancho del frame | Breakpoint desde el que aplica | Columnas |
|---|---|---|---|
| `desktop` | 1440px | — (único) | 12 |

**`mobile` no es un viewport de esta superficie.** No se declara porque no existe: el shell no
provee navegación bajo ~1000 px.

> **Si se decide soportar mobile** (feature group FG-5), el primer trabajo es el shell —
> navegación colapsable— no los 11 archivos que ya tienen media queries. Agregar el viewport acá
> antes de eso haría que el Design System declare algo que el código no cumple.

## Breakpoints declarados en el código

**Origen:** `web/src/styles/_mixins.scss` — declarados como mixins, no como variables.

| Mixin | Media query | Usos reales | Estado |
|---|---|---|---|
| `mobile` | `max-width: 767px` | **6** en 5 archivos | En uso parcial |
| `tablet` | `min-width: 768px` y `max-width: 1023px` | **0** | Declarado, sin uso |
| `desktop` | `min-width: 1024px` | **0** | Declarado, sin uso |
| `large-desktop` | `min-width: 1440px` | **0** | Declarado, sin uso |

Uno de los 5 archivos que usan `mobile` (`ProjectDetails.module.scss:25`) pertenece a un
componente que es **código muerto**.

## Media queries fuera de los mixins

**No hay un breakpoint real de corte.** En paralelo a los mixins hay **14 `@media` crudas con 6
valores distintos**, sin coordinación entre sí:

| Valor | Ocurrencias | Ejemplos |
|---|---|---|
| `max-width: 640px` | 3 | `CreateRequirementForm.module.scss:322,479` · `EditRequirementForm.module.scss:416` |
| `max-width: 900px` | 1 | `clients/edit/[id]/styles.module.scss:108` |
| `max-width: 1023px` | 2 | `RequirementHeader.module.scss:10` · `RequirementDetail.module.scss:12` |
| `max-width: 1024px` | 2 | `CreateRequirementForm.module.scss:94` · `EditRequirementForm.module.scss:94` |
| `max-width: 1200px` | 1 | `projects/[id]/styles.module.scss:85` |
| `min-width: 1680px` | 1 | `ObjectivesGroup.module.scss:93` |

> **Dos pantallas hermanas del mismo dominio cortan en 1023 y en 1024.** `RequirementHeader` usa
> 1023 y `CreateRequirementForm` usa 1024, así que hay un píxel de ancho donde una cambia de
> layout y la otra no. Es el mejor ejemplo de por qué esto es deuda y no una decisión.

**No hay `useMediaQuery`, `matchMedia` ni `innerWidth` en código de producción**: ninguna pantalla
de `web` cambia su árbol de componentes según el ancho.

## Medidas de layout fijas

| Medida | Valor | Origen |
|---|---|---|
| Ancho de sidebar | **290px** | `(loggedin)/styles.module.scss:8` |
| Padding del área de contenido | `1rem 2rem` | `(loggedin)/styles.module.scss:20` |
| Alto del shell | `100vh` con `overflow: hidden` | `(loggedin)/styles.module.scss:2` |

## Reglas de implementación

- Un layout nuevo **DEBE** asumir `desktop` como único viewport de esta superficie, hasta que el
  shell provea navegación en anchos chicos.
- Un breakpoint nuevo **DEBE** usar los mixins de `_mixins.scss`. **NO SE DEBEN** escribir `@media`
  crudas con valores literales.
- **NO SE DEBE** agregar un sexto valor de breakpoint. Los 6 que ya existen son deuda; sumar otro
  la agrava.
- Cualquier trabajo de responsive **DEBE** empezar por el shell. Un media query en una pantalla
  interior no la hace alcanzable desde un teléfono.

## Gaps registrados

Ver [`docs/ux/gaps-as-is.md`](../../../ux/gaps-as-is.md):

- 3 de los 4 mixins de breakpoint están declarados y sin usar
- 14 media queries crudas con 6 valores distintos, dos de ellos separados por 1 px
- El shell no tiene tratamiento responsive de ningún tipo
