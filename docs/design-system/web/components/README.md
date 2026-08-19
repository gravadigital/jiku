# Componentes (web)

> Componentes **relevados desde el código existente** durante la importación del producto. Son los
> candidatos a Design System: componentes propios usados **más de una vez** en la superficie.
>
> `status: relevado-desde-código` significa que el spec describe lo que el componente **hace hoy**,
> no lo que debería hacer. Las secciones que el código no puede responder —do/don't, rationale de
> accesibilidad, guidelines de contenido— están **explícitamente vacías**. Un spec con reglas
> inventadas es peor que uno incompleto, porque el implementador las trata como decisiones.

## Especificados

| Componente | Usos | Spec |
|---|---|---|
| Button | 29 | [button.md](button.md) |
| Loader | 25 | [loader.md](loader.md) |
| InputSelect | 18 | [input-select.md](input-select.md) |

## Candidatos relevados sin spec todavía

Componentes propios con más de un uso, pendientes de especificar:

| Componente | Usos |
|---|---|
| `Select` | 15 |
| `TintedIcon` | 11 |
| `Tooltip` | 10 |
| `InputText` | 8 |
| `SectionCard` | 7 |
| `Spinner` | 5 |
| `InputTextarea` | 4 |
| `ToggleGroup` | 3 |
| `ConfirmDialog` | 3 |
| `InputDate` | 2 |
| `InputMultiplePersons` | 2 |
| `DateLabel` | 2 |
| `AttachmentPreview` | 2 |

## No son candidatos

**Código muerto (0 usos):** `Card`, `Header`, `Input`, `Textarea`, `MarkdownEditor`, `MultiSelect`,
`AttachmentDownload`. Ocho de ellos están exportados desde el barrel, así que **aparecen como
disponibles** [fuente: código-existente].

**No reutilizable:** `Pagination` hardcodea `router.push('/objectives?...')`, así que solo funciona
en esa ruta. Es la causa de que haya **4 paginaciones reimplementadas inline** en el producto.

## Duplicaciones a resolver

Registradas en [`gaps-as-is.md`](../../../ux/gaps-as-is.md):

- **Tres formas de hacer un select**: `InputSelect`, `Select` y `react-select` directo, este último
  con `selectStyles` duplicado en 5 archivos
- **Dos componentes de carga**: `Loader` y `Spinner`, sin regla de cuándo usar cada uno
- **Tres enfoques de formulario**: `react-hook-form`, validación `yup` manual y `useState` crudo
