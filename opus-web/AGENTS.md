# opus-web

"Portal de clientes": the client portal where external users follow and request work on their
projects — requirement board, detail, creation, comments, subscriptions, attachments and the public
documents of the optional documentation module. A Next.js App Router app whose own route handler
`/api/opus/[...path]` proxies to the api with the session's token. Its place in the product is in
`_gflow/prd/architecture/services.md`.

## Stack

| Concern | Choice | Version | Why |
|---|---|---|---|
| Language and runtime | TypeScript on Node.js | TypeScript ^5; Node 24 (`node:24.12-alpine3.23`) | Shared with the rest of the monorepo |
| UI framework | Next.js (App Router, `output: 'standalone'`) + React | next 16.1.1; react ^19 | — |
| Auth | next-auth v5 with the Zitadel provider (PKCE) | 5.0.0-beta.32 | Jiku does not manage users |
| Data | @tanstack/react-query + axios against the own proxy | ^5.90.16 / ^1.13.2 | — |
| UI | SCSS modules (sass), lucide-react, react-markdown, date-fns (locale `es`) | sass ^1.97.2; date-fns ^4.1.0 | — |
| Tests | Vitest + jsdom + Testing Library | vitest ^4.0.18 | No e2e yet |
| Lint and format | ESLint 9 (`eslint-config-next` 16.1.1) + Prettier | prettier ^3.7.4 | — |
| Logging | `console.warn` on the server | — | No OpenTelemetry yet |

Chosen before the service adopted grava-workflow. Before adding or upgrading a dependency, check the
official documentation for the stable version and its recommended practices.

## Commands

Today these are the workspace's npm scripts (run from the root with `-w @jiku/opus-web`, or inside
`opus-web/`). The alignment requirement adds the `make` targets (`make test S=opus-web`,
`make lint S=opus-web`, `make typecheck S=opus-web`, `make test-e2e`).

| Command | Runs |
|---|---|
| `npm test -w @jiku/opus-web` | `vitest run` |
| `npm run test:cov -w @jiku/opus-web` | `vitest run --coverage` |
| `npm run lint -w @jiku/opus-web` | `eslint src __tests__` (`lint:fix` fixes) |
| `npm run format:check -w @jiku/opus-web` | Prettier over `src/**/*.{ts,tsx,scss}` |
| `npm run build -w @jiku/opus-web` | `next build` (also the type check; the root `npm run build` does not build this workspace) |
| `npm run dev -w @jiku/opus-web` | `next dev` on port 3000 (3001 in the local Compose); needs the api (`API_URL`) |
| Migrations | n/a |

## Structure

- `src/app/` — routes: `(auth)/`, `(dashboard)/`, and the BFF route handlers in `api/` (the proxy `api/opus/[...path]/route.ts`).
- `src/middleware.ts` — session guard and redirects.
- `src/features/{domain}/` — `attachments`, `auth`, `comments`, `docs`, `projects`, `requirements`, `subscriptions`, each with `components/`, `hooks/`, `services/`, `types/`.
- `src/shared/` — UI and layout components, hooks, types; `src/styles/`.
- Tests live in two places: next to the code (`src/**/*.test.ts(x)`) and in `__tests__/` mirroring `src/`; setup in `tests/setup.ts`.

## Canonical examples

The best example of each kind of code: copy its shape when writing a new one.

| Kind | File |
|---|---|
| Component with its test | `opus-web/src/features/requirements/components/CreateRequirementModal/CreateRequirementModal.tsx` and `CreateRequirementModal.test.tsx` |
| Data hook with its test | `opus-web/src/features/requirements/hooks/useRequirement.ts` and `useRequirement.test.tsx` |
| Service calling the proxy | `opus-web/src/features/requirements/services/requirementsApi.ts` |
| BFF proxy route handler, with its test | `opus-web/src/app/api/opus/[...path]/route.ts` and `opus-web/__tests__/app/api/opus/proxy.route.test.ts` |
| Middleware test | `opus-web/src/middleware.test.ts` |
| Auth configuration test | `opus-web/src/features/auth/config/nextauth.config.test.ts` |

## Recurring errors

One line per mistake that showed up twice (in verification, in CI or in review).

- (none yet)
