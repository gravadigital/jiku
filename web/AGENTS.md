# web

"Gestión interna": the internal frontend for admins and team members (clients, projects,
requirements, tasks, worked hours, weekly allocation, reports and the optional documentation
module). A Next.js App Router app; the browser never calls the api directly — it calls Server
Actions and Next route handlers, which forward to the api with the session's access token. Its
place in the product is in `_gflow/prd/architecture/services.md`.

## Stack

| Concern | Choice | Version | Why |
|---|---|---|---|
| Language and runtime | TypeScript (`strict`) on Node.js | TypeScript 5.9.3; Node 24 (`node:24.12-alpine3.23`) | Shared with the rest of the monorepo |
| UI framework | Next.js (App Router, `output: 'standalone'`) + React | next 16.1.1; react ^19.2.3 | — |
| Auth | next-auth v5 with the Zitadel provider (PKCE) | 5.0.0-beta.32 | Jiku does not manage users |
| Data | @tanstack/react-query (client hooks) calling Server Actions (`'use server'`), which call the api with axios | ^5.90.12 / axios ^1.13.2 | — |
| Forms and validation | react-hook-form + @hookform/resolvers + yup | ^7.69.0 / ^5.2.2 / ^1.7.1 | — |
| Styles and UI | Own design system in `src/shared/components/ui/`, SCSS modules (sass), react-select, react-datepicker, react-toastify, react-markdown | sass ^1.97.1 | — |
| Tests | Vitest + jsdom + Testing Library (react, user-event, jest-dom) | vitest ^4.0.18 | No e2e yet |
| Lint and format | ESLint 9 (`eslint-config-next` 16.1.1) + Prettier from the root | — | — |
| Logging | `console.warn`/`console.error` on the server | — | No OpenTelemetry yet |

Chosen before the service adopted grava-workflow. Before adding or upgrading a dependency, check the
official documentation for the stable version and its recommended practices.

## Commands

Today these are the workspace's npm scripts (run from the root with `-w @jiku/web`, or inside
`web/`). The alignment requirement adds the `make` targets (`make test S=web`, `make lint S=web`,
`make typecheck S=web`, `make test-e2e`).

| Command | Runs |
|---|---|
| `npm test -w @jiku/web` | `vitest run` |
| `npm run test:watch -w @jiku/web` | `vitest` in watch mode |
| `npm run lint -w @jiku/web` | `eslint src/` |
| `npm run format:check -w @jiku/web` | `prettier --check src` |
| `npm run build -w @jiku/web` | `next build` (also the type check; the root `npm run build` does not build this workspace) |
| `npm run dev -w @jiku/web` | `next dev` on port 3000; needs the api (`API_URL`) |
| Migrations | n/a |

## Structure

- `src/app/` — routes (App Router): `(loggedin)/` for the authenticated shell, `login/`, `unauthorized/`, and the route handlers in `api/` and `docs/attachments/`.
- `src/proxy.ts` — the Next 16 middleware (session guard); `src/lib/` — NextAuth (`auth.ts`), the server-side axios client, the query client.
- `src/features/{domain}/` — `components/`, `hooks/` (React Query), `services/` (Server Actions, `'use server'`), `types/`, `utils/`.
- `src/shared/components/ui/` — the design system; `src/styles/` — SCSS tokens and mixins.
- Tests sit next to the code as `*.test.ts(x)`; global setup in `tests/setup.ts`; guard tests that read the source (`src/features/*.guard.test.ts`).

## Canonical examples

The best example of each kind of code: copy its shape when writing a new one.

| Kind | File |
|---|---|
| Component with its test | `web/src/features/worked-times/components/DayEntriesList/DayEntriesList.tsx` and `DayEntriesList.test.tsx` |
| Design-system primitive with its test | `web/src/shared/components/ui/Button/Button.tsx` and `Button.test.tsx` |
| Server Action service calling the api | `web/src/features/worked-times/services/workedTimesApi.ts` |
| React Query mutation hook | `web/src/features/worked-times/hooks/useCreateWorkedTime.ts` |
| Route handler forwarding to the api, with its test | `web/src/app/api/attachments/[id]/download/route.ts` and `route.test.ts` |
| Page test (Server Component with `auth` mocked) | `web/src/app/(loggedin)/worked-times/page.test.tsx` |
| Static guard test over the source | `web/src/features/design-system-migration.guard.test.ts` |

## Recurring errors

One line per mistake that showed up twice (in verification, in CI or in review).

- (none yet)
