---
id: _base
display_name: Convenciones generales
language: nextjs
description: Base conventions for any Next.js app (always active)
applies_to: [frontend]
required_by: []
package: next
---

# Base Conventions (Next.js)

Always included when the service uses Next.js. Defines what does not vary across pages, features, or domains: App Router, TypeScript, project layout, Server vs Client Component policy.

## App Router as the default

- The app uses the **App Router** (`src/app/`). The Pages Router is not used in new code.
- File-system routing under `src/app/`: each folder is a route segment, `page.tsx` renders, `layout.tsx` wraps, `loading.tsx` shows fallback, `error.tsx` catches uncaught errors.
- Dynamic segments use bracket folders (`[id]`, `[...slug]`).
- Route groups (parenthesis folders, e.g., `(marketing)`) are used to organize without affecting the URL.

## TypeScript

- TypeScript is mandatory.
- `tsconfig.json` with `strict: true`. No exceptions per app.
- `noUncheckedIndexedAccess: true` enabled.
- `target: ES2022` or higher.
- No `any` except in boundaries with untyped libraries.
- Path aliases configured: `@/*` resolves to `src/*` (configured in `tsconfig.json` and verified by linter/build).

## Server Components by default

- **Default to Server Components.** Only add `'use client'` when the component needs `useState`, `useEffect`, event handlers, browser-only APIs (`window`, `localStorage`), or React context that is not server-safe.
- `'use client'` is a leaf decision: mark the smallest component that needs it, not the parent.
- Server Components can fetch data directly (`await fetch(...)`, DB calls), can be async, cannot use state or browser APIs, and do not ship JavaScript to the client.

## Project structure

```
{service}/
├── src/
│   ├── app/                       # App Router (routes, layouts, pages, error/loading boundaries)
│   │   ├── (group)/               # route group (does not affect URL)
│   │   ├── [param]/               # dynamic segment
│   │   ├── layout.tsx             # root layout
│   │   ├── page.tsx               # root page
│   │   ├── error.tsx              # root error boundary
│   │   ├── not-found.tsx          # 404 page
│   │   └── loading.tsx            # root loading state
│   ├── actions/                   # Server Actions (one file per domain)
│   ├── components/                # Reusable UI components (Server and Client)
│   │   └── ui/                    # Design system primitives (Button, Input, etc.)
│   ├── lib/                       # Utilities, helpers, third-party clients
│   │   └── utils.ts               # cn() and small helpers
│   ├── hooks/                     # Client-only custom hooks
│   └── types/                     # Shared TypeScript types
├── public/                        # Static assets served as-is
├── next.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

- **`src/app/`**: routes only. Components used **only** by one route may live colocated, but **shared** components go in `src/components/`.
- **`src/actions/`**: each file exports one or more Server Actions for a domain (`user-actions.ts`, `order-actions.ts`). The file starts with `'use server'`.
- **`src/components/`**: organized by purpose. UI primitives in `ui/`, feature components by domain folder.
- **`src/lib/`**: clients to external services (DB, API), pure utilities, configuration loaders. No JSX.
- **`src/hooks/`**: custom hooks that require `'use client'`. Hooks for pure logic go in `lib/`.

## Naming

| Element | Convention | Example |
|---|---|---|
| Files (general) | `kebab-case` | `user-profile.tsx`, `format-currency.ts` |
| Components (exported) | `PascalCase` | `export function UserProfile()` |
| Folders | `kebab-case` | `user-profile/`, `marketing-pages/` |
| Hooks | `use-*` file, `useX` export | `use-debounce.ts` → `useDebounce` |
| Server Actions | descriptive verb | `createUser`, `updateProfile` |
| Types / interfaces | `PascalCase`, no `I` prefix | `User`, `CreateUserInput` |
| Constants | `SCREAMING_SNAKE_CASE` | `MAX_UPLOAD_SIZE` |

App Router special files keep their lowercase names (`page.tsx`, `layout.tsx`, `error.tsx`, `loading.tsx`, `not-found.tsx`, `route.ts`).

## Imports

- Absolute imports via `@/*` aliases. No `../../../`.
- Order within a file:
  1. External libraries (`react`, `next/*`, npm packages)
  2. Absolute imports from this project (`@/components`, `@/lib`, `@/actions`)
  3. Relative imports from the same module (`./helpers`)
- Separate groups with a blank line.

## Environment variables

- All env vars are loaded and validated in **one place** (`src/lib/env.ts`).
- Validation at module load (fail fast at build/start).
- **Server-only** vars: any name. **Client-exposed** vars: must be prefixed `NEXT_PUBLIC_`. Never expose secrets via `NEXT_PUBLIC_`.
- The rest of the code consumes the typed `env` object, not `process.env`.

## Dates

- At all **system boundaries** (HTTP, DB, Server Action arguments/returns, logs) dates are **ISO 8601 UTC**.
- In React rendering, format dates with `Intl.DateTimeFormat` or `date-fns`/`dayjs`. Never assume the server timezone equals the user's timezone.

## Async / Promises

- `async/await` over `.then()`.
- Server Components can be async: `export default async function Page() { ... }`.
- Client Components cannot be async at the top level; data fetching from the client uses Suspense + hooks or libraries (see `data-fetching`).
- Unhandled promise rejections are an error.

## Comments

- Default: no comments. Clear names explain the code.
- Comment **only the why** when not obvious (workaround, external constraint, surprising decision).
- No `// TODO` without an associated issue.
