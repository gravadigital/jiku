# Governance del Design System

> Cómo se proponen y aplican cambios al Design System.

## Quién puede modificar

- **Equipo de diseño**: cualquier cambio (foundations, tokens, componentes, patterns, guidelines).
- **Developers**: pueden proponer cambios pero los aplica el agente al ejecutar
  `/product-design-system-update` o automáticamente desde `/service-implement-story`
  cuando un cambio en código requiere un nuevo variant/componente.

## Cómo proponer cambios

### Opción A — modificación interactiva

```bash
/product-design-system-update
```

Modo interactivo. Conversá con el agente:
- "agregá un componente `card` con variants default/elevated/outlined"
- "modificá la paleta: primary ahora es #1e40af"
- "eliminá la variant tertiary del button"
- "aplicá todo este doc que tengo acá [paste o link a archivo]"

El agente aplica el cambio, actualiza el CHANGELOG y bumpea versión semver.

### Opción B — automática (desde implementación)

Cuando `/service-implement-story` detecta que el usuario pide un cambio durante
la implementación que afecta al DS (nuevo variant, nuevo componente), el agente
actualiza el DS sin pedir confirmación. El cambio se refleja en CHANGELOG y se
bumpa versión.

## Reglas de versionado

| Bump | Cuándo aplicar | Ejemplos |
|------|----------------|----------|
| **MAJOR** (X.0.0) | Breaking changes | Remover variant, renombrar componente, cambiar API |
| **MINOR** (0.X.0) | Adiciones compatibles | Agregar componente, agregar variant, agregar foundation |
| **PATCH** (0.0.X) | Correcciones, ajustes | Fix de spec, microcopy en guidelines, ajuste de tokens |

## Deprecación

Antes de remover un componente o variant:

1. Marcarlo como `deprecated: true` en su frontmatter.
2. Agregar nota en el CHANGELOG con migration path.
3. Mantener ≥1 MINOR release antes del MAJOR que lo remueve.

## Wireframes y DS

Los wireframes mid-fi (`docs/ux/surfaces/{surface}/screens/*.md`) son
**agnósticos del DS**: declaran bloques tipados con variants conceptuales
("button variant=primary") pero no referencian el DS directamente.

El "puente" entre wireframe y DS ocurre en `/service-implement-story`:
el dev (Claude) lee ambos y mapea "button variant=primary" del wireframe
al spec real de `docs/design-system/components/button.md`.

## Coordinación entre wireframes y DS

- Si un wireframe pide un comportamiento que el DS no soporta:
  - `/service-implement-story` flag al usuario, propone actualizar DS.
  - Si el usuario confirma, se aplica `/product-design-system-update` o se hace inline.
- Si el DS hace un cambio MAJOR:
  - Los wireframes que dependan del componente afectado deben revisarse.
  - El CHANGELOG del DS lista breaking changes con migration notes.
