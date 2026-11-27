# web

The internal frontend of Jiku, for the team (`admin`, `user`): projects, requirements, tasks, worked
and unworked hours with their reports, attachments and the optional docs module. A Next.js app that
signs in against the identity provider and calls the api from the server; it is served at port 3000.
Its place in the product is in `_jflow/prd/architecture/services.md`.

Code, comments, identifiers and test names are in English; the texts and error messages the service
shows its users are in the product language (`language` in `_jflow/project.yaml`; see the root
`AGENTS.md`).

## Stack

| Concern | Choice | Version | Why |
|---|---|---|---|
| Language and runtime | TypeScript on Node | TS 5.9.3, Node 24 (`node:24.12-alpine3.23`) | — |
| UI framework | Next.js App Router, `output: 'standalone'`; React | 16.1.1; 19.2 | One api for both frontends (DEC-T09) |
| Authentication | next-auth (Auth.js v5) as a server-side OIDC client of Zitadel (code + PKCE), JWT session cookie | 5.0.0-beta.32 | Meant to keep the token on the server, but today it reaches the browser through the session (#630); identity provider DEC-T10 |
| Data fetching | TanStack Query in the browser → `'use server'` functions in `features/*/services/` → server-only axios client (`src/lib/axios.ts`) | 5.90; axios 1.13 | DEC-T33, DEC-T22 (no `NEXT_PUBLIC_*`) |
| Forms and validation | yup | 1.7 | — |
| Styles | Sass with CSS Modules, own components in `src/shared/components/ui`, no UI library | 1.97 | DEC-T32 |
| Unit tests | vitest + jsdom + Testing Library | 4.0 | — |
| End-to-end tests | Playwright, in its official Docker image `mcr.microsoft.com/playwright:v1.65.1-noble` | 1.65.1 | Runs with only Docker, against `make up` |
| Lint | ESLint 9 flat config + `eslint-config-next` | 9; 16.1.1 | — |
| Logging | `console.*` only | — | No OpenTelemetry yet (see `docs/operacion.md`) |

Chosen from the official documentation current when the service was created. Before adding or
upgrading a dependency, check the official documentation for the stable version and its recommended
practices.

## Commands

| Command | Runs |
|---|---|
| `make test S=web` | `test-unit`, `test-integration` (no such level: prints a note), `test-e2e` |
| `make test-unit S=web` | `vitest run`, JUnit to `reports/junit/web-unit.xml` |
| `make test-e2e S=web` | `npx playwright test` in the Playwright image on the host network, against `make up` (`BASE_URL`, default `http://localhost:3000`; the fake-idp at `idp.localhost:9400`); JUnit to `reports/junit/web-e2e.xml`, traces in `reports/playwright/web` |
| `make lint S=web` | `npm run lint` (`eslint src/`) |
| `make typecheck S=web` | `tsc --noEmit -p tsconfig.typecheck.json` |
| `make migrate` | n/a |

## Structure

- `src/app/` App Router: `(loggedin)/` the authenticated screens (its `layout.tsx` guards the session
  and keeps `external-user` out), `login/`, `api/` route handlers only where a Server Action cannot
  work (302 propagation of downloads and previews, `keepalive` unlock).
- `src/proxy.ts` the Next 16 proxy (ex-middleware): session gate.
- `src/features/{area}/` `components/`, `hooks/` (TanStack Query), `services/` (`'use server'` calls
  to the api), `types/`, `utils/`.
- `src/lib/` `auth.ts` (Auth.js config), `axios.ts` (server api client); `src/shared/` design-system
  components and utilities; `src/styles/` SCSS tokens.
- Tests are colocated (`*.test.ts(x)` next to the code) plus `tests/`; `e2e/` the Playwright tests.

## Canonical examples

The best example of each kind of code: copy its shape when writing a new one.

| Kind | File |
|---|---|
| Server Action calling the api | `src/features/worked-times/services/workedTimesApi.ts` |
| Mutation hook (TanStack Query) | `src/features/worked-times/hooks/useCreateWorkedTime.ts` |
| Route handler that forwards the api's 302 (download/preview) | `src/app/api/attachments/[id]/preview/route.ts` |
| Unit test of a route handler | `src/app/api/attachments/[id]/preview/route.test.ts` |
| Unit test of a hook | `src/features/attachments/hooks/useAttachmentPermission.test.tsx` |
| End-to-end test | `e2e/login.e2e.ts` |

## Recurring errors

One line per mistake that showed up twice (in verification, in CI or in review).

- `make typecheck` must pass on a clean checkout: anything only a Next build generates (`next-env.d.ts`, `.next/types`) is absent in CI, so declarations the code needs are versioned in `src/types/`.
