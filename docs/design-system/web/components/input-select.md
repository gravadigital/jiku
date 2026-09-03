---
component: InputSelect
version: 2.0.0
last_updated: 2026-09-02
status: deprecated
deprecated: true
superseded_by: select
surface: web
origin: web/src/shared/components/ui/InputSelect/InputSelect.tsx
related:
  - select
---

# InputSelect (web) — **deprecado**

> ⚠️ **Deprecado el 2026-09-02.** Reemplazado por [Select](./select.md), que unifica los tres
> selectores que convivían en esta superficie. Este archivo se conserva **al menos un release**
> para que los 18 usos existentes tengan una referencia mientras se migran.
>
> **No usar en pantallas nuevas.** Un formulario nuevo usa [Select](./select.md).

## Por qué se deprecó

El relevamiento registró **tres formas de hacer un select** en `web`: `InputSelect` (18 usos),
`Select` (15) y `react-select` usado directamente en 5 pantallas con su `selectStyles` duplicado
literalmente en cada archivo. Con la migración de marca eso deja de ser sólo deuda: **cualquier
cambio de paleta habría que aplicarlo tres veces.**

## Migration path

Reemplazar por [Select](./select.md) con `variant="single"`:

```diff
- <InputSelect error={hasError} ... />
+ <Select variant="single" label="Tipo" options={options}
+         value={value} onChange={setValue}
+         error={errorMessage} />
```

Tres diferencias de contrato a atender en cada uso:

| `InputSelect` | `Select` |
|---|---|
| `error: boolean` — sólo pinta el borde | `error: string` — lleva el mensaje, que `aria-describedby` necesita |
| Label no garantizado por el componente | `label` requerido y asociado con `<label for>` |
| Radio `--radius-items` (8 px), foco violeta | Radio **10 px**, foco **anillo verde agua al 22 %** |

## Estado del componente al momento de deprecarse

Selector de una opción dentro de un formulario. **18 usos.** Sin variants de presentación; la única
prop de variación era `error` (booleana). States: `default`, `focus` (outline
`--color-highlighted`), `error` (borde `--color-button-delete`); `disabled` no relevado.

**Sin verificar:** el relevamiento no registró la asociación label↔control ni el anuncio del
mensaje de error. [Select](./select.md) especifica ambos.

## Historial

- **2.0.0** (2026-09-02) — **Deprecado** en favor de [Select](./select.md), que unifica los tres
  selectores de la superficie. Se conserva con migration path (MAJOR).
- **1.0.0** (2026-08-18) — Relevado desde el código existente.
