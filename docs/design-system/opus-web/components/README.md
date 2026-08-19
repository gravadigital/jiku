# Componentes (opus-web)

> Componentes **relevados desde el código existente** durante la importación del producto.
>
> `status: relevado-desde-código` significa que el spec describe lo que el componente **hace hoy**.
> Las secciones que el código no puede responder están **explícitamente vacías**, no inventadas.

## Especificados

| Componente | Usos | Spec |
|---|---|---|
| Spinner | 7 | [spinner.md](spinner.md) |
| Dropdown | 4 | [dropdown.md](dropdown.md) |
| Button | 3 vivos | [button.md](button.md) |

## Candidatos relevados sin spec todavía

| Componente | Usos | Nota |
|---|---|---|
| `RichContentRenderer` | 3 | **Parsea los formatos de adjunto de las dos superficies** |
| `AttachmentPreview` | 3 | Con y sin `onRemove` |
| `AttachmentDownload` | 3 | Con y sin `onRemove` |
| `AttachmentSkeleton` | 3 | Variante `isImage` |
| `RichTextEditor` | 2 | `disabled`, `uploading` |
| `MarkdownRenderer` | 2 | Mockeado en tests (no funciona en jsdom) |
| `Toast` / `ToastContainer` | 1 (global) | `type`: error, success |

## No son candidatos

**Código muerto (0 usos):** `Card`, `Badge`, `Modal`. Están exportados desde el barrel, así que
aparecen como disponibles [fuente: código-existente].

> `Badge` define 5 variants (`default`, `success`, `warning`, `error`, `info`) y **nadie lo usa**,
> mientras el tablero pinta estados con colores hardcodeados en 6 lugares. Es el caso más claro de
> componente muerto que resolvería un problema vivo.

## Patrón propio de la superficie

**Variantes con atributos `data-*`** en vez de clases: `<button data-variant="primary">` con
`&[data-variant='primary']` en el SCSS. Es consistente en todo `shared/ui/` y tiene dos ventajas
registradas: no hay que mapear valores a nombres de clase en JS, y la variante queda visible en el
DOM al depurar.

## Duplicaciones a resolver

Registradas en [`gaps-as-is.md`](../../../ux/gaps-as-is.md):

- **Dos implementaciones de dropdown**: el `Dropdown` con portal (correcto) y tres paneles inline
  en `CreateRequirementModal` (sin `role`, sin teclado)
- **La paleta de estados y prioridades vive en 6 lugares**, ninguno en los tokens
- **El detalle de requisito está implementado dos veces**: modal y página, con 1 px de diferencia
- **Validación de adjuntos duplicada literalmente** entre `CommentInput` y `CreateRequirementModal`
