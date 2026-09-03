---
foundation: grid
version: 2.1.0
last_updated: 2026-09-02
status: mixto
scope_note: layout normativo · responsive es objetivo declarado sin fecha
platform: web
origin: Manual de marca Jiku v1.0 (medidas de layout) + relevamiento de código (breakpoints)
---

# Grid (web)

> **Documento mixto, y es deliberado.** Las **medidas de layout** son normativas: las fija la
> «Geometría del sistema» del Manual de marca Jiku v1.0. Los **breakpoints y el viewport único**
> siguen siendo relevamiento del código: el manual no habla de responsive, así que el hallazgo del
> relevamiento sigue vigente y no se puede reemplazar con una decisión que nadie tomó.
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

**`mobile` no es un viewport de esta superficie *hoy*.** No se declara porque el shell no provee
navegación bajo ~1000 px. **Es un objetivo declarado sin fecha**, no una ausencia deliberada — ver
[Mobile es un objetivo declarado](#mobile-es-un-objetivo-declarado-sin-fecha).

### Mobile es un objetivo declarado, sin fecha

**Decidido el 2026-09-02** (pregunta abierta 6 del PRD): **`web` debe llegar a ser usable en
mobile**, pero no es prioritario y no tiene fecha. Queda en
[FG-5](../../../prd/feature-groups.md).

**`mobile` NO se declara todavía como viewport de esta superficie**, y es deliberado: el shell no
provee navegación bajo ~1000 px, así que declararlo haría que el Design System **afirme algo que el
código no cumple** — exactamente el error que este DS evita.

**El primer trabajo es el shell** —navegación colapsable o drawer—, no los archivos que ya tienen
media queries. Un media query en una pantalla interior no la vuelve alcanzable desde un teléfono.

**El manual de marca no dice nada de mobile.** Con sidebar de 300 px fijos y grilla de 4 columnas,
el sistema que especifica es de escritorio. Cuando se encare, **hay que decidir desde cero cómo se
ve Jiku en un teléfono**: no hay fuente de diseño que lo responda.

> **Consecuencia que hay que aceptar:** mientras mobile siga siendo un objetivo abierto, **la deuda
> de breakpoints no se puede limpiar**. Los 3 mixins sin uso y las 10 `@media` crudas quedan como
> avance parcial de algo que se va a hacer, no como código a borrar. Ver
> [Gaps registrados](#gaps-registrados).

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

**No hay un breakpoint real de corte.** En paralelo a los mixins hay **10 `@media` crudas con 6
valores distintos**, sin coordinación entre sí (verificado el 2026-09-02):

| Valor | Ocurrencias | Ejemplos |
|---|---|---|
| `max-width: 640px` | 3 | `CreateRequirementForm.module.scss:324,481` · `EditRequirementForm.module.scss:418` |
| `max-width: 900px` | 1 | `clients/edit/[id]/styles.module.scss:108` |
| `max-width: 1023px` | 2 | `RequirementHeader.module.scss:10` · `RequirementDetail.module.scss:12` |
| `max-width: 1024px` | 2 | `CreateRequirementForm.module.scss:96` · `EditRequirementForm.module.scss:96` |
| `max-width: 1200px` | 1 | `projects/[id]/styles.module.scss:85` |
| `min-width: 1680px` | 1 | `ObjectivesGroup.module.scss:93` |

> **Dos pantallas hermanas del mismo dominio cortan en 1023 y en 1024.** `RequirementHeader` usa
> 1023 y `CreateRequirementForm` usa 1024, así que hay un píxel de ancho donde una cambia de
> layout y la otra no. Es el mejor ejemplo de por qué esto es deuda y no una decisión.

**No hay `useMediaQuery`, `matchMedia` ni `innerWidth` en código de producción**: ninguna pantalla
de `web` cambia su árbol de componentes según el ancho.

## Medidas de layout — normativas

Las fija el Manual de marca Jiku v1.0. Ver [spacing](./spacing.md#layout).

| Medida | Valor normativo | Valor en el código hoy |
|---|---|---|
| Ancho de sidebar | **300 px fijo** | 290 px (`(loggedin)/styles.module.scss:8`) |
| Padding del área de contenido | **32 px** | `1rem 2rem` (16/32 px) |
| Divisor de estructura | **1 px `#DFE1E7`** | — |
| Grilla de tarjetas | **4 columnas · gap 18 px** | — |
| Alto del shell | `100vh` con `overflow: hidden` | igual |

> El sidebar pasa de **290 px a 300 px** y el padding vertical del contenido, de 16 px a **32 px**.
> Son los dos cambios de layout que la migración tiene que aplicar en el shell.

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

Ver [`docs/ux/gaps-as-is.md`](../../../ux/gaps-as-is.md). Verificado sobre el código el
2026-09-02:

- **3 de los 4 mixins están declarados y sin usar.** Sólo `mobile` se usa (6 veces); `tablet`,
  `desktop` y `large-desktop` tienen **0 usos**.
- **10 `@media` crudas con 6 valores distintos**, fuera de los mixins: 640 · 900 · 1023 · 1024 ·
  1200 · 1680 px. **`1023` y `1024` conviven** — hay un píxel de ancho donde una pantalla cambia de
  layout y su hermana no.
- El shell no tiene tratamiento responsive de ningún tipo.

> **Estos tres gaps quedan abiertos por decisión, no por olvido.** Como mobile es un objetivo
> declarado (ver arriba), esta deuda **no se limpia**: borrar los mixins y unificar los cortes sería
> tirar el avance parcial de un trabajo que se va a hacer. Se revisa cuando se encare el shell.
>
> **Lo que sí conviene hacer antes:** el par `1023`/`1024` no es avance parcial de nada, es un
> error. Unificarlo no compromete ninguna decisión futura.

## Historial

- 2026-09-02 v2.1.0 — **Decidido el comportamiento responsive** (pregunta abierta 6 del PRD):
  mobile es un **objetivo declarado sin fecha**, no una ausencia deliberada. `mobile` no se declara
  como viewport hasta que el shell lo cumpla. Se registra que la deuda de breakpoints **queda
  abierta por decisión** —es avance parcial de trabajo futuro, no código a borrar— con la excepción
  del par 1023/1024 px, que es un error y conviene unificar. Gaps verificados contra el código: son
  **10** `@media` crudas con 6 valores (las otras 4 del grep son las definiciones de los mixins), y
  se corrigen los números de línea de los ejemplos (MINOR).
- 2026-09-02 v2.0.0 — Medidas de layout pasan a normativas por la «Geometría del sistema» del
  Manual de marca Jiku v1.0: sidebar 300 px, padding de contenido 32 px, grilla de 4 columnas con
  gap de 18 px. Los breakpoints y el viewport único siguen siendo relevamiento: el manual no habla
  de responsive (MAJOR — cambia el ancho del shell).
- 2026-08-18 v1.0.0 — Sembrado desde el código existente durante la importación del producto.
