# Design System

> **Placeholder inicial** — Esta estructura fue generada automáticamente por
> `/product-ux-generate`. Reemplazá el contenido placeholder con las
> definiciones reales del Design System de cada surface.

Este producto define un **Design System por surface**. Cada superficie del
producto (app, web, dashboard, etc.) tiene su propio DS independiente, con
foundations, tokens, componentes, patterns y guidelines propios. El versionado
es independiente por surface.

## Surfaces

<!-- Esta lista se genera automáticamente en /product-ux-generate. Cada entrada -->
<!-- linkea al README del DS de cada surface, donde está la versión actual e -->
<!-- inventario detallado. -->

- (se completa al bootstrappear con los surfaces detectados del producto)

## Estructura

```
docs/design-system/
├── README.md              ← este archivo (índice general)
└── {surface-name}/        ← un folder por cada superficie del producto
    ├── README.md          ← versión + inventario del surface
    ├── CHANGELOG.md       ← historial + semver propio del surface
    ├── governance.md
    ├── foundations/       ← color, typography, spacing, grid, iconography, motion, elevation, voice-tone
    ├── tokens/            ← reference, semantic, component
    ├── components/        ← catálogo de componentes del surface
    ├── patterns/          ← composiciones (forms, empty-states, etc.)
    └── guidelines/        ← accessibility, i18n, content
```

## ¿Por qué un DS por surface?

Productos multi-surface (ej. una app mobile + un dashboard web) suelen
compartir la identidad de marca pero divergen en muchas decisiones de
implementación: scales tipográficas distintas (mobile vs desktop), grids
distintos, motion más agresivo en touch, patrones de navegación distintos.
Forzar un único DS global crea fricción real. Cada surface gobierna su DS.

Si dos surfaces empiezan idénticos al bootstrappear, está bien — la
divergencia ocurre orgánicamente a medida que cada equipo itera.

## Iterar un DS

```
/product-design-system-update
```

El skill preguntará primero a qué surface aplica el cambio.

## Referencias canónicas

- [Material Design](https://m3.material.io/)
- [IBM Carbon](https://carbondesignsystem.com/)
- [Shopify Polaris](https://polaris.shopify.com/)
- [Nathan Curtis — Component Specifications](https://medium.com/eightshapes-llc/component-specifications-1492ca4c94c)

---

## Migración desde DS plano (productos viejos)

Si tu producto tiene `docs/design-system/` plano (foundations/, tokens/,
components/... directamente en la raíz, sin subfolder por surface), seguí
estos pasos:

```bash
# 1. Identificá los surfaces de tu producto (mismos que docs/ux/surfaces/)
ls docs/ux/surfaces/

# 2. Movés el contenido actual al surface primario (ej. app-conductor)
mkdir -p docs/design-system/{surface-primario}
mv docs/design-system/foundations docs/design-system/{surface-primario}/
mv docs/design-system/tokens docs/design-system/{surface-primario}/
mv docs/design-system/components docs/design-system/{surface-primario}/
mv docs/design-system/patterns docs/design-system/{surface-primario}/
mv docs/design-system/guidelines docs/design-system/{surface-primario}/
mv docs/design-system/CHANGELOG.md docs/design-system/{surface-primario}/
mv docs/design-system/governance.md docs/design-system/{surface-primario}/
mv docs/design-system/README.md docs/design-system/{surface-primario}/

# 3. Si tenés más surfaces, copiás la estructura y la personalizás
cp -r docs/design-system/{surface-primario} docs/design-system/{surface-secundario}

# 4. Creás el README raíz (este archivo) con los links a cada surface
```

Después de la migración, `/product-design-system-update` te va a preguntar el
surface antes de iterar.
