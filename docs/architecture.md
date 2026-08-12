# Architecture

How Jiku is put together, and why. If you are looking for how to run it, see
[installation.md](installation.md); for what it does, [features.md](features.md).

```
web ─────┐
         ├──HTTP──> api ──NATS──> core ──> PostgreSQL
opus-web ┘         (reads)  req/reply  (writes)
```

## The central rule: only one service writes

The API serves HTTP and reads the database directly. Every mutation is published as a
command on NATS, and `core` is the only service that writes.

**This is enforced by database permissions, not by convention.** The API connects with a
role that only holds `SELECT`. That is the difference between a rule people remember and a
rule the database enforces: an accidental `INSERT` in the API fails at the driver, not in
code review.

Two consequences worth knowing before you deploy:

- The read-only role has to be created correctly, including `ALTER DEFAULT PRIVILEGES` —
  otherwise tables created by future migrations are invisible to the API. See
  [installation.md](installation.md).
- **Migrations are the exception.** They run on API startup and do need to write, so they
  use a separate set of credentials (`POSTGRESQL_MIGRATION_USER`).

## Why split reads from writes

Writes used to be spread across ~60 Express routes, where business validation and HTTP
handling were the same function. Consolidating them into one service with an explicit
contract means the rules live in one place, and it opens the door to other producers —
integrations, new frontends — writing through the bus instead of going through the API.

The cost is a network hop and an extra moving part. That trade is worth it when writes
carry real business rules; it would not be worth it for a CRUD.

## The services

| Service        | What it does                                                                                                                                             |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api`          | HTTP. Authenticates, authorises by role, reads the database, translates writes into commands.                                                            |
| `core`         | Consumes commands, validates business rules, writes. No HTTP surface.                                                                                    |
| `web`          | Internal frontend (Next.js).                                                                                                                             |
| `opus-web`     | Client-facing portal (Next.js), consumes `/api/opus/*` with the `external-user` role.                                                                    |
| `nats`         | The bus. Request/reply, no JetStream.                                                                                                                    |
| `auth-callout` | Authenticates bus connections against the identity provider and mints per-connection permissions. Consumed as a published image; not in this repository. |

### The frontends proxy the API

Neither frontend lets the browser talk to the API. The browser calls `/api/...` on the frontend
itself, and a route handler forwards the request server-side, attaching the access token.

Two things follow. The access token never leaves the server. And **the published images carry no
configuration**: Next bakes `NEXT_PUBLIC_*` into the browser bundle at build time, so an API URL
there would tie an image to a single installation. Reading it from `API_URL` on the server means
one image works anywhere.

## How core processes a command

```
NATS ──> Consumer ──> Dispatcher ──> Command ──> database
                      (transaction)  (validates and writes)
```

| Piece               | Responsibility                                       |
| ------------------- | ---------------------------------------------------- |
| `bus/consumer.ts`   | connects to the bus, subscribes with a queue group   |
| `bus/dispatcher.ts` | resolves the command, opens the transaction, replies |
| `commands/`         | one file per command                                 |
| `models/`           | registers the shared Sequelize models                |

Three decisions in there are load-bearing:

**The dispatcher owns the transaction.** It commits when the command replies `success` and
rolls back otherwise. Commands never open or close it. This is what makes it impossible for
a command to leave a half-written change by forgetting a rollback — which in the API had to
be repeated in every link of every middleware chain.

**The dispatcher never throws.** An unexpected error becomes an error `Reply`. There is a
request waiting on the other side; staying silent would hang the API until its timeout.

**Command matching is by segment, not by regex.** `clients.{id}.edit` is resolved comparing
segment by segment, because ids can be numbers or identity-provider strings, and a `.`
inside a value would break a naive regular expression.

## Authentication: two separate planes

These are easy to confuse, and confusing them leads to wrong conclusions about who can do
what.

**People → api.** A JWT from the identity provider, validated by the API against its JWKS.
The API checks the token and the caller's role.

**api → NATS.** The API connects with its own _service user_. The auth-callout validates
that token during the handshake and mints subject permissions for that connection.

Because the API connects as itself, the user id in the subject is the API's, not the end
user's. **The acting user travels in the message body** (`creator` / `author`), and core
trusts it.

> That trust is sound only because the access policy lets nothing but the API publish those
> commands. **If you add a second publisher to the bus, this assumption stops holding** —
> see [known-limitations.md](known-limitations.md).

**Who validates what**: the API validates the token and the role; core validates everything
else — message shape, entity existence, business rules. Core does not know about roles and
does not receive them.

### There are two sets of roles

| Plane | Roles                                  | Where                            |
| ----- | -------------------------------------- | -------------------------------- |
| HTTP  | `user`, `admin`, `external-user`       | `hasAnyRole([...])` in the API   |
| Bus   | `internal-app`, `core`, `bus-observer` | identity provider → auth-callout |

They do not overlap: `admin` means nothing to the bus, and `internal-app` means nothing to
the API.

### The bus access policy

Lives in `deploy/nats/auth-callout/` and is versioned on purpose — it is a product decision,
not a secret. Rules are evaluated in order, first match wins, and **there is no catch-all**:
a valid token whose role is not listed cannot connect.

- `internal-app` (the API) may only publish under its own session and subscribe to its own
  inbox. It serves no endpoint.
- `core` subscribes to the service endpoint from any caller, which is what allows several
  replicas to share a queue group.
- `bus-observer` can read everything and publish nothing. It exists for local debugging and
  **must not be enabled in production**: it would read every command's payload.

People never touch the bus. They speak HTTP to the API, which republishes with its own
service user.

## Shared packages

The repository is an npm workspace. What the services share lives once, under `packages/`:

| Package               | Contents                                                |
| --------------------- | ------------------------------------------------------- |
| `@jiku/models`        | the Sequelize models, plus `allModels` to register them |
| `@jiku/nats-protocol` | subjects, reply format and error codes                  |
| `@jiku/zitadel-auth`  | obtains and renews the service user's access token      |

`@jiku/models` **does not open a connection**. It exports the classes and each service
registers them in its own Sequelize instance, because they connect with different
credentials — the API's only reads.

`@jiku/zitadel-auth` takes the service user's JSON key and requests a token when needed.
Tokens expire in about an hour, so it renews in the background before expiry, and the NATS
client re-evaluates the credential on every reconnect. Services do not need restarting.

## The protocol is the contract

Subjects, request and reply formats and the full command list are in
[nats-protocol.md](nats-protocol.md). **When the code and that
document disagree, the document wins.**

Subjects carry a `version` segment (`v1`). That is the mechanism for making incompatible
changes: old and new consumers coexist while a migration happens.

### Names differ between the bus and the database

The database schema predates the protocol, and the protocol renamed some things. Core
translates on write, so the same concept has two names depending on where you look:

| Protocol                               | Database                                    |
| -------------------------------------- | ------------------------------------------- |
| `task`, `taskId`                       | table `objectives`, column `objective_id`   |
| `responsiblePersonIds`                 | `person_objectives` / `person_requirements` |
| `properties` (list of `{code, value}`) | `key_value_pairs` (flat object)             |
| `priority` as an enum                  | `objectives.priority` as an integer         |

This is deliberate — the database is not rewritten to match a naming change — but it means
you will read `objective` in the schema and `task` in the contract. They are the same thing.

## What is not here

- **No JetStream.** The protocol is direct request/reply. A lost command is a lost command;
  there are no retries and no distributed transaction. See
  [known-limitations.md](known-limitations.md).
- **No separate schema versioning.** Migrations under `api/db-upgrade/migrations/` run on
  startup and are expected to be additive.
