# HTTP API reference

The 61 endpoints the API serves, generated from the route definitions. For the bus contract
behind the writes, see [`docs/apis/core.yaml`](../docs/apis/core.yaml).

## How authentication works

**Authentication is applied globally per HTTP method, not per route.** `api/app.ts` installs
`validateToken` for every path _except_ an explicit exemption list in `api/config/public.ts`,
built as a negative-lookahead regex. It is deny-by-default, which is the right shape, but it
means a route file can look unprotected while being covered.

So: **every endpoint below requires a bearer token** unless the Roles column says otherwise.

The token must be a JWT from the configured identity provider, sent as
`Authorization: Bearer <token>`. There is no query-parameter fallback.

A token that validates but whose subject is not in the `users` table gets 401
`user_not_found` — Jiku does not create users. See
[known-limitations.md](known-limitations.md).

**Roles** come from a claim on the token. A dash in the Roles column means the endpoint has no
`hasAnyRole` check, so any authenticated user reaches it — some of those validate access
inside the handler instead, per entity.

**Bus** marks the writes that publish a command to `core` instead of writing directly. Those
can return 503 if the bus is unreachable, or time out if core does not answer within
`NATS_REQUEST_TIMEOUT_MS`.

## Internal endpoints

### Actors

| Method | Path                              | Roles       | Bus |
| ------ | --------------------------------- | ----------- | --- |
| GET    | `/api/clients`                    | —           |     |
| POST   | `/api/clients`                    | —           | ●   |
| GET    | `/api/clients/:id`                | —           |     |
| PATCH  | `/api/clients/:id`                | —           | ●   |
| GET    | `/api/clients/:clientId/projects` | user, admin |     |

### Projects

| Method | Path                               | Roles       | Bus |
| ------ | ---------------------------------- | ----------- | --- |
| GET    | `/api/projects`                    | —           |     |
| POST   | `/api/projects`                    | —           | ●   |
| GET    | `/api/projects/:id`                | —           |     |
| PATCH  | `/api/projects/:id`                | —           | ●   |
| GET    | `/api/projects/:projid/persons`    | user, admin |     |
| GET    | `/api/projects/objectives-summary` | —           |     |

### Requirements

| Method | Path                                    | Roles       | Bus |
| ------ | --------------------------------------- | ----------- | --- |
| GET    | `/api/requirements`                     | user, admin |     |
| POST   | `/api/requirements`                     | user, admin | ●   |
| GET    | `/api/requirements/:reqid`              | user, admin |     |
| PATCH  | `/api/requirements/:reqid`              | user, admin | ●   |
| POST   | `/api/requirements/:reqid/comments`     | user, admin | ●   |
| GET    | `/api/requirements/:reqid/worked-hours` | user, admin |     |
| GET    | `/api/requirements/report`              | user, admin |     |
| GET    | `/api/requirements/tags/suggestions`    | user, admin |     |

### Tasks

Called `objectives` here; the bus protocol calls them `task`. Same entity — see
[README.md](README.md).

| Method | Path                               | Roles | Bus |
| ------ | ---------------------------------- | ----- | --- |
| GET    | `/api/objectives`                  | —     |     |
| POST   | `/api/objectives`                  | —     | ●   |
| GET    | `/api/objectives/:id`              | —     |     |
| PATCH  | `/api/objectives/:id`              | —     | ●   |
| POST   | `/api/objectives/:id/comments`     | —     | ●   |
| PATCH  | `/api/objectives/:id/comment/:cid` | —     |     |

### Worked and unworked time

| Method | Path                                          | Roles       | Bus |
| ------ | --------------------------------------------- | ----------- | --- |
| GET    | `/api/worked-times`                           | user, admin |     |
| POST   | `/api/worked-times`                           | user, admin | ●   |
| DELETE | `/api/worked-times/:id`                       | user, admin | ●   |
| GET    | `/api/worked-times/person-objectives`         | user, admin |     |
| GET    | `/api/worked-times/person-requirements`       | user, admin |     |
| GET    | `/api/worked-times/report/by-person`          | user, admin |     |
| GET    | `/api/worked-times/report/by-project`         | user, admin |     |
| GET    | `/api/worked-times/report/by-project/:projid` | user, admin |     |
| GET    | `/api/unworked-times`                         | —           |     |
| POST   | `/api/unworked-times`                         | —           | ●   |
| DELETE | `/api/unworked-times/:id`                     | —           | ●   |
| GET    | `/api/unworked-times/reasons`                 | —           |     |
| GET    | `/api/unworked-times/report`                  | —           |     |
| GET    | `/api/week-assigned-times`                    | admin, user |     |
| PUT    | `/api/week-assigned-times`                    | admin       |     |

> `/api/week-assigned-times` holds the only `PUT` in the API, and its future is undecided —
> see [known-limitations.md](known-limitations.md).

### Attachments

None of these carry a `hasAnyRole` check: they validate access **per entity** inside the
handler, via `canUserAccessEntity`, which restricts `external-user` by project permission.

| Method | Path                            | Roles | Bus |
| ------ | ------------------------------- | ----- | --- |
| GET    | `/api/attachments`              | —     |     |
| POST   | `/api/attachments`              | —     |     |
| GET    | `/api/attachments/:id`          | —     |     |
| DELETE | `/api/attachments/:id`          | —     |     |
| GET    | `/api/attachments/:id/download` | —     |     |
| GET    | `/api/attachments/:id/preview`  | —     |     |

### Other

| Method | Path                          | Roles       | Bus |
| ------ | ----------------------------- | ----------- | --- |
| GET    | `/api/persons`                | —           |     |
| GET    | `/api/settings/hours-per-day` | admin, user |     |
| POST   | `/api/auth/present`           | —           |     |

> **`POST /api/auth/present` is a no-op.** It responds 200 and does nothing. It used to
> register a user on first login and is the one write that never became a command. See
> [known-limitations.md](known-limitations.md).

## Client portal endpoints

Served under `/api/opus/*` and consumed by `opus-web`. Access is restricted by project
permission: an `external-user` only sees the projects they were granted.

| Method  | Path                                                 | Roles                      | Bus |
| ------- | ---------------------------------------------------- | -------------------------- | --- |
| GET     | `/api/opus/projects`                                 | user, external-user        |     |
| GET     | `/api/opus/projects/:projid/requirements`            | user, external-user        |     |
| GET     | `/api/opus/projects/:projid/users`                   | user, external-user        |     |
| POST    | `/api/opus/requirements`                             | user, external-user        | ●   |
| GET     | `/api/opus/requirements/:reqid`                      | user, external-user        |     |
| PATCH   | `/api/opus/requirements/:reqid`                      | user, admin                | ●   |
| POST    | `/api/opus/requirements/:reqid/comments`             | user, external-user        | ●   |
| POST    | `/api/opus/requirements/:reqid/subscriptors`         | external-user              | ●   |
| DELETE  | `/api/opus/requirements/:reqid/subscriptors/:userId` | external-user              | ●   |
| POST    | `/api/opus/attachments`                              | user, external-user        |     |
| GET     | `/api/opus/attachments/:id/preview`                  | user, external-user        |     |
| **GET** | **`/api/opus/attachments/:id/public`**               | **none — unauthenticated** |     |

> `/api/opus/attachments/:id/public` is the one endpoint exempt from authentication, by
> design: it serves only attachments explicitly marked public and returns 403 for anything
> else, with `X-Content-Type-Options: nosniff` and a sandboxing CSP. Because ids are
> sequential it is enumerable, and for large files it redirects to a pre-signed storage URL.

## Errors

Responses carry a `code` and a `message`. Common codes:

| Code             | Meaning                                                                 |
| ---------------- | ----------------------------------------------------------------------- |
| `unauthorized`   | missing or invalid token                                                |
| `user_not_found` | the token is valid but the subject is not in `users`                    |
| `access_denied`  | authenticated, but the role or the project permission does not allow it |
| `not_found`      | no such route or entity                                                 |

**There is no closed catalogue of error codes**, and no documented mapping from the bus's
`errorCode` to HTTP statuses. Messages are currently in Spanish, because the frontends display
them directly to the user. Both are tracked in
[known-limitations.md](known-limitations.md).

## Regenerating this list

The tables above are derived from the route definitions. To check them against the code:

```sh
grep -rhoE "\.(get|post|patch|put|delete)\(\s*'[^']+'" api/lib/routes/*.ts | sort
```

Note that three routes put the path on the following line, so a single-line regex undercounts
by three.
