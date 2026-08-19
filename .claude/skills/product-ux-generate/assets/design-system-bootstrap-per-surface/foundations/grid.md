---
foundation: grid
version: 0.1.0
last_updated: {{DATE}}
status: placeholder
platform: web
---

# Grid (web)

> **Placeholder inicial** — Ajustar los valores a los breakpoints reales del producto.
> Esta es la variante para superficies `platform: web` (y `desktop-app`), donde el ancho **es** el eje
> de variación. Una superficie `mobile-app` usa la otra variante: en una app nativa hay un solo layout
> y lo que se define son safe areas, escalado de texto y clases de tamaño.
> Los **nombres de viewport** (`mobile`, `desktop`) no se cambian acá: se declaran por superficie
> en `docs/ux/product-overview.md` → "Inventario de Superficies".

## Propósito

Sistema de grilla y breakpoints para layout responsive. Define columnas, gutters y safe areas en
cada breakpoint.

**Este archivo es la fuente única de los valores de breakpoint.** Lo consumen:

- `/service-planify-story`, que lo copia al Story Plan para que el implementador sepa a qué anchos
  cambia el layout.
- `/service-implement-story`, que implementa contra estos tokens y no contra píxeles inventados.
- `/product-ux-wireframes`, que lo lee (si no es placeholder) para titular los layouts por viewport
  con los anchos reales.

Si un valor de acá cambia, cambia el comportamiento del código ya implementado: tratalo como un
cambio breaking y versionalo como tal (ver `governance.md`).

## Viewports de UX ↔ breakpoints

Los wireframes se producen en **viewports canónicos**; el código cambia de layout en
**breakpoints**. No son lo mismo y esta tabla es el puente:

| Viewport UX | Ancho del frame | Breakpoint desde el que aplica | Columnas |
|-------------|-----------------|--------------------------------|----------|
| `mobile` | 400px | `bp.xs` (0) | 4 |
| `desktop` | 1200px | `bp.lg` (1024px) | 12 |

Los anchos intermedios (`bp.sm`, `bp.md`) no tienen wireframe propio: son la transición entre los
dos layouts declarados. Definí acá a cuál de los dos se parecen — es la única indicación que va a
tener el implementador para el rango del medio.

- **640px–1023px** (`bp.sm`, `bp.md`): {{se comporta como mobile | se comporta como desktop}}.

## Breakpoints (placeholder)

| Token | Min width | Columnas | Gutter | Margen |
|-------|-----------|----------|--------|--------|
| `bp.xs` | 0 | 4 | 16px | 16px |
| `bp.sm` | 640px | 8 | 16px | 24px |
| `bp.md` | 768px | 12 | 24px | 32px |
| `bp.lg` | 1024px | 12 | 24px | 48px |
| `bp.xl` | 1280px | 12 | 32px | 64px |

## Guidelines

**Do:**
- Diseñar mobile-first y escalar.
- Usar la grilla del breakpoint actual para alinear contenido.
- Expresar los anchos de columna como fracciones sobre 12, igual que los layouts de los screens
  (`docs/ux/surfaces/{{surface}}/screens/*.md` → "Layout por viewport"), para que la spec de UX y
  la grilla del código hablen el mismo idioma.

**Don't:**
- No mezclar grillas (4 col mobile + 12 col desktop como capas independientes).
- No fixed widths sin breakpoint declarado.
- No cambiar de layout en un ancho que no esté declarado en esta tabla.

## Accesibilidad

- Contenido debe ser usable a 200% de zoom sin scroll horizontal.
- En mobile, evitar columnas de texto demasiado angostas (<320px).

## Historial

- {{DATE}} v0.1.0 — Placeholder inicial.
