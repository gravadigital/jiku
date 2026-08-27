# HTTP API reference

The 61 endpoints the API serves, generated from the route definitions. For the bus contract
behind the writes, see [`docs/apis/core.yaml`](../docs/apis/core.yaml).

## How authentication works

**Authentication is applied globally per HTTP method, not per route.** `api/app.ts` installs
`validateToken` for every path _except_ an explicit exemption list in `api/config/public.ts`,
built as a negative-lookahead regex. It is deny-by-default, which is the right shape, but it
means a route file can look unprotected while being covered.

**That exemption list is empty**, so `validateToken` currently covers every path: **every
endpoint below requires a bearer token**, with no exception. The mechanism stays in place
because declaring something public has to remain a one-line change in a file whose only
purpose is to enumerate what is public — a change that shows up in review. Adding an entry
there makes an endpoint reachable without credentials, so only something with its own
documented access control belongs on it.

The exemption interface covers `GET`, `PATCH`, `POST` and `DELETE`. A new `PUT` is **not**
covered by the global installation and has to declare `validateToken` in its own chain.

The token must be a JWT from the configured identity provider, sent as
`Authorization: Bearer <token>`. There is no query-parameter fallback.

`req.user` is built entirely from the verified JWT claim — the api does not look the subject up
in `users` on the request path, so there is no `user_not_found` response anymore. See
[known-limitations.md](known-limitations.md).

**Roles** come from a claim on the token. A dash in the Roles column means the endpoint has no
`hasAnyRole` check, so any authenticated user reaches it — some of those validate access
inside the handler instead, per entity. **For a `Bus` endpoint, the Roles column documents what
`core`'s role → command map authorises, not a check the api runs itself** (REQ-007): the api no
longer calls `hasAnyRole` on any write route, and publishes the command to `core` for it to
authorise, mirror identity, and apply every entity/project and business rule that used to be
enforced here.

**Bus** marks the endpoints that publish a command to `core` instead of touching the database
directly. Most of them are writes, but the attachment and file reads are marked too: signing a
download URL is `core`'s job, so the `api` asks for it over the bus and answers `302`. Those have
three failure modes. The first two used to be one single `503`, and they are told apart on purpose:
they mean opposite things about whether it is safe to retry.

- **`503 service_unavailable`** — **nobody is subscribed** to the subject. The server answers *no
  responders* in milliseconds, it does not wait for the timeout. It is a **deployment** problem: core
  is not running. **The operation did not happen, so retrying is safe.**
- **`504 gateway_timeout`** — someone was listening but the reply did not arrive within
  `NATS_REQUEST_TIMEOUT_MS` (default 5000 ms). It is a **performance** problem, and
  **THE OPERATION MAY HAVE HAPPENED**: without JetStream there is no ack and commands are not
  idempotent, so **retrying blindly can duplicate**.
- **`503 service_unavailable`** — any other exception falls back here, which is the behaviour that
  predates the split.

`gateway_timeout` is not a core error code and is **not** in `STATUS_BY_ERROR_CODE`: the api produces
it in the `catch`, when there is no reply at all to translate.

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

None of these carry a `hasAnyRole` check. The ones that resolve a link validate access **per
entity** inside the handler, via `canUserAccessEntity`, which restricts `external-user` by
project permission. `POST /api/attachments` and `GET /api/files/:id/preview` are authorised by
**the JWT alone**: the upload body no longer declares an entity, and a file with no link has no
entity to check against. The per-entity check moved to the moment of linking, where the entity
exists.

| Method | Path                            | Roles | Bus |
| ------ | ------------------------------- | ----- | --- |
| GET    | `/api/attachments`              | —     |     |
| POST   | `/api/attachments`              | —     | ●   |
| GET    | `/api/attachments/:id`          | —     |     |
| DELETE | `/api/attachments/:id`          | —     | ●   |
| GET    | `/api/attachments/:id/download` | —     | ●   |
| GET    | `/api/attachments/:id/preview`  | —     | ●   |
| GET    | `/api/files/:id/preview`        | —     | ●   |

`POST /api/attachments` does **not** receive the file. It takes `fileName`, `mimeType`,
`fileSize` and an optional `checksum`, and returns an upload ticket the browser uses to `PUT`
the byte straight to the bucket. One file per request. `GET /api/files/:id/preview` previews a
file that is not linked to anything yet, which is the state an upload form is in before the
entity is saved.

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
| POST    | `/api/opus/attachments`                              | user, external-user        | ●   |
| GET     | `/api/opus/attachments/:id/preview`                  | user, external-user        | ●   |

## Errors

Responses carry a `code` and a `message`. Common codes:

| Code                     | Meaning                                                                 |
| ------------------------ | ----------------------------------------------------------------------- |
| `unauthorized`           | missing or invalid token                                                |
| `access_denied`          | authenticated, but the entity or project permission does not allow it   |
| `caller_not_authorized`  | authenticated, but the role does not authorise this command             |
| `not_found`              | no such route or entity                                                 |

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
