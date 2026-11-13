# Estándares de desarrollo: opus-web

Lo que el código hace hoy, con la regla derivada cuando hay una consistente. Donde no la hay, se
dice.

## TypeScript

`strict: true`, `noEmit`, target ES2017, `moduleResolution: bundler` (`tsconfig.json`).

**Reglas observadas:**

- **Interfaces para props, `type` para uniones.** `interface ButtonProps` /
  `type RequirementState = 'analisis' | ...`. Sin excepciones en el código actual.
- **Las props se declaran junto al componente**, no en un archivo aparte — salvo cuando el
  componente es grande: `CreateRequirementModal.types.ts` y `RequirementDetailModal.types.ts`
  sacan props y constantes de opciones a su propio archivo.
- **Los tipos de dominio viven en `features/{modulo}/types/{nombre}.types.ts`** y se importan con
  `import type`.
- **`import type` para lo que solo es tipo.** Consistente en todo el código.
- **`as const` para las listas de opciones** (`requirement.constants.ts:9`, `:17`), que es lo que
  da el literal type.

**Los `any` que quedan:** ninguno explícito en `src/`. La regla está en `warn`
(`eslint.config.mjs:13`), no en `error`. Lo que sí hay son cuatro casts con `unknown` de por medio,
todos con el motivo al lado:

| Cast | Dónde | Por qué |
|---|---|---|
| `auth as unknown as () => Promise<Session \| null>` | `middleware.ts:28` | `auth` está sobrecargada en v5: sirve de wrapper y de getter. Se acota al segundo uso |
| `REQUIREMENT_STATE_ITEMS as unknown as {...}[]` | `ListRequirementRow.tsx:179`, `KanbanCard.tsx:173` | El `as const` da un tipo más estrecho que el que pide `Dropdown` |
| `(session as { expiresAt?: number })` | `middleware.ts:18`, `nextauth.config.ts:44` | `expiresAt` no está en el tipo aumentado de `Session` |

El último es evitable: `shared/types/next-auth.d.ts` ya aumenta `Session` y podría declarar
`expiresAt` ahí.

**La augmentación de la sesión** está en `shared/types/next-auth.d.ts` y declara `user.id`,
`user.roles` y `accessToken`. Es lo que permite `session.user.roles.includes('external-user')` sin
cast.

## Nombres

| Qué | Convención | Ejemplo |
|---|---|---|
| Componente | `PascalCase`, archivo igual al componente | `KanbanCard.tsx` → `KanbanCard` |
| Carpeta de componente | `PascalCase`, con `index.ts` que re-exporta | `KanbanCard/index.ts` |
| Hook | `camelCase` con prefijo `use`, un hook por archivo | `useRequirementsByStatus.ts` |
| Servicio | `{dominio}Api.ts`, exporta un objeto con métodos | `requirementsApi.ts` → `requirementsApi.getById()` |
| Tipos | `{dominio}.types.ts` | `requirement.types.ts` |
| Constantes | `{dominio}.constants.ts`, valores en `SCREAMING_SNAKE` | `REQUIREMENT_STATE_ITEMS` |
| Módulo SCSS | `{Componente}.module.scss`, junto al `.tsx` | `KanbanCard.module.scss` |
| Clases CSS | `camelCase` | `styles.pillWrapper` |
| Handlers | `handle{Qué}` | `handleSubmit`, `handleStateSelect` |
| Props de callback | `on{Qué}` | `onClose`, `onRequirementClick` |
| Parámetro sin usar | prefijo `_` | `_projectId`, `_onNewRequirement` |

Las clases en `camelCase` no son estética: CSS Modules las expone como propiedades de un objeto, y
`styles.pillWrapper` es válido mientras `styles.pill-wrapper` no.

El prefijo `_` está configurado en ESLint (`eslint.config.mjs:14`), así que un parámetro sin usar
sin `_` es error.

## Estructura de un módulo

```
features/{modulo}/
├── components/{Componente}/
│   ├── {Componente}.tsx
│   ├── {Componente}.module.scss
│   ├── {Componente}.types.ts      ← solo si es grande
│   ├── {Componente}.test.tsx      ← a veces
│   └── index.ts
├── hooks/use{Algo}.ts
├── services/{modulo}Api.ts
├── types/{modulo}.types.ts
├── constants/{modulo}.constants.ts
└── index.ts                        ← barrel: la superficie pública
```

Los subcomponentes que solo usa un componente anidan bajo él:
`RequirementDetailModal/components/ActivityPanel/`. Es lo que hace `KanbanBoard/components/KanbanCard/`
y `ListView/components/RequirementGroupRow/`.

**Regla:** una ruta importa del barrel del módulo (`@/features/requirements`), no de una ruta
profunda. El código lo cumple casi siempre; las excepciones son imports entre features
(`@/features/subscriptions/hooks/useSubscribe` desde `requirements`), donde se va directo al
archivo.

## Imports

Orden observado, consistente:

```tsx
'use client';                                        // 1. directiva

import { useState } from 'react';                    // 2. react
import { useRouter } from 'next/navigation';         // 3. next
import { Calendar } from 'lucide-react';             // 4. externos
import { Dropdown } from '@/shared/components/ui';   // 5. internos con @/
import { useUpdateRequirement } from '../../hooks';  // 6. relativos
import type { Requirement } from '../../types/...';  // 7. tipos
import styles from './Componente.module.scss';       // 8. estilos, siempre último
```

El alias `@/` apunta a `src/` (`tsconfig.json:28-32`, replicado en `vitest.config.mts:32-34`).

**El módulo SCSS va siempre último.** No hay excepción en el código.

## `'use client'` y `'use server'`

Casi todo es cliente. Lo que corre en el servidor es explícito y poco:

| Archivo | Directiva | Qué hace |
|---|---|---|
| `app/page.tsx` | ninguna (server component) | `auth()` y redirect |
| `app/(auth)/login/enter/page.tsx` | ninguna | `presentInApi()` y redirect |
| `app/(auth)/layout.tsx` | ninguna | solo un `<div>` |
| `app/layout.tsx` | ninguna | fuente, metadata, `<Providers>` |
| `features/auth/services/authApi.ts` | `'use server'` | El único con esta directiva |
| Todo lo demás con estado o hooks | `'use client'` | — |

**Regla:** un componente lleva `'use client'` solo si usa hooks, estado o eventos. Los que son
puramente presentacionales no la llevan aunque los renderice un cliente — `Button`, `Badge`,
`Card`, `Spinner`, `ProjectCard`, `RequirementCard`, `StateAccordion`, `KanbanBoard`,
`MobileRequirementsBoard` y `RequirementGroupRow` no la tienen.

## Comentarios

El estándar del repositorio, visible en todo el código: **el comentario explica el porqué, no el
qué.** Los mejores del servicio son párrafos que documentan una decisión y su consecuencia:

```ts
// src/lib/axios.ts:43-47
// Cliente para uso en el navegador.
//
// Apunta al MISMO ORIGEN, no a la api: `/api/opus/...` lo atiende un route handler de este
// front, que reenvía agregando el token. Así el bundle no necesita saber dónde está la api
// —no habría forma de decírselo en runtime— y el access token no sale del servidor.
```

```ts
// src/app/api/opus/[...path]/route.ts:51-53
// Como ArrayBuffer y no como texto: una subida multipart es binaria y `text()` la
// corrompería. `duplex` es obligatorio en fetch de Node cuando hay cuerpo.
```

**Reglas derivadas:**

- Un comentario que explica una decisión no obvia, va. Uno que repite el nombre de la función, no.
- Los comentarios están **en español**, igual que el resto del código nuevo del repositorio.
- Cuando algo se hace de una forma rara por una limitación externa (la sobrecarga de `auth` en v5,
  `duplex: 'half'` en el fetch de Node, `generateScopedName` en Vitest), el comentario nombra la
  limitación.
- Los comentarios de sección tipo `{/* Header */}` o `// ── Loading ── ` se usan para orientar
  dentro de un JSX largo. Aceptable en componentes grandes; innecesario en los chicos.

## Accesibilidad

Lo que el código **sí** hace, consistente:

- `aria-label` en todo botón de solo icono: `aria-label="Cerrar"`, `aria-label="Adjuntar archivo
  al comentario"`, `aria-label="Copiar enlace del requisito"`.
- `role="dialog"` + `aria-modal="true"` en los tres overlays (`Modal`, `MobileMenu`,
  `CreateRequirementModal`).
- `aria-expanded` en los disparadores de dropdown y acordeón.
- `role="alert"` en los mensajes de error (`CommentInput.tsx:139`,
  `RequirementDetailModal.tsx:53`).
- `role="status"` + texto oculto en el `Spinner` (`Spinner.tsx:9-11`).
- `aria-hidden="true"` en los SVG decorativos.
- `Escape` cierra los tres overlays.

Lo que **no** hace, y hay que tenerlo presente al escribir código nuevo:

- **Elementos clickeables que no son botones.** `<div onClick>` sin `role`, `tabIndex` ni handler
  de teclado en `Sidebar.tsx:71-75` (los proyectos), `ListRequirementRow.tsx:143` (las filas) y
  las opciones de los dropdowns inline de `CreateRequirementModal` (`:584`, `:602`, `:631`).
  Compará con `ProjectCard.tsx:22-28` y `RequirementCard.tsx:46-53`, que sí lo hacen bien —
  `role="button"`, `tabIndex={0}`, `onKeyDown` con Enter y Space. Ese es el patrón a copiar.
- **Ningún modal atrapa el foco** ni lo devuelve al cerrar. `MobileMenu` es el único que enfoca
  algo al abrir (`MobileMenu.tsx:32-36`).
- **`ListView` es una tabla hecha con `<div>` y `display: grid`**, sin roles ARIA de tabla.
- **`<html lang="en">`** (`layout.tsx:23`) en una interfaz enteramente en español.

## Formato

Prettier + ESLint, con la config base del monorepo (`eslint.config.base.js`) más
`eslint-config-next` y `eslint-plugin-prettier` (`eslint.config.mjs`).

```sh
npm run lint --workspace opus-web
npm run lint:fix --workspace opus-web
npm run format --workspace opus-web
```

Dos reglas bajadas a `warn` a propósito:

```js
// eslint.config.mjs:13-21
'@typescript-eslint/no-explicit-any': 'warn',
'no-console': ['warn', { allow: ['warn', 'error'] }],
// Regla nueva del plugin de React 19. Marca dos efectos que hoy funcionan
// (RichTextEditor y CreateRequirementModal) y arreglarlos bien es un cambio de
// comportamiento, no de estilo. Queda como warning para no bloquear el CI, y
// anotado en documentation/known-limitations.md.
'react-hooks/set-state-in-effect': 'warn',
```

`console.log` está prohibido; `console.warn` y `console.error` permitidos. El código los usa donde
traga un error a propósito (`authApi.ts:10`, `:29`).

## Checklist para código nuevo

**Componente:**
1. ¿Va en `features/{modulo}/components/` o en `shared/components/ui/`? Si lo usa un solo módulo,
   en el módulo.
2. Carpeta `PascalCase` con `.tsx`, `.module.scss` e `index.ts`.
3. `'use client'` solo si usa hooks, estado o eventos.
4. Props como `interface` junto al componente.
5. Si es clickeable y no es un `<button>`: `role`, `tabIndex` y `onKeyDown`. Copiar
   `ProjectCard.tsx:22-28`.
6. Botón de solo icono: `aria-label`.
7. Exportarlo desde el barrel del módulo si lo va a usar otro.

**Datos:**
1. Servicio en `services/{modulo}Api.ts` usando `apiClient` (navegador, mismo origen).
2. Hook en `hooks/use{Algo}.ts` con `useQuery` o `useMutation`.
3. Query key jerárquica: `['requirements', projectId, 'byStatus', status]`.
4. Mutación: invalidar explícitamente lo que quedó viejo.
5. Antes de agregar un método: revisar que no exista ya. Hay tres pares duplicados hoy.

**Estilos:**
1. Módulo SCSS junto al componente, clases en `camelCase`.
2. `@use '@/styles/mixins' as *;` arriba si necesita mixins.
3. Tokens (`var(--color-...)`), no hex literales.
4. Responsive con `@include mobile`, no `@media` cruda.

**Antes de abrir el PR:**
```sh
npm run lint --workspace opus-web
npm test --workspace opus-web
npm run build --workspace opus-web
```
