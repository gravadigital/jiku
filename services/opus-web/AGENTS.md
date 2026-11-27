# opus-web

The client portal of Jiku, for `external-user`: a client follows the requirements of the projects it
has access to, creates them, comments and subscribes, and reads the public documentation. A Next.js
app that signs in against the identity provider and reaches the api through its own server (BFF
proxy `/api/opus/*`); it is served at port 3000 (published at 3001 locally). Its place in the product is
in `_jflow/prd/architecture/services.md`.

Code, comments, identifiers and test names are in English; the texts and error messages the service
shows its users are in the product language (`language` in `_jflow/project.yaml`; see the root
`AGENTS.md`).

## Stack

| Concern | Choice | Version | Why |
|---|---|---|---|
| Language and runtime | TypeScript on Node | TS 5.9.3, Node 24 (`node:24.12-alpine3.23`) | — |
| UI framework | Next.js App Router, `output: 'standalone'`; React | 16.1.1; 19 | A separate frontend on the same api (ADR-006) |
| Authentication | next-auth (Auth.js v5) as an OIDC public client of Zitadel (code + PKCE), JWT session cookie | 5.0.0-beta.32 | Token kept on the server (ADR-009); identity provider ADR-007 |
| Data fetching | TanStack Query → same-origin `/api/opus/*` catch-all route handler that adds the bearer and forwards to the api | 5.90; axios 1.13 | ADR-011, ADR-009 |
| Markdown, dates, icons | react-markdown, date-fns, lucide-react | 10.1, 4.1, 0.563 | — |
| Styles | Sass with CSS Modules, own components, no UI library | 1.97 | ADR-010 |
| Unit tests | vitest + jsdom + Testing Library | 4.0 | — |
| End-to-end tests | Playwright, in its official Docker image `mcr.microsoft.com/playwright:v1.65.1-noble` | 1.65.1 | Runs with only Docker, against `make up` |
| Lint | ESLint 9 flat config + `eslint-config-next` + prettier | 9; 16.1.1 | — |
| Logging | `console.*` only | — | No OpenTelemetry yet (see `docs/operacion.md`) |

Chosen from the official documentation current when the service was created. Before adding or
upgrading a dependency, check the official documentation for the stable version and its recommended
practices.

## Commands

| Command | Runs |
|---|---|
| `make test S=opus-web` | `test-unit`, `test-integration` (no such level: prints a note), `test-e2e` |
| `make test-unit S=opus-web` | `vitest run`, JUnit to `reports/junit/opus-web-unit.xml` |
| `make test-e2e S=opus-web` | `npx playwright test` in the Playwright image on the host network, against `make up` (portal at `http://localhost:3001`, the fake-idp at `idp.localhost:9400`); JUnit to `reports/junit/opus-web-e2e.xml` |
| `make lint S=opus-web` | `npm run lint` (`eslint src __tests__`) |
| `make typecheck S=opus-web` | `tsc --noEmit -p .` |
| `make migrate` | n/a |

## Structure

- `src/app/` App Router: `(auth)/login`, `(dashboard)/projects/...` (board, requirement detail,
  document view), `api/auth/[...nextauth]`, `api/opus/[...path]` (the BFF proxy), and the
  302-propagating download proxies (`api/attachments`, `api/files`, `api/docs`).
- `src/middleware.ts` the session guard for every page.
- `src/features/{area}/` (`auth`, `projects`, `requirements`, `comments`, `subscriptions`,
  `attachments`, `docs`): `components/`, `hooks/`, `services/`, `types/`, `utils/`.
- `src/lib/axios.ts` the browser and server api clients; `src/shared/` UI components and hooks.
- Tests in `__tests__/` and colocated `src/**/*.test.ts(x)`; `__mocks__/react-markdown.tsx` replaces
  the markdown library in tests; `e2e/` the Playwright tests.

## Canonical examples

The best example of each kind of code: copy its shape when writing a new one.

| Kind | File |
|---|---|
| BFF proxy route handler (session → bearer → api) | `src/app/api/opus/[...path]/route.ts` |
| Its test | `__tests__/app/api/opus/proxy.route.test.ts` |
| Query hook and its test | `src/features/requirements/hooks/useRequirement.ts`, `useRequirement.test.tsx` |
| Mapping api errors to what the user sees | `src/features/requirements/utils/classifyRequirementError.ts` |
| Session guard and its test | `src/middleware.ts`, `src/middleware.test.ts` |
| End-to-end test | `e2e/portal.e2e.ts` |

## Recurring errors

One line per mistake that showed up twice (in verification, in CI or in review).

- `make typecheck` must pass on a clean checkout: anything only a Next build generates (`next-env.d.ts`, `.next/types`) is absent in CI, so declarations the code needs are versioned in `src/types/`.
