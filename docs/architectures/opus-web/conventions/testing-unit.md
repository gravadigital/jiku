---
id: testing-unit
display_name: Testing unitario (Vitest + Testing Library)
language: nextjs
description: Vitest con jsdom, tests en dos ubicaciones, TZ fijada en UTC, mock propio de react-markdown
applies_to: [frontend]
required_by: []
package: vitest
---

# Testing unitario (opus-web)

> **Reemplaza** la convención `testing-unit` del catálogo. Misma librería que `web`, con dos
> diferencias propias: los tests viven en **dos ubicaciones**, y hay un **mock manual de
> `react-markdown`** porque la librería no funciona en jsdom.

## Estado actual

**296 tests en 51 archivos. Todos pasan.** (`npx vitest run`, ~13 s.)

## Configuración

```ts
// opus-web/vitest.config.mts
export default defineConfig({
  plugins: [react()],
  css: {
    transformer: 'postcss',
    modules: { generateScopedName: '[local]' },
  },
  test: {
    environment: 'jsdom',
    css: true,
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['{src,__tests__}/**/*.{test,spec}.{ts,tsx}'],
    env: { TZ: 'UTC' },
  },
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
      'react-markdown': new URL('./__mocks__/react-markdown.tsx', import.meta.url).pathname,
    },
  },
});
```

Cada opción no obvia tiene su comentario en el archivo. Las cuatro que importan:

### `css: true` + `generateScopedName: '[local]'`

```ts
// Los tests asertan sobre nombres de clase sin hashear (`toHaveClass('full')`), que es
// lo que producía `next/jest`. Sin esto Vite devuelve `_full_75cd92`.
```

Sin `css: true`, Vitest devolvería un proxy vacío para los módulos SCSS y `styles.foo` sería
`undefined`. Con él, los procesa de verdad — y `generateScopedName: '[local]'` mantiene el nombre
tal cual para que `toHaveClass('active')` funcione.

El `transformer: 'postcss'` también está explicado: `generateScopedName` es una opción de
`postcss-modules`, y Vite 8 usa lightningcss por defecto, que la ignora.

**Regla:** se puede asertar sobre clases. `expect(el).toHaveClass('active')` es válido acá.

### `TZ: 'UTC'`

```ts
// Fija la zona horaria para que las aserciones de fecha no dependan de la de la máquina.
```

Sin esto, un test que espera `"15 ene 2026"` falla en una máquina con otro huso. Lo mismo hace
`web`.

**Regla:** un test de fecha no necesita mockear el huso. Ya está fijo.

### El alias de `react-markdown`

```ts
// react-markdown no funciona en jsdom: reemplazado por un render plano.
'react-markdown': new URL('./__mocks__/react-markdown.tsx', import.meta.url).pathname,
```

`__mocks__/react-markdown.tsx` es un parser de markdown escrito a mano (~190 líneas) que cubre
encabezados, listas ordenadas y no ordenadas, bloques de código, negrita, itálica, código inline y
links — incluido el override de `components.a` que usa `MarkdownRenderer`.

**Regla:** al testear un componente que renderiza markdown, el mock ya está activo. Si el
componente usa una sintaxis que el mock no cubre (tablas, blockquotes, imágenes), hay que
agregarla al mock — no mockear `react-markdown` de nuevo en el test.

### `globals: true`

`describe`, `it`, `expect` y `vi` disponibles sin importar, como en jest. Está declarado también en
`tsconfig.json:19-22` (`"types": ["@testing-library/jest-dom", "vitest/globals"]`).

## Setup

```ts
// opus-web/tests/setup.ts
import '@testing-library/jest-dom';

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {} unobserve() {} disconnect() {}
  };
}
```

Los matchers de `jest-dom` y un polyfill de `ResizeObserver`, que jsdom no implementa.

## Las dos ubicaciones

```ts
// Los tests viven en dos lugares: __tests__/ y junto al código.
include: ['{src,__tests__}/**/*.{test,spec}.{ts,tsx}'],
```

| Ubicación | Archivos | Qué contiene |
|---|---|---|
| `__tests__/` | 34 | Espeja la estructura de `src/`: rutas, route handlers, componentes de `shared/`, hooks, algunos de features |
| Junto al código | 17 | Solo componentes de `features/requirements/` (más `page.test.tsx` de la ruta de requisitos) |

El README del servicio lo reconoce: *"Tests are split between `__tests__/` and files next to the
code — a convention worth unifying."*

**Regla para código nuevo:** junto al código (`Componente.test.tsx` al lado de
`Componente.tsx`). Es lo que hace el módulo más nuevo y lo que hace `web`. No agregar a
`__tests__/` salvo que sea un test de un route handler, que no tiene un "al lado" natural.

## Qué se testea

```
__tests__/
├── app/
│   ├── api/attachments/{route,preview.route}.test.ts   route handlers
│   ├── api/opus/proxy.route.test.ts                    el catch-all
│   ├── attachments/route.test.ts                       la descarga pública
│   ├── auth/{layout,login/page}.test.tsx
│   ├── dashboard/layout.test.tsx
│   └── projects/page.test.tsx
├── features/{attachments,comments,projects,subscriptions}/
└── shared/{components,hooks,styles}/
```

**Los cuatro route handlers tienen test.** Es lo más valioso del set: son el punto donde el token
entra en juego.

## Patrones

### Mockear los hooks de datos, no la red

```tsx
// __tests__/app/projects/page.test.tsx (patrón general)
vi.mock('@/features/projects', () => ({ useProjects: () => ({ data: [...], isLoading: false }) }));
```

Se mockea el hook o el servicio, no `fetch` ni axios. Los tests no tocan la red.

### Mockear `useIsMobile` para fijar el viewport

```tsx
// src/app/(dashboard)/projects/[projectId]/requirements/page.test.tsx:31
useIsMobile: () => false,
```

Es la forma de testear la rama de desktop. Sin el mock, `useIsMobile` devuelve `false` en el primer
render de todas formas — pero dejarlo explícito documenta qué rama se está probando.

**Regla:** un componente que ramifica por `useIsMobile` necesita un test por rama, con el hook
mockeado en cada uno.

### Los hooks se testean con un wrapper de `QueryClientProvider`

Los tests de `useSubscribe`, `useUnsubscribe` y `useCreateComment` montan el hook con
`renderHook` dentro de un `QueryClientProvider` propio.

**Regla:** un `QueryClient` nuevo por test, para no compartir cache entre casos.

### Aserciones por rol y texto, no por clase

Aunque las clases están disponibles, el patrón dominante es `getByRole` y `getByText`. Las
aserciones de clase se usan para variantes visuales (`toHaveClass('active')`), no para encontrar
elementos.

## Comandos

```sh
npm test           --workspace opus-web    # vitest run
npm run test:watch --workspace opus-web
npm run test:cov   --workspace opus-web
```

En CI corren dentro del `npm test` de la raíz, que abarca los cuatro workspaces
(`.github/workflows/ci.yml`).

## Cobertura faltante

No hay umbral configurado ni reporte publicado. Lo que **no** tiene ningún test:

| Sin cobertura | Nota |
|---|---|
| `middleware.ts` | **El guard de toda la aplicación.** Es la ausencia más significativa |
| `features/auth/config/nextauth.config.ts` | Los callbacks `jwt` y `session`, incluido el cálculo de `expiresAt` |
| `features/auth/services/authApi.ts` | `presentInApi` y su tragado deliberado de errores |
| `contexts/ProjectContext.tsx` | Incluido el throw fuera del provider |
| `lib/axios.ts` | Los interceptores: la normalización a `ApiError` y el redirect del 401 |
| `features/requirements/hooks/*` | Los seis hooks del módulo más grande |
| `features/requirements/services/requirementsApi.ts` | — |
| `RequirementDetailModal` | Los subcomponentes sí tienen; el contenedor y su rama mobile/desktop, no |
| `CreateRequirementModal` | Tiene test, pero no cubre el submit con error |

**El patrón:** lo que está bien cubierto son los componentes de presentación y los route handlers.
Lo que no, es la capa de autenticación y datos.

## Qué NO hacer

- No mockear `fetch` ni axios: mockear el hook o el servicio.
- No `getByTestId` cuando hay un rol o un texto accesible. Los `data-testid` que existen
  (`login-page`, `modal-overlay`, `activity-panel`, `comment-input`, `rich-text-editor`,
  `desc-file-input`) son para contenedores sin rol propio.
- No mockear `react-markdown` en un test: ya está aliaseado globalmente.
- No mockear la zona horaria: ya está en UTC.
- No compartir un `QueryClient` entre tests.
- No agregar tests a `__tests__/` para componentes nuevos: van junto al código.
