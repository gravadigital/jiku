# Componentes (web)

> **Normativos desde v2.0.0.** Los specs describen lo que cada componente **debe** ser según el
> **Manual de marca Jiku v1.0**, no lo que el código hace hoy. Cada spec
> lleva una sección **Migración** con la conversión desde el estado actual.
>
> **Los 21 specs están en `status: normativo`.** Las dos decisiones que `v2.0.0` había dejado
> marcadas —etapas del stepper y presentación de la acción destructiva— se resolvieron en
> `v2.1.0`; ver el [CHANGELOG](../CHANGELOG.md).

## Especificados

### Acción y formulario

| Componente | Spec | Estado |
|---|---|---|
| Button | [button.md](button.md) | normativo · 5 variants + FAB |
| Input | [input.md](input.md) | normativo · unifica InputText / Textarea / Date |
| Select | [select.md](select.md) | normativo · **unifica los 3 selectores** |
| ToggleGroup | [toggle-group.md](toggle-group.md) | normativo · segmentado, pills, horas, chips de día |
| ConfirmDialog | [confirm-dialog.md](confirm-dialog.md) | normativo · confirmar en secundario, la advertencia va en el texto |

### Datos y estado

| Componente | Spec | Estado |
|---|---|---|
| Badge | [badge.md](badge.md) | normativo · estado, tipo, prioridad, área · **el `editable` es el control de estado** |
| Card | [card.md](card.md) | normativo · proyecto, tarea, vencida, panel, métrica |
| Table | [table.md](table.md) | normativo · 2 densidades + matriz |
| Stepper | [stepper.md](stepper.md) | normativo · **cinco** pasos; informa, no cambia el estado |
| Avatar | [avatar.md](avatar.md) | normativo · persona y app |

### Navegación

| Componente | Spec | Estado |
|---|---|---|
| SidebarNav | [sidebar-nav.md](sidebar-nav.md) | normativo · 300 px, activo con barra verde agua |
| ViewHeader | [view-header.md](view-header.md) | normativo · Sora 30/700 + breadcrumb |
| Tabs | [tabs.md](tabs.md) | normativo · con contador |
| Pagination | [pagination.md](pagination.md) | normativo · **agnóstica de la ruta** |
| WeekNav | [week-nav.md](week-nav.md) | normativo |

### Feedback y contenido

| Componente | Spec | Estado |
|---|---|---|
| Loader | [loader.md](loader.md) | normativo · **unifica Loader + Spinner** |
| EmptyState | [empty-state.md](empty-state.md) | normativo · 3 variants |
| Dropzone | [dropzone.md](dropzone.md) | normativo |
| Accordion | [accordion.md](accordion.md) | normativo |
| Tooltip | [tooltip.md](tooltip.md) | normativo |

### Deprecados

| Componente | Spec | Reemplazado por |
|---|---|---|
| InputSelect | [input-select.md](input-select.md) | [Select](select.md) — se conserva ≥1 release |

## El reparto del estado del requisito

Tres controles, y la separación es deliberada (ver
[stepper.md](stepper.md#reparto-de-responsabilidades)):

| Control | Rol | Alcance |
|---|---|---|
| [Stepper](stepper.md) | Leer **dónde está** | 5 pasos de trabajo |
| [Badge editable](badge.md) en [ViewHeader](view-header.md) | Decidir **a dónde va** | 7 estados, sin recorte |
| Card de resolución | Cerrar y reabrir | Resolver · Cancelar · Reabrir |

## Duplicaciones resueltas por esta versión

Las tres duplicaciones que [`gaps-as-is.md`](../../../ux/gaps-as-is.md) registraba tienen ahora un
destino único:

| Duplicación | Resolución |
|---|---|
| **Tres formas de hacer un select** — `InputSelect` (18), `Select` (15), `react-select` directo en 5 archivos con `selectStyles` duplicado | [Select](select.md), un solo componente con 4 variants |
| **Dos componentes de carga** — `Loader` (25) y `Spinner` (5), sin regla de cuándo usar cada uno | [Loader](loader.md) con `block` / `inline` y la regla explícita |
| **Tres enfoques de formulario** — `react-hook-form`, `yup` manual, `useState` crudo | **Sin resolver acá.** Es una decisión de implementación, no de Design System |

**Además:** [Pagination](pagination.md) deja de hardcodear `router.push('/objectives?...')`, que era
la causa de las 4 paginaciones reimplementadas inline.

## Candidatos relevados sin spec

Del relevamiento original, siguen sin spec propio porque el manual no los menciona:

| Componente | Usos | Nota |
|---|---|---|
| `TintedIcon` | 11 | Probablemente absorbido por las reglas de [iconography](../foundations/iconography.md) |
| `InputMultiplePersons` | 2 | Caso particular de [Select](select.md) `multiple` |
| `DateLabel` | 2 | Formato de fecha; candidato a utilidad, no a componente |
| `AttachmentPreview` | 2 | Vive dentro de [Dropzone](dropzone.md); a especificar si crece |
| `AttachmentSkeleton` | — | Skeleton, distinto de [Loader](loader.md) |

## Código muerto a eliminar

Sin usos, y **ocho de ellos exportados desde el barrel**, así que aparecen como disponibles:
`Card`, `Header`, `Input`, `Textarea`, `MarkdownEditor`, `MultiSelect`, `AttachmentDownload`.

> Los nombres `Card`, `Input` y `Textarea` **colisionan con specs nuevos**. Al migrar hay que
> eliminarlos del barrel antes de crear los componentes nuevos, o el import resolverá al muerto.
