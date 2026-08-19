# Estándares de desarrollo: web

Convenciones de código observadas en el repositorio. Lo que dice la herramienta (ESLint,
Prettier, TypeScript) es autoritativo; lo de acá es lo que la herramienta no chequea.

## TypeScript

```json
// tsconfig.json
"strict": true, "target": "ES2017", "jsx": "react-jsx",
"moduleResolution": "node", "isolatedModules": true, "noEmit": true
```

**Reglas:**

- `strict` no se relaja por archivo.
- **Tipo de retorno explícito en las Server Actions.** Es el único contrato con la api que el
  compilador conoce: `Promise<Project[]>`, `Promise<void>`.
- `interface` para props y objetos de dominio; `type` para uniones y alias.
- Props siempre `readonly`:

  ```ts
  interface ButtonProps {
    readonly label: string;
    readonly onClick?: MouseEventHandler<Element>;
  }
  ```

- `import type` para imports que solo son tipos. El `import/order` los agrupa al final.
- `any` está en `warn`, no en `error`. Hay cuatro usos activos: `clients/edit/[id]/page.tsx:30`,
  `NavItem.tsx:28`, `NavSubItem.tsx:28`, `projectsApi.ts:53`. No agregar más.

## Aliases de import

| Alias | Apunta a |
|---|---|
| `@/*` | `./src/*` |
| `@root/*` | `./src/*` (idéntico a `@/`) |
| `@public/*` | `./public/*` |
| `@/shared/*`, `@/features/*`, `@/lib/*` | subrutas explícitas de `src/` |

**Reglas:**

- `@/` para código; `@root/` **solo para assets** (`import logo from '@root/assets/logoLayout.png'`).
  Es la distinción que el código mantiene aunque los dos resuelvan al mismo lugar.
- Un alias nuevo va en `tsconfig.json` **y** en `vitest.config.mts`. Están declarados aparte.

## Orden de imports

Lo impone ESLint (`import/order`, error). Grupos, sin líneas en blanco entre ellos, alfabético
dentro de cada uno:

```
builtin → external (react primero) → internal (@/** antes, @root/** después)
  → parent → sibling → index → object → type
```

```tsx
'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import * as yup from 'yup';
import { useCreateClient } from '@/features/clients';
import { PageLayout } from '@/shared/components/layout';
import { Button } from '@/shared/components/ui';
import editIcon from '@root/assets/editIcon.svg';
import styles from './styles.module.scss';
import type { ClientFilters } from '@/features/clients/types/client.types';
```

**Regla:** `styles` va siempre último de los imports de valor, y los `import type` después.

## Nombres

| Elemento | Convención | Ejemplo |
|---|---|---|
| Componente | PascalCase, archivo = componente | `ProjectCard.tsx` → `ProjectCard` |
| Hook | `use` + camelCase | `useProjects.ts` → `useProjects` |
| Hook global | kebab-case en el archivo | `use-current-user.ts` → `useCurrentUser` |
| Service | `{recurso}Api.ts` | `projectsApi.ts` |
| Service de cliente | `{recurso}ClientApi.ts` | `attachmentsClientApi.ts` |
| Tipos | `{recurso}.types.ts` | `project.types.ts` |
| Utilidad | kebab-case | `format-minutes.ts`, `calculate-days-left.ts` |
| Módulo SCSS | `{Componente}.module.scss` | `Button.module.scss` |
| Clase CSS | camelCase | `styles.buttonContainer` |
| Payload | `Create{X}Payload` / `Update{X}Payload` | `CreateProjectPayload` |
| Constante de módulo | SCREAMING_SNAKE | `STATE_OPTIONS`, `PRIORITY_LABELS` |

> Los hooks de feature usan camelCase en el nombre de archivo (`useProjects.ts`) y los globales
> kebab-case (`use-current-user.ts`). Inconsistencia registrada, no unificada.

## Estructura de un componente

```
Componente/
├── Componente.tsx
├── Componente.module.scss
├── Componente.test.tsx      (cuando aplica)
└── index.ts                 export { Componente } from './Componente';
```

**Reglas:**

- Una carpeta por componente, con su `index.ts`. Los imports son
  `from '@/shared/components/ui/Button'`, no del archivo.
- **`export function`, no `export default`**, salvo páginas y layouts, donde Next lo exige.
- Un componente por archivo. La excepción son los subcomponentes privados que no se exportan
  (`PillDropdown` en `RequirementHeader.tsx`, `FieldAccordion` en `RequirementStatusCard.tsx`,
  `ChevronIcon`/`EditIcon` en `ClientCard.tsx`).

## `'use client'` y `'use server'`

**Reglas:**

- Server Component es el default. `'use client'` solo cuando hace falta: estado, efectos, event
  handlers, hooks del navegador.
- La directiva va en la **primera línea**, antes de todos los imports.
- Todo archivo en `features/*/hooks/` lleva `'use client'`.
- Todo archivo en `features/*/services/*Api.ts` lleva `'use server'` — excepto los `*ClientApi.ts`,
  que corren en el navegador.
- **Un `*ClientApi.ts` nunca importa `apiClient`.** `auth()` no corre en el cliente.

## Comentarios

El repositorio tiene una práctica clara y vale la pena mantenerla: **los comentarios explican el
por qué, no el qué**, y están en español.

```ts
// Pins the timezone so date assertions do not depend on the machine's. A
// date literal like '2026-08-01' is parsed as midnight UTC, which is the
// previous day west of Greenwich: without this, tests pass locally and fail
// in CI, where the runner is UTC.
env: { TZ: 'UTC' },
```

```ts
// Para incidencias, "En cola" no forma parte del flujo — Planificación transiciona
// directo a Desarrollo.
const NEXT_WORK_STEP_INCIDENCIA = { ... };
```

**Reglas:**

- Comentar la decisión no obvia, el workaround y la restricción externa. No comentar lo que el
  código ya dice.
- Un `@ts-expect-error` lleva la razón en la misma línea:

  ```ts
  // @ts-expect-error -- Node.js fetch supports duplex for streaming request bodies
  duplex: 'half',
  ```

- Un error tragado lleva comentario explicando por qué se traga. Ver
  [`conventions/error-handling.md`](./conventions/error-handling.md).
- Los comentarios nuevos en español; hay código heredado en inglés que no se traduce por traducir.

## `console`

ESLint permite solo `warn` y `error` (`no-console` con `allow: ['warn', 'error']`).

**Nunca loguear** el access token, el payload de sesión ni datos personales. Hay una violación
activa documentada en `authApi.ts:8-15`.

## Formato

Prettier, config en la raíz del monorepo (`.prettierrc`). `npm run format --workspace web` sobre
`src`.

## Accesibilidad

Lo que el código ya hace y conviene sostener:

- `aria-label` en los botones de solo icono: `aria-label="Nueva tarea"`,
  `aria-label={`Eliminar tag ${tag.key}:${tag.value}`}`.
- `aria-pressed` en toggles, `aria-expanded` + `aria-haspopup="listbox"` en dropdowns,
  `aria-current="page"` en navegación y paginación, `aria-current="step"` en el stepper.
- `alt=""` + `aria-hidden="true"` en iconos decorativos. Los iconos con significado llevan `alt`
  real.
- `<Button>` con `loading` emite `aria-busy` y un `<span className="sr-only">Cargando...</span>`.
- `role="dialog"` + `aria-modal="true"` + `Escape` + click en overlay en `PreviewModal`;
  `<ConfirmDialog>` usa `<dialog>` nativo con `showModal()`.
- Mixins `focus-ring` / `focus-ring-light` / `focus-ring-shadow` en `_mixins.scss`, y la clase
  global `.sr-only`.

**Regla:** un control interactivo nuevo necesita nombre accesible. Si es un icono, `aria-label`.

**Sin resolver:** ningún overlay atrapa el foco (`PreviewModal` escucha `Escape` pero no hace focus
trap), y el foco no se devuelve al disparador al cerrar. Detalle por pantalla en el relevamiento UX.

## Checklist para una pantalla nueva

1. ¿Va dentro de `(loggedin)/`? Si es autenticada, **sí** — es el único lugar con guard.
2. Server Component salvo que necesite interactividad.
3. ¿Filtros? A `searchParams`, con defaults en la página de servidor y reset de `page` a 1.
4. `<Suspense>` con `key` derivada de los filtros y un `fallback` con label específico.
5. Datos por hook de TanStack Query sobre una Server Action. Query key `[recurso, filtros]`.
6. Los **tres estados**: `isLoading`, error de query, y vacío. En ese orden.
7. `error.tsx` en la ruta si el render de servidor puede fallar.
8. Un `.module.scss` con tokens y mixins. Sin hex literales, sin `@media` cruda.
9. Nombre accesible en todo control interactivo.
10. Test junto al archivo, nombres en español, consultas por rol.

## Checklist para una mutación nueva

1. Server Action en `services/{recurso}Api.ts` con `'use server'` y retorno tipado.
2. ¿Necesita el BFF? Solo con motivo técnico escrito — ver
   [`conventions/api-routes.md`](./conventions/api-routes.md).
3. Hook `use{Verbo}{Recurso}` que invalide las query keys afectadas en su `onSuccess`.
4. En el componente: `mutate` con `onError` → `toast.error` y `onSuccess` → `toast.success` +
   navegación.
5. `isPending` al `loading`/`disabled` del botón.
6. Si hay update optimista: `onMutate` + `onError` con rollback + `onSuccess`, los tres.
