---
id: testing-unit
display_name: Testing unitario (Vitest + Testing Library)
language: nextjs
description: Vitest con jsdom, tests junto al código, TZ fijada a UTC, páginas de servidor incluidas
applies_to: [frontend]
required_by: []
package: vitest
---

# Testing unitario (web)

> **Reemplaza** la convención `testing-unit` del catálogo. Mismas herramientas (Vitest + Testing
> Library) pero tres diferencias concretas: los tests viven junto al código y no en `__tests__/`,
> la timezone está fijada, y **sí se testean páginas de servidor async** — que el catálogo
> desaconseja explícitamente citando la doc de Next.

## Estado

| Métrica | Valor |
|---|---|
| Archivos de test | 73 |
| Casos (`it` / `test`) | 644 |
| Bloques `describe` | 109 |

## Configuración

```ts
// vitest.config.mts
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    // Pins the timezone so date assertions do not depend on the machine's. A
    // date literal like '2026-08-01' is parsed as midnight UTC, which is the
    // previous day west of Greenwich: without this, tests pass locally and fail
    // in CI, where the runner is UTC.
    env: { TZ: 'UTC' },
  },
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
      '@root': new URL('./src', import.meta.url).pathname,
      '@public': new URL('./public', import.meta.url).pathname,
    },
  },
});
```

**Reglas:**

- **`TZ: 'UTC'` no se toca.** El comentario explica el fallo que previene: un literal
  `'2026-08-01'` se parsea como medianoche UTC, que al oeste de Greenwich es el día anterior. Sin
  esto los tests pasan en Argentina y fallan en CI.
- Los alias se declaran **a mano**, no con `vite-tsconfig-paths`. Si se agrega un alias en
  `tsconfig.json`, hay que agregarlo también acá o los tests no resuelven el import.
- `globals: true`: `describe`, `it`, `expect` y `vi` sin importar.

### Setup

```ts
// tests/setup.ts
import '@testing-library/jest-dom';

if (typeof globalThis.ResizeObserver === 'undefined') { /* stub */ }

if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}
```

**Reglas:**

- Los polyfills están porque jsdom no los implementa: `ResizeObserver` lo necesita `react-select`,
  y `showModal`/`close` los necesita `<ConfirmDialog>`, que usa `<dialog>` nativo.
- Un polyfill nuevo va acá, con guarda de existencia, no en el archivo de test.

## Ubicación

**Junto al archivo que testean**, como `{Nombre}.test.tsx` o `{nombre}.test.ts`.

```
features/requirements/components/RequirementDetail/
├── RequirementDetail.tsx
├── RequirementDetail.module.scss
├── RequirementDetail.test.tsx
└── RequirementDetail.states.test.tsx     ← se puede partir por tema
```

**Reglas:**

- No hay carpeta `__tests__/`. `tests/` en la raíz tiene **solo** el setup.
- Un archivo puede partirse por tema con un segundo segmento (`.states.test.tsx`).
- Los tests de página van junto a la página: `app/(loggedin)/objectives/page.test.tsx`.

## Qué se testea

| Tipo | Ejemplo |
|---|---|
| Client Components con interacción | `RequirementHeader.test.tsx`, `ToggleGroup.test.tsx` |
| **Páginas de servidor async** | `objectives/page.test.tsx`, `projects/[id]/page.test.tsx` |
| Route handlers | `api/attachments/[id]/download/route.test.ts` |
| Hooks | `features/objectives/hooks/`, `features/attachments/hooks/` |
| Server Actions como funciones | `features/requirements/services/` |
| Utilidades puras | `shared/utils/format-minutes.test.ts`, `features/*/utils/` |

Las páginas de servidor se testean invocando el componente como función async y renderizando lo
que devuelve. Funciona porque estas páginas reciben `searchParams`/`params` y delegan el fetch a
Server Actions que el test mockea.

## Patrón de mock

Lo que se mockea es la **capa de servicios o de hooks**, no `fetch` ni axios.

```tsx
vi.mock('@/features/requirements/hooks/useRequirements', () => ({
  useRequirements: vi.fn(),
}));
```

**Reglas:**

- Mockear el hook cuando se testea un componente; mockear el service cuando se testea un hook.
- **No** mockear `apiClient` ni `fetch` global: acopla el test al transporte.
- `next/navigation` (`useRouter`, `useSearchParams`) se mockea cuando el componente navega.

## Estilo

```tsx
describe('RequirementHeader', () => {
  it('no ofrece "En cola" cuando el requisito es una incidencia', async () => {
    render(<RequirementHeader requirement={incidencia} onUpdate={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /análisis/i }));
    expect(screen.queryByRole('option', { name: 'En cola' })).not.toBeInTheDocument();
  });
});
```

**Reglas:**

- Nombres de test en **español**, describiendo comportamiento observable, no implementación.
- Consultas por rol y nombre accesible (`getByRole`) antes que por clase o `data-testid`. Hay
  `data-testid` en el código (`submit-button`, `step-dot`, `blank-line`) para lo que no tiene rol.
- `userEvent` antes que `fireEvent`.
- `queryBy*` para aserciones de ausencia; `getBy*` tira si no encuentra.

## Cobertura faltante

Sin ningún test: **`features/clients`**, **`features/time-allocation`**, **`src/contexts/`**,
**`src/lib/`** (auth, axios, queryClient) y **`shared/components/layout/`** salvo `Navbar`.

`src/lib/` es el más significativo: el interceptor que inyecta el token y el que normaliza el
`ApiError` no tienen test.

## Sin E2E

No hay Playwright ni ninguna suite end-to-end. Por eso los flujos completos (login OIDC, upload
real, carga de horas de punta a punta) no están cubiertos por nada.

La convención `testing-e2e` del catálogo **no se declara en el manifest** justamente porque no
aplica hoy.

## Comandos

```sh
npm test        --workspace web    # vitest run
npm run test:watch --workspace web
npm run lint    --workspace web
```

## Qué NO hacer

- No cambiar `TZ` ni quitarlo del config.
- No agregar un alias en `tsconfig.json` sin replicarlo en `vitest.config.mts`.
- No mockear `fetch` ni `apiClient`.
- No usar `data-testid` cuando hay un rol o un label accesible disponible.
