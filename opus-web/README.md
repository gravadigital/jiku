# opus-web

The client portal: what a client sees. Next.js, in Spanish.

Clients browse the projects they were granted access to, create requirements, comment and
subscribe to follow progress. They never see hours, internal comments or other clients'
projects.

It consumes `/api/opus/*` with the `external-user` role — see
[docs/api-reference.md](../docs/api-reference.md#client-portal-endpoints).

## Running it

From the repository root, `npm install` covers this project — it is a workspace of the
monorepo, so do not install separately.

```sh
npm run dev  --workspace opus-web    # http://localhost:3000
npm test     --workspace opus-web    # vitest
npm run lint --workspace opus-web
```

**It needs the API running.** `API_URL` is read on the server, so it only has to be reachable
from this container: the browser calls this portal and a route handler forwards the request.

To bring up the whole stack, see [docs/installation.md](../docs/installation.md).

## Authentication

NextAuth v5 against the configured OIDC provider, with an application of type _User Agent /
PKCE_ declaring its redirect URI (`http://localhost:3001/api/auth/callback/zitadel` in
development).

Access is restricted per project through `user_project_permission`: a client user only sees
what they were explicitly granted.

> Both frontends run NextAuth v5. This one keeps the v4 variable names (`NEXTAUTH_*`), which v5
> still reads, while `web` uses the v5 ones (`AUTH_*`). See
> [docs/known-limitations.md](../docs/known-limitations.md).

## Layout

```
src/
  app/         routes (App Router)
  features/    requirements, projects, subscriptions, auth, comments, attachments
  shared/      components, utils and types used across features
  middleware.ts
```

Tests are split between `__tests__/` and files next to the code — a convention worth unifying.
Both run under vitest, same as `web`.

## Configuration

| Variable                                                    | Notes                                                        |
| ----------------------------------------------------------- | ------------------------------------------------------------ |
| `API_URL`                                                   | where the API is, as seen from this process. Read at runtime |
| `NEXTAUTH_URL`, `NEXTAUTH_SECRET`                           | NextAuth. The v4 names, still honoured by v5                 |
| `ZITADEL_ISSUER`, `ZITADEL_CLIENT_ID`, `ZITADEL_PROJECT_ID` | the OIDC application                                         |

Full reference in [docs/configuration.md](../docs/configuration.md).
