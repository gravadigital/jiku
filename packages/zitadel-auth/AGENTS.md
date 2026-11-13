# zitadel-auth

`@jiku/zitadel-auth`: obtains and renews the access token (JWT) of a Zitadel **service user**
with the JWT-profile flow, so `api` and `core` can connect to NATS through the auth-callout. It
does **not** validate end-user tokens (the api does that) and reads no roles. Exposes
`ZitadelServiceUser` (`token()`, `currentToken()`, `startAutoRefresh()`, `userId`),
`serviceUserKeyFromEnv()` and `serviceUserFromEnv()`. Its place in the product is in
`_gflow/prd/architecture/services.md`.

## Stack

| Concern | Choice | Version | Why |
|---|---|---|---|
| Language | TypeScript (commonjs), a single source file `src/index.ts`, no dependencies (`crypto`, `fs` and Node's global `fetch`) | ^5.9.3 | — |
| Configuration | `ZITADEL_SERVICE_USER_KEY_B64` or `ZITADEL_SERVICE_USER_KEY`, `ZITADEL_ISSUER_URL` (falls back to `IDENTITY_ISSUER`), `ZITADEL_PROJECT_ID` | — | Without a key or an issuer it returns `null`: the mock-IdP mode |
| Tests | None yet | — | — |
| Lint | ESLint 9 + typescript-eslint (root `eslint.config.base.js`) | ^9.39.2 | — |

Chosen before the package adopted grava-workflow. Before adding or upgrading a dependency, check the
official documentation for the stable version and its recommended practices.

## Commands

Today these are the workspace's npm scripts (run from the root with `-w @jiku/zitadel-auth`). The
alignment requirement adds the `make` targets (`make lint S=zitadel-auth`,
`make typecheck S=zitadel-auth`).

| Command | Runs |
|---|---|
| `npm run build -w @jiku/zitadel-auth` | `tsc` → `dist/` (also the type check; `npm install` runs it through `postinstall`) |
| `npm run lint -w @jiku/zitadel-auth` | `eslint ./src` |
| Tests | n/a: no test script yet |
| Migrations | n/a |

## Structure

- `src/index.ts` — the whole package.
- Consumers: `api/lib/utils/bus/index.ts`, `core/src/bus/host.ts`, `core/tests/tools/bus-policy-probe.ts`.

## Canonical examples

The best example of each kind of code: copy its shape when writing a new one.

| Kind | File |
|---|---|
| Service-user token with cache, de-duplicated refresh and auto-refresh | `packages/zitadel-auth/src/index.ts` |
| Use from a service (connect to NATS with the token authenticator) | `core/src/bus/host.ts` |

## Recurring errors

One line per mistake that showed up twice (in verification, in CI or in review).

- (none yet)
