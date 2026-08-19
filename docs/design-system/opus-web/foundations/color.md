---
foundation: color
version: 1.0.0
last_updated: 2026-08-18
status: relevado-desde-código
origin: relevamiento de código — opus-web/src/styles/_variables.scss
---

# Color (opus-web)

> **Sembrado desde el código existente.** Los valores son los que el producto usa hoy. Las
> incoherencias están registradas, no corregidas.

## Propósito

Define la paleta del portal de clientes y su rol semántico.

**Fuente en el código:** `opus-web/src/styles/_variables.scss`.

## Brand

| Token DS | Variable en código | Hex | Uso observado |
|---|---|---|---|
| `color.brand.primary` | `--color-primary` | **`#2563eb`** | Botones primarios, logo del sidebar, focus ring, tab activo |
| `color.brand.primary-hover` | `--color-primary-hover` | `#1d4ed8` | Hover de botón primario |
| `color.brand.primary-light` | `--color-primary-light` | `#dbeafe` | (sin uso observado) |

> **`color.brand.primary` es `#2563eb`** — azul. Es lo que lee el generador de wireframes y lo que
> el implementador consume vía `bg.action.primary`.
>
> **Las dos superficies del producto NO comparten color de marca**: el gestor interno usa magenta
> (`#DA2C6A`) y el portal usa azul (`#2563eb`). No hay evidencia en el código de si es deliberado
> —dos productos con identidad propia— o divergencia. Está registrado como pregunta abierta.

## Neutrales

| Token DS | Variable en código | Hex | Uso |
|---|---|---|---|
| `color.neutral.0` | `--color-background` | `#ffffff` | Fondo de página |
| `color.neutral.50` | `--color-surface` | `#f8fafc` | Fondo de paneles secundarios |
| `color.neutral.100` | `--color-surface-hover` | `#eef2f7` | Hover de fila en la tabla |
| `color.neutral.300` | `--color-border` | `#e2e8f0` | Todos los bordes y separadores |
| `color.neutral.400` | `--color-text-muted` | `#94a3b8` | Placeholders, valores vacíos |
| `color.neutral.500` | `--color-text-secondary` | `#64748b` | Texto secundario, metadatos |
| `color.neutral.900` | `--color-text-primary` | `#0f172a` | Texto principal |

La escala neutral es **coherente y única**, a diferencia de la de `web`. Es la paleta gris de
Tailwind (`slate`), aunque el proyecto no usa Tailwind.

## Semánticos

| Token DS | Variable en código | Hex | Uso |
|---|---|---|---|
| `color.semantic.success` | `--color-success` | `#16a34a` | Toast de éxito |
| `color.semantic.warning` | `--color-warning` | `#ca8a04` | (sin uso observado) |
| `color.semantic.danger` | `--color-error` | `#dc2626` | Textos de error, botón `danger` |
| `color.semantic.info` | `--color-info` | `#0891b2` | (sin uso observado) |

## Dark mode: declarado y nunca activado

`_variables.scss:97-104` redefine seis variables bajo `[data-theme='dark']`.

**Nada setea ese atributo**: no hay toggle, ni lectura de `prefers-color-scheme`, ni persistencia.
El modo oscuro existe en la hoja de estilos y es inalcanzable.

## Paleta de dominio: el hallazgo principal

**Los colores de estado y prioridad —los que el usuario más ve— NO están en los tokens.** Viven
duplicados en **seis lugares**, ninguno de ellos `_variables.scss`.

### Estados de requisito

**Origen:** `requirement.constants.ts:1-9`, campo `dotColor`

| Estado | Etiqueta | Hex |
|---|---|---|
| `analisis` | Análisis | `#94a3b8` |
| `planificacion` | Planificación | `#8b5cf6` |
| `en_cola` | En cola | `#0ea5e9` |
| `desarrollo` | Desarrollo | `#22c55e` |
| `revision` | Revisión | `#f59e0b` |
| `resuelto` | Resuelto | `#2563eb` |
| `cancelado` | Cancelado | `#ef4444` |

### Prioridades

**Origen:** `requirement.constants.ts:11-17`, campo `color`

| Prioridad | Etiqueta | Hex |
|---|---|---|
| `sin_prioridad` | Sin prioridad | `#64748b` |
| `baja` | Baja | `#1d4ed8` |
| `media` | Media | `#b45309` |
| `alta` | Alta | `#c2410c` |
| `urgente` | Urgente | `#e11d48` |

### Las duplicaciones

Los mismos colores están hardcodeados, **con valores que no siempre coinciden**, en:
`RequirementInfoPanel.module.scss:77-114` · `KanbanCard.module.scss` · `KanbanColumn.module.scss` ·
`ListRequirementRow.module.scss` · `RequirementGroupRow.module.scss`

> ⚠️ **Divergencia real detectada:** la prioridad `baja` es `#1d4ed8` en el TypeScript y
> `--color-priority-low: #3b82f6` en `RequirementInfoPanel.module.scss:104`. **Son azules distintos
> para el mismo concepto en dos pantallas del mismo producto.**

**Esta es la deuda de color más importante de la superficie.** Un cambio de color de estado exige
hoy tocar seis archivos, y el sexto se olvida.

## Reglas de implementación

- Todo color **DEBE** referenciar una custom property de `_variables.scss`.
- Los colores de dominio (estado, prioridad) **DEBERÍAN** migrarse a custom properties. Hasta que
  eso pase, la fuente autoritativa es **`requirement.constants.ts`**, no los módulos SCSS.
- **NO SE DEBE** agregar una séptima copia de la paleta de estados. Un componente nuevo consume
  `requirement.constants.ts`.
- **NO SE DEBEN** usar px literales de color fuera de la escala.
- El bloque `[data-theme='dark']` **NO DEBE** ampliarse mientras no exista un mecanismo que lo
  active: mantener un modo inalcanzable es costo sin beneficio.

## Gaps registrados

Ver [`docs/ux/gaps-as-is.md`](../../../ux/gaps-as-is.md):

- La paleta de dominio vive en **6 lugares**, ninguno en los tokens
- **Divergencia de valor** para el mismo concepto: prioridad `baja` es `#1d4ed8` o `#3b82f6` según
  la pantalla
- Dark mode declarado y sin forma de activarlo
- `--color-warning` y `--color-info` declarados sin uso
- Las dos superficies del producto tienen color de marca distinto sin decisión registrada
