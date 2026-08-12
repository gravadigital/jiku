# Jiku — NATS protocol

This document defines the contract between **api** and **core** over NATS: the subjects, the
request and reply format, and the 17 commands with their fields.

**It is the source of truth for the contract.** Where this document and the code disagree,
the document wins.

Surrounding context: [architecture.md](architecture.md) explains how the bus fits into the
system and why names differ between the protocol and the database;
[api-reference.md](api-reference.md) lists the HTTP endpoints and marks which ones publish
commands.

Enum values below (`analisis`, `funcionalidad`, `sin_prioridad`, …) are shown verbatim: they
are identifiers baked into the database schema, not prose, so they stay in Spanish. See
[known-limitations.md](known-limitations.md).

---

## General rules

### Subject prefix

Every subject carries the prefix `{instance}.{user-id}.{svc}.{version}`.

Where:

- instance: product instance (dev, prod)
- user-id: who publishes. It is the `sub` of the Zitadel token, **raw**. It applies equally to
  people and to service users, because both are Zitadel users.
- svc: name of the service that answers (`gestion` = core)
- version: version of the api to use

Example: `prod.323332022539911171.gestion.v1.requirements.new`

The user id goes in raw on purpose: it is what lets core know who called it by reading the
subject — a fact vouched for by the auth-callout, which pins the publish permission — instead
of trusting the message body. The trade-off is that the Zitadel userId is visible in subjects,
logs and traces.

**Identity and endpoint are different things.** The `user-id` says WHO calls; the `svc` says
WHO it is talking to. A service has both: its `sub` (unique per replica) and the name of its
endpoint (shared across replicas, which is what allows balancing with queue groups).

Careful with what the user id does NOT say: the api connects with **one** service user for all
of its users, so the `user-id` of a command published by the api is the api's, not that of the
person who originated the action. The end user travels in the body, in `creator` / `author`.

### Inbox prefix

Replies come back on `_INBOX.{hash(user-id)}`, with the user id **hashed** — unlike the
command subject, which carries it raw.

The hash is sha256 of the user id, in base32 without padding, lowercase, the first 16
characters. It is deterministic so that each client derives it from its own token, with no side
channel; it is not a secret (anyone who sees a subject has already seen the raw user id), and
it exists because the inbox needs an opaque, fixed-length token.

The client **must** set that prefix when connecting (`inboxPrefix` in nats.js): by default the
library generates an `_INBOX.<random>` that no scoped permission authorises, and the replies
never arrive. In this repo `inboxPrefix()` from `@jiku/nats-protocol` handles it; the reference
implementation is `cmd/session` in the auth-callout repo.

### Reply format

Every request reply carries these fields:

| Field          | Type   | Possible values        | Notes                            |
| -------------- | ------ | ---------------------- | -------------------------------- |
| `status`       | string | `success` \| `failure` | Indicates the result of the request |
| `errorCode`    | string |                        |                                  |
| `errorMessage` | string |                        |                                  |
| `data`         | object |                        | Body of the reply                |

When a command says "Reply: no content", `data` travels empty: the `status` is the whole reply.

> **The `errorCode` catalogue is not closed.** Today each command returns the codes it needs,
> and there is no exhaustive list nor a documented mapping to HTTP statuses. A bus consumer
> cannot enumerate up front what it may receive. See
> [known-limitations.md](known-limitations.md).

### Editing

Edit requests have no mandatory fields. If a field is absent it keeps its previous value; if it
arrives as null it is cleared. It fails if null is sent for a field that is mandatory at
creation.

That is why the `edit` tables apply no default values: a default only takes part on creation.

### Author of the action

The api connects to NATS with its own **service_user**, so the `session` in the subject
identifies the api and not the person who originated the action. Commands that need to know who
acted receive it in the body:

- `creator`: user who creates the entity.
- `author`: user who writes a note or comment.
- `editor`: user who edits. **Required in the `edit` commands that record activity**
  (`tasks.{id}.edit`, `requirements.{id}.edit`, `requirements.{id}.resolve`): the `changed_by`
  column of the activity tables has a foreign key against `users`, so without a real user the
  write fails.

All three are the **Zitadel user id** (string). Not to be confused with `personId`, which is
the id from the `persons` table (number) and designates the person the record impacts: in
`worked-times` both concepts coexist.

Commands that declare neither `creator` nor `author` simply do not need them.

### Roles

Roles are assigned in Zitadel and are the only thing that decides permissions on the bus:

| Role            | Who                | NATS access                  |
| --------------- | ------------------ | ---------------------------- |
| `user`          | web user           | **no**                       |
| `external-user` | opus user          | **no**                       |
| `internal-app`  | the api            | publishes commands to core   |
| `core`          | the core service   | serves the commands          |

People do not connect to the bus: they speak HTTP with the api, and it is the api that
publishes with its own service_user. `user` and `external-user` have no rule in the
auth-callout, and since there is no catch-all, their connection is rejected.

The role → permissions mapping lives in `deploy/nats/auth-callout/`.

### Validation and permissions

| Who  | What it validates                                                          |
| ---- | -------------------------------------------------------------------------- |
| api  | that the token is valid and that the **role** allows the operation         |
| core | everything else: message shape, existence of entities and business rules   |

Core **does not validate permissions or roles**: it trusts whoever sends it the message. That
trust is held up by the auth-callout, which restricts who can publish on each subject. In
particular, core deletes whatever it is told to without checking who owns the record.

## Requests

### clients.new

Request:

| Field         | Type   | Possible values | Default | Required | Notes |
| ------------- | ------ | --------------- | ------- | -------- | ----- |
| `name`        | string |                 |         | Yes      |       |
| `description` | string |                 |         | No       |       |

Reply:

| Field | Type   | Nullable | Notes |
| ----- | ------ | -------- | ----- |
| `id`  | number | No       |       |

### clients.{id}.edit

Request:

| Field         | Type   | Possible values | Default | Required | Notes |
| ------------- | ------ | --------------- | ------- | -------- | ----- |
| `name`        | string |                 |         | No       |       |
| `description` | string |                 |         | No       |       |

Reply: no content

### projects.new

Request:

| Field         | Type            | Possible values                                                     | Default     | Required | Notes                |
| ------------- | --------------- | ------------------------------------------------------------------- | ----------- | -------- | -------------------- |
| `creator`     | string          |                                                                     |             | Yes      | id of the creating user |
| `name`        | string          |                                                                     |             | Yes      |                      |
| `code`        | string          |                                                                     |             | Yes      |                      |
| `status`      | string          | `analisis` \| `activo` \| `inactivo` \| `finalizado` \| `cancelado` | `analisis`  | No       |                      |
| `type`        | string          | `interno` \| `comercial` \| `investigacion` \| `propuesta`          | `comercial` | No       |                      |
| `description` | string          |                                                                     |             | No       |                      |
| `initDate`    | date            |                                                                     | now         | No       |                      |
| `endDate`     | date            |                                                                     |             | No       |                      |
| `clientId`    | number          |                                                                     |             | No       |                      |
| `properties`  | array<Property> |                                                                     |             | No       |                      |

#### Structure of Property:

| Field   | Type   | Possible values                                                             | Notes                                                                  |
| ------- | ------ | --------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `code`  | string | `documentacion` \| `diseño` \| `board_de_tareas` \| `mattermost_group_name` |                                                                        |
| `value` | string |                                                                             | The first three must be URIs; `mattermost_group_name` is free-form text |

> `properties` is stored in the `key_value_pairs` column, which is a flat object
> (`{ documentacion: "https://..." }`). Core does the translation: the database is untouched,
> the new name belongs to the contract. Sending `properties` replaces the whole set.

Reply:

| Field | Type   | Nullable | Notes |
| ----- | ------ | -------- | ----- |
| `id`  | number | No       |       |

### projects.{id}.edit

Request:

| Field         | Type            | Possible values                                                     | Default | Required | Notes |
| ------------- | --------------- | ------------------------------------------------------------------- | ------- | -------- | ----- |
| `name`        | string          |                                                                     |         | No       |       |
| `code`        | string          |                                                                     |         | No       |       |
| `status`      | string          | `analisis` \| `activo` \| `inactivo` \| `finalizado` \| `cancelado` |         | No       |       |
| `type`        | string          | `interno` \| `comercial` \| `investigacion` \| `propuesta`          |         | No       |       |
| `description` | string          |                                                                     |         | No       |       |
| `initDate`    | date            |                                                                     |         | No       |       |
| `endDate`     | date            |                                                                     |         | No       |       |
| `clientId`    | number          |                                                                     |         | No       |       |
| `properties`  | array<Property> |                                                                     |         | No       |       |

#### Structure of Property:

| Field   | Type   |
| ------- | ------ |
| `code`  | string |
| `value` | string |

Reply: no content

### tasks.new

Request:

| Field                  | Type     | Possible values                                                       | Default           | Required | Notes                             |
| ---------------------- | -------- | --------------------------------------------------------------------- | ----------------- | -------- | --------------------------------- |
| `creator`              | string   |                                                                       |                   | Yes      | id of the creating user           |
| `title`                | string   |                                                                       |                   | Yes      |                                   |
| `description`          | string   |                                                                       |                   | No       |                                   |
| `estimatedFinishDate`  | date     |                                                                       |                   | No       |                                   |
| `state`                | enum     | `backlog` \| `activo` \| `finalizado` \| `cancelado` \| `en_revision` | `backlog`         | No       |                                   |
| `area`                 | enum     | `diseño` \| `desarrollo` \| `gestion` \| `investigacion`              | `desarrollo`      | No       |                                   |
| `priority`             | string   | `sin_prioridad` \| `baja` \| `media` \| `alta` \| `urgente`           | `sin_prioridad`   | No       |                                   |
| `projectId`            | number   |                                                                       |                   | Yes      | Validated against `projects`      |
| `responsiblePersonIds` | number[] |                                                                       |                   | Yes      | Validated against `persons`       |
| `visibilityLevel`      | enum     | `public` \| `internal`                                                | **`public`** (DB) | No       |                                   |
| `requirementId`        | number   |                                                                       |                   | No       | Must belong to the same `projectId` |

> **`priority` is an enum on the bus and an integer in the database.** The
> `objectives.priority` column is INTEGER and is not touched, so core translates:
> `sin_prioridad`→0, `baja`→1, `media`→2, `alta`→3, `urgente`→4.
>
> The api used to accept 0-5 and there is data with 5, which reads as `urgente`. So as not to
> lose that value while the web still speaks in numbers, the api can send the original integer
> in `priorityValue` and core uses it as-is. That field disappears when the web moves to names.
>
> Not to be confused with `requirements.priority`, which **is** an enum in the database.

Reply:

| Field | Type   | Nullable | Notes |
| ----- | ------ | -------- | ----- |
| `id`  | number | No       |       |

### tasks.{id}.edit

Request:

| Field                  | Type     | Possible values                                                       | Default | Required | Notes                          |
| ---------------------- | -------- | --------------------------------------------------------------------- | ------- | -------- | ------------------------------ |
| `editor`               | string   |                                                                       |         | Yes      | id of the editing user         |
| `title`                | string   |                                                                       |         | No       |                                |
| `description`          | string   |                                                                       |         | No       |                                |
| `estimatedFinishDate`  | date     |                                                                       |         | No       |                                |
| `state`                | enum     | `backlog` \| `activo` \| `finalizado` \| `cancelado` \| `en_revision` |         | No       |                                |
| `area`                 | string   | `diseño` \| `desarrollo` \| `gestion` \| `investigacion`              |         | No       |                                |
| `priority`             | string   | `sin_prioridad` \| `baja` \| `media` \| `alta` \| `urgente`           |         | No       |                                |
| `responsiblePersonIds` | number[] |                                                                       |         | No       | Full replacement of assignees  |
| `visibilityLevel`      | string   | `public` \| `internal`                                                |         | No       |                                |
| `requirementId`        | number   |                                                                       |         | No       |                                |

> **`priority` is an enum on the bus and an integer in the database.** The
> `objectives.priority` column is INTEGER and is not touched, so core translates:
> `sin_prioridad`→0, `baja`→1, `media`→2, `alta`→3, `urgente`→4.
>
> The api used to accept 0-5 and there is data with 5, which reads as `urgente`. So as not to
> lose that value while the web still speaks in numbers, the api can send the original integer
> in `priorityValue` and core uses it as-is. That field disappears when the web moves to names.
>
> Not to be confused with `requirements.priority`, which **is** an enum in the database.

Reply: no content

### tasks.{id}.comment

Request:

| Field             | Type     | Possible values        | Default    | Required | Notes                                |
| ----------------- | -------- | ---------------------- | ---------- | -------- | ------------------------------------ |
| `author`          | string   |                        |            | Yes      | id of the user authoring the note    |
| `comment`         | string   |                        |            | Yes      |                                      |
| `visibilityLevel` | string   | `public` \| `internal` | `internal` | No       |                                      |
| `attachmentIds`   | number[] | positive integers      | none       | No       | Must be drafts of the authoring user |

Reply:

| Field | Type   | Nullable | Notes |
| ----- | ------ | -------- | ----- |
| `id`  | number | No       |       |

### requirements.new

Request:

| Field                  | Type               | Possible values                                             | Default         | Required | Notes                        |
| ---------------------- | ------------------ | ----------------------------------------------------------- | --------------- | -------- | ---------------------------- |
| `creator`              | string             |                                                             |                 | Yes      | id of the creating user      |
| `title`                | string             |                                                             |                 | Yes      |                              |
| `description`          | string             |                                                             |                 | Yes      |                              |
| `projectId`            | number             |                                                             |                 | Yes      |                              |
| `type`                 | string             | `funcionalidad` \| `mejora` \| `incidencia` \| `otro`       |                 | No       |                              |
| `priority`             | string             | `sin_prioridad` \| `baja` \| `media` \| `alta` \| `urgente` | `sin_prioridad` | No       |                              |
| `visibilityLevel`      | string             | `public` \| `internal`                                      | `public`        | No       |                              |
| `responsiblePersonIds` | number[]           | integers                                                    |                 | No       | Validated against `persons`  |
| `estimatedFinishDate`  | date               |                                                             |                 | No       |                              |
| `attachmentIds`        | number[]           | positive integers                                           | none            | No       | Must be drafts of the user   |
| `tags`                 | `{ key, value }[]` | string/string pairs                                         |                 | No       |                              |

Reply:

| Field | Type   | Nullable | Notes |
| ----- | ------ | -------- | ----- |
| `id`  | number | No       |       |

### requirements.{id}.edit

Request:

| Field                  | Type               | Possible values                                                                                       | Default         | Required | Notes                          |
| ---------------------- | ------------------ | ----------------------------------------------------------------------------------------------------- | --------------- | -------- | ------------------------------ |
| `editor`               | string             |                                                                                                       |                 | Yes      | id of the editing user         |
| `title`                | string             |                                                                                                       |                 | No       |                                |
| `description`          | string             |                                                                                                       |                 | No       |                                |
| `type`                 | string             | `funcionalidad` \| `mejora` \| `incidencia` \| `otro`                                                 |                 | No       |                                |
| `priority`             | string             | `sin_prioridad` \| `baja` \| `media` \| `alta` \| `urgente`                                           | `sin_prioridad` | No       |                                |
| `visibilityLevel`      | string             | `public` \| `internal`                                                                                | `public`        | No       |                                |
| `responsiblePersonIds` | number[]           | integers                                                                                              |                 | No       | Validated against `persons`    |
| `estimatedFinishDate`  | date               |                                                                                                       |                 | No       |                                |
| `attachmentIds`        | number[]           | positive integers                                                                                     | none            | No       | Must be drafts of the user     |
| `tags`                 | `{ key, value }[]` | string/string pairs                                                                                   |                 | No       |                                |
| `state`                | string             | `analisis` \| `planificacion` \| `en_cola` \| `desarrollo` \| `revision` \| `resuelto` \| `cancelado` |                 | No       | Subject to transition validation |
| `scope`                | string             |                                                                                                       |                 | No       |                                |
| `technicalSolution`    | string             |                                                                                                       |                 | No       |                                |
| `acceptanceCriteria`   | string             |                                                                                                       |                 | No       |                                |

> **Two things about this command are unsettled**, and are worth knowing before integrating:
>
> - The **state transition** happens through editing, with no state machine restricting it:
>   `state` accepts any value of the enum. If the order needs to be enforced, the natural place
>   is a command of its own, as was done with `resolve`.
> - Editing **`attachmentIds`** replaces the whole list. There is no way to add or remove just
>   one.

Reply: no content

### requirements.{id}.resolve

Request:

| Field        | Type   | Possible values                                                                    | Default | Required | Notes                  |
| ------------ | ------ | ---------------------------------------------------------------------------------- | ------- | -------- | ---------------------- |
| `editor`     | string |                                                                                    |         | Yes      | id of the editing user |
| `type`       | string | `error_interno` \| `fuera_de_alcance` \| `error_externo` \| `discutible` \| `otro` |         | Yes      |                        |
| `conclusion` | string |                                                                                    |         | No       |                        |
| `comment`    | string |                                                                                    |         | No       |                        |

Reply: no content

### requirements.{id}.comment

Request:

| Field             | Type     | Possible values        | Default    | Required | Notes                   |
| ----------------- | -------- | ---------------------- | ---------- | -------- | ----------------------- |
| `author`          | string   |                        |            | Yes      | id of the creating user |
| `comment`         | string   |                        |            | Yes      |                         |
| `visibilityLevel` | string   | `public` \| `internal` | `internal` | No       |                         |
| `attachmentIds`   | number[] |                        |            | No       |                         |

Reply:

| Field | Type   | Nullable | Notes |
| ----- | ------ | -------- | ----- |
| `id`  | number | No       |       |

### requirements.{id}.subscriptors.new

Request:

| Field    | Type   | Possible values | Default | Required | Notes                                                            |
| -------- | ------ | --------------- | ------- | -------- | ---------------------------------------------------------------- |
| `userId` | string |                 |         | Yes      | Must have permission on the project and not be subscribed already |

Reply: no content

### requirements.{id}.subscriptors.{userId}.delete

Request: no content

Reply: no content

### worked-times.new

Request:

| Field           | Type   | Possible values                            | Default                          | Required | Notes                                                        |
| --------------- | ------ | ------------------------------------------ | -------------------------------- | -------- | ------------------------------------------------------------ |
| `date`          | string | `YYYY-MM-DD` (regex `^\d{4}-\d{2}-\d{2}$`) |                                  | Yes      |                                                              |
| `minutes`       | number | integer ≥ `1`                              |                                  | Yes      |                                                              |
| `projectId`     | number | integer                                    |                                  | Yes      | Validated against `projects`                                 |
| `taskId`        | number | integer                                    |                                  | No       | Mutually exclusive with `requirementId`                      |
| `requirementId` | number | integer                                    |                                  | No       | Mutually exclusive with `taskId`; must belong to `projectId`  |
| `personId`      | number | integer                                    | person of the authenticated user | No       |                                                              |

Reply:

| Field | Type   | Nullable | Notes |
| ----- | ------ | -------- | ----- |
| `id`  | number | No       |       |

### worked-times.{id}.delete

Request: no content

Reply: no content

### unworked-times.new

Request:

| Field      | Type   | Possible values                                                                                                                       | Default                          | Required | Notes                        |
| ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | -------- | ---------------------------- |
| `date`     | string | `YYYY-MM-DD` (regex `^\d{4}-\d{2}-\d{2}$`)                                                                                            |                                  | Yes      |                              |
| `minutes`  | number | integer ≥ `1`                                                                                                                         |                                  | Yes      | Subject to the daily limit   |
| `reason`   | string | `tramite` \| `corte_servicios` \| `vacaciones` \| `dia_no_laborable` \| `personal` \| `medico` \| `estudio` \| `enfermedad` \| `otro` |                                  | Yes      |                              |
| `personId` | number | integer ≥ `1`                                                                                                                         | person of the authenticated user | No       |                              |

Reply:

| Field | Type   | Nullable | Notes |
| ----- | ------ | -------- | ----- |
| `id`  | number | No       |       |

### unworked-times.{id}.delete

Request: no content

Reply: no content
