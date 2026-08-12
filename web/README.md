# web

The internal frontend: what the team uses. Next.js, in Spanish.

Covers actors, projects, requirements, tasks, time allocation, worked hours and reports. What
each of those means is in [documentation/features.md](../documentation/features.md).

## Running it

From the repository root, `npm install` covers this project — it is a workspace of the
monorepo, so do not install separately.

```sh
npm run dev  --workspace web    # http://localhost:3000
npm test     --workspace web    # vitest
npm run lint --workspace web
```

**It needs the API running.** Point `API_URL` at it. It is read on the server at runtime, so it
only has to be reachable from this process — the browser calls this frontend, which forwards.

To bring up the whole stack instead, see [documentation/installation.md](../documentation/installation.md).

## Authentication

NextAuth v5 against the configured OIDC provider. Logging in requires an application of type
_User Agent / PKCE_ declaring the exact redirect URI
(`http://localhost:3000/api/auth/callback/zitadel` in development).

Roles arrive as a claim on the token: `admin`, `user`, `external-user`. An `external-user`
reaching this frontend sees a reduced navigation, but the portal they are meant to use is
[opus-web](../opus-web).

> A person who authenticates but is not in the `users` table gets a 401 from the API. Jiku
> does not create users — see [documentation/known-limitations.md](../documentation/known-limitations.md).

## Layout

```
src/
  app/         routes (App Router), grouped under (loggedin)
  features/    one folder per domain area: components, hooks, services, types
  shared/      components, utils and types used across features
  styles/      SCSS variables and mixins
```

Tests live next to the code they cover, as `*.test.tsx`.

## Configuration

| Variable                                                    | Notes                                                                                                     |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `API_URL`                                                   | where the API is, as seen from this process. Read at runtime                                              |
| `AUTH_URL`, `AUTH_SECRET`                                   | NextAuth v5. Generate the secret with `openssl rand -base64 32`.                                          |
| `ZITADEL_ISSUER`, `ZITADEL_CLIENT_ID`, `ZITADEL_PROJECT_ID` | the OIDC application                                                                                      |
| `APP_NAME`, `APP_DESCRIPTION`                               | application name and meta description                                                                     |
| `EXTERNAL_LINKS`                                            | optional JSON with shortcuts to your team's tools, shown at the foot of the navigation. Empty by default. |

Full reference in [documentation/configuration.md](../documentation/configuration.md).
