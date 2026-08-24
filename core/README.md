# core

Bus worker: **the only service that writes to the database**.

It handles the commands the API publishes, validates business rules and writes. It exposes no HTTP
and validates no tokens — that is the API's job. **Since REQ-005 it does know about roles**, but
only to authorise the **caller** of a subject: see [the authorisation gate](#the-authorisation-gate).

**One process, two micro services, one NATS connection.** `jiku-commands` serves the 20 domain
commands; `jiku-queries` serves the 6 read endpoints. They are announced separately in `$SRV`, each
with its own id, its own queue group and its own counters, so read traffic and write traffic do not
share load balancing — but they live in the same image, on the same connection, and scale together.

The command contract is [docs/apis/core.yaml](../docs/apis/core.yaml).
**When the code and that document disagree, the document wins.**

**The contract of `jiku-queries` is out of scope of that spec**, and of this README, until the
requirement that defines it lands. The 6 endpoints exist, are discoverable in
`nats micro info jiku-queries` and **answer a well-formed `failure`** to any request — they never
go unanswered, and they never return invented data. Filters, pagination and fields are not
described here because they do not exist yet.

## How it works

```
NATS ──> jiku-commands ──> authorizeCaller ──> Dispatcher      ──> Command ──> database (owner)
                           (the gate)          (transaction)       (validates and writes)

NATS ──> jiku-queries  ──> authorizeCaller ──> QueryDispatcher ──> Query   ──> database (read-only)
                           (the gate)          (NO transaction)    (explicit SQL, no ORM)

NATS ──> {instance}.events.auth ──> EventDispatcher ──> syncUser ──> database (owner user)
         (flat subscription,        (transaction)       (mirrors the identity)
          no reply)
```

| Piece                     | Responsibility                                                          |
| ------------------------- | ----------------------------------------------------------------------- |
| `src/bus/host.ts`         | opens the connection, registers the micro services and subscribes to the event |
| `src/bus/service.ts`      | registers a micro service from a spec: endpoints, queue group and reply |
| `src/authorize-caller.ts` | the role → method map and **the authorisation gate**, shared by both planes |
| `src/bus/dispatcher.ts`   | authorises the caller, resolves the command, opens the transaction, replies |
| `src/commands/`           | one file per command                                                    |
| `src/queries/`            | registry + dispatcher (**authorises, no transaction**) + the 6 read endpoints |
| `src/events/`             | the event dispatcher (guards + transaction + outcome) and its handlers   |
| `src/models/`             | registers the models from `@jiku/models` on the **owner** connection    |
| `src/models/read.ts`      | the **read-only** connection — **without models**, own pool and timeout |

Each command pattern in the registry becomes **one micro endpoint**, so the subject matching is
done by the server instead of inside the process: `nats micro info jiku-commands` lists them all.
The same holds for the 6 query patterns under `nats micro info jiku-queries`.

**`src/models/read.ts` is created without registering the models, and that is the most important
line of the module.** `@jiku/models` exports classes that get registered on **one** Sequelize
instance (ADR-005), which worked because api and core were separate processes. Two instances in the
**same** process fight over the classes: the second one to register them **reassigns** them. In the
bad direction — queries going out through the owner user — ADR-001 stops holding **with no symptom
at all**. That is why queries use explicit SQL (`ctx.db.query(...)`) instead of the ORM, with
**allow-lists for names** and **parameters for values**.

**Queries do not open a transaction** (one read does not need atomicity, and a transaction per
request would take and hold a snapshot for every query). A query that needs consistency across
several reads opens an explicit `READ ONLY` transaction inside itself.

**Metrics have two known limits, and they matter before you build a dashboard.**
`num_errors` stays at **0**: a business failure is answered with `respondError()`, which does not
increment it — micro only counts an error when the handler throws, and the handler never throws
because that would lose the reply envelope from the body. Measure failures by logs and by
`errorCode`, and **do not set alerts on `num_errors`**.
`processing_time` and `average_processing_time` are per endpoint but do **not** measure how long
a command takes: micro samples the latency synchronously, right after handing the message over,
and the handler returns immediately so the next message is not blocked.

**The dispatcher owns the transaction**: it commits when a command replies `success`, and rolls
back otherwise. Commands never open or close it, which is what makes it impossible to leave a
half-written change by forgetting a rollback.

**The dispatcher never throws.** An unexpected error becomes an error `Reply` — there is a
request waiting, and silence would hang the API until its timeout.

### The authorisation gate

**Both dispatchers authorise the CALLER of the subject before resolving the method and before
opening the transaction.** It is the product's second line of defence: until REQ-005 the bus access
policy minted by the `auth-callout` was the only one, and `docs/prd/architecture.md` said so
explicitly.

```
caller == CORE_TRUSTED_PUBLISHER_ID  -> passes WITHOUT touching the database
otherwise                            -> User.findByPk(caller)
                                          no row                         -> caller_not_authorized
                                          row, no role allows the method -> caller_not_authorized
```

The map of role → method lives in `src/authorize-caller.ts`, is a module constant and is
**deny-by-default** (ADR-008): anything absent from it authorises nothing.

| Role                            | Commands | Queries | Why                                        |
| ------------------------------- | -------- | ------- | ------------------------------------------ |
| `internal-app`                  | —        | —       | **exempt by `sub`, not by role** (see below) |
| `external-publisher`            | the 9    | none    | mirrors its callout template                |
| `admin` · `user` · `external-user` | none  | all     | the business rules live in the api          |
| `core` · `bus-observer`         | none     | none    | core does not call itself; the observer does not publish |
| *(empty list, or unknown role)* | none     | none    | no match, no authorisation                  |

**Why the api's channel is exempt, and why it is not a shortcut.** Without the exemption there is a
**silent total write outage**: if the api connects to the bus before core is subscribed, its
authentication event is **lost** (plain core NATS — no stream, no retry, no record), the api stays
connected and functional **with no row in `users`**, and core refuses **all 20 commands**. The
symptom is a 403 on every write in the product; the cause is a message lost hours ago, which fixes
itself "when the api reconnects" — with a hot-renewed ~1 h token, possibly not for days. The api
also **already authorises by role** (`hasAnyRole`) before publishing, so consulting `users.roles`
for its service user would authorise the same thing twice from two sources, with the worse of the
two deciding. The exemption reuses the very constant and branch `resolveActor` already has, and it
is a **string comparison**: the hot path pays neither a query nor a millisecond.

**Product roles authorise no command, on purpose.** Core does not hold the business rules that
depend on the end user — the worked-hours window, who may charge hours to someone else, the frozen
past weeks of assignment. They live in the api. Enabling commands for people is its own requirement.

**There is no cache.** Every non-exempt caller pays its own `findByPk`. Caching would reintroduce
stale roles with an extra, unmeasurable window in order to save a by-PK `SELECT` that the hot path
never runs. The consequence is the one to know: **revoking a role in Zitadel takes effect
immediately on the HTTP plane and only eventually on the bus plane** — the row keeps the previous
roles until that identity authenticates again, and established connections are not invalidated.

**A new role with bus access is TWO changes, not one:** this map **and** its `auth-callout`
template. A role missing from the map authorises nothing — the correct default — but the symptom is
"I gave them the role and they can do nothing", so it helps to know where to look. The same goes the
other way: the 9 subjects of `external-publisher` are enumerated in the map **and** in
`deploy/nats/auth-callout/templates/external-publisher.yaml`, with nothing technical keeping them in
sync. That is the accepted price of defence in depth.

**A rejection answers `caller_not_authorized` (403 in the api) and logs one `warn` prefixed
`[auth]`** with the caller and the method — never the payload. The **same** code and the **same**
message for "no row" and "role not allowed": telling them apart would leak to an unauthorised caller
whether an identity exists in the database. The gate **never throws** and **fails closed**: if it
cannot decide (database down, config not loaded) it answers `internal_error` rather than letting the
message through.

### The event consumer

Core also **consumes** one event: `{instance}.events.auth`, published by the `auth-callout` every
time an identity — a person or a service user — authenticates on the bus. The handler mirrors that
identity into `users`: name, username, email, roles and identity type, **replacing all five every
time**. It is not a partial edit — the event carries the whole identity and Zitadel is the truth.
**Core still does not publish anything**: consuming is a different thing.

**It is a flat subscription with a queue group, not a micro endpoint.** Micro is request/reply and
requires every endpoint to answer; `respond()` on a message with no `reply` subject is a **silent
no-op** that also pollutes the `$SRV` counters. So `nats micro ls` keeps showing exactly two
services. The subject is the **literal** one the `authEventSubject()` helper derives — never a
wildcard.

**Its permission is that literal subject in `templates/core.yaml` › `sub.allow`, and without that
line core starts, serves the 20 commands, logs `[events] suscripto a …` and receives nothing.**
`subscribe()` does not fail when the subject is not authorized: the NATS client does not check
subscription permissions locally, and the violation shows up in the **server's** log, not in
core's. That log line is what separates "it did not subscribe" from "it subscribed and nothing
arrives" — three different causes give the same symptom, and the other one is a misaligned
`NATS_INSTANCE`, which the `warn` prints **with both values**.

**Delivery is not durable, and that is accepted.** `CALLOUT_EVENTS_STREAM` is deliberately left
undefined in the compose, so the message is plain core NATS: no stream, no ack, no retry. If core
is down when an identity authenticates, **the event is lost with no retry, no reconciliation and no
record** — the row stays stale until that identity authenticates again. The cause is the missing
variable in the deployment, **not core's code**.

More on the design in [documentation/README.md](../documentation/README.md).

## Adding a command

1. Create the file under `src/commands/<entity>/`, implementing the `Command` interface.
2. Register it in `src/commands/index.ts`.
3. Write its tests in `tests/commands/`.

The `pattern` has to match the subject in the protocol document. Variable segments go in
braces: `clients.{id}.edit`.

**A new command is NOT authorised for the external connector just by existing.** Only the api's
channel is exempt from the gate; every other caller is authorised against the role → method map. To
let the external connector publish a new command, add it in **two** places — `ROLE_METHODS` in
`src/authorize-caller.ts` **and** `deploy/nats/auth-callout/templates/external-publisher.yaml` — and
**in the same commit**. Adding it to only one of the two gives a rejection in the transport or a
`caller_not_authorized` from the gate, depending on which one you forgot.

**Query patterns never take braces.** `projects.list`, `tasks.get` — the resource id travels **in
the payload**, not in the subject. That is a performance decision, not an oversight: the server
matches with a trie plus a **1024-entry subject cache**, read traffic is the higher-volume one, and
a new subject per id consulted would make the cache useless. The requirement that defines the query
contract has to respect it.

## Tests

They run on TypeScript directly and start an ephemeral PostgreSQL in Docker.

```sh
npm test                                       # all
npx mocha tests/commands/clients.test.ts       # one file
```

They run against a **real database**, with no Sequelize mocks. That is deliberate: it is what
verifies a command stores exactly what the API used to store.

| Variable       | Effect                                                             |
| -------------- | ------------------------------------------------------------------ |
| `KEEP_DB=true` | leaves the container running so the next run starts faster         |
| `CI=true`      | does not start a container; uses the database from the environment |

## Configuration

| Variable                                   | Purpose                                                                                                                                                                                                                                 |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POSTGRESQL_*`                             | database connection of the **commands**. Core writes, so it uses the **owner** user. No pool is declared, so it runs on Sequelize's implicit `max: 5` — see `POSTGRESQL_READ_POOL_MAX`.                                                    |
| `POSTGRESQL_READ_USER`                     | role of the **read-only** connection of the queries (`src/models/read.ts`). No default. **It may be the same read-only role the api already uses** — and in the deployment it is: [deploy/.env.dist](../deploy/.env.dist) wires it from `DATABASE_READONLY_USER` rather than duplicating the secret. **The one thing it must not be is the owner user**: if it were, the ADR-001 guarantee disappears **silently** — everything keeps working and reads stop being read-only. |
| `POSTGRESQL_READ_PASSWORD`                 | its password. No default; same source as above.                                                                                                                                                                                          |
| `POSTGRESQL_READ_POOL_MAX`                 | connection ceiling of the **read** pool, default `10`. The write pool declares none, so it runs on Sequelize's implicit `max: 5`. **The asymmetry is deliberate:** a read holds a connection for one statement, a write holds it for a whole transaction, and reads are the higher-volume traffic. **Total per replica: 15.** Check it against the installation's `max_connections` before raising this. |
| `POSTGRESQL_STATEMENT_TIMEOUT_MS`          | statement cutoff of the read-only connection, default `8000`. **Invariant: strictly lower than `NATS_QUERY_TIMEOUT_MS`** (10000, read by the api). The database has to cut first, or the bus timeout is what expires and the caller waits without ever learning why; with the database cutting first, core answers a `failure` with a code and the error is explainable. Both sections of [deploy/.env.dist](../deploy/.env.dist) say so — **if you raise one, check the other**. |
| `NATS_URL`                                 | the bus                                                                                                                                                                                                                                 |
| `NATS_CREDS`                               | path to the sentinel credentials                                                                                                                                                                                                        |
| `ZITADEL_SERVICE_USER_KEY_B64`             | core's service-user key, base64-encoded. **Without it the connection is rejected**: the sentinel credentials grant nothing by themselves — the token is what triggers the auth-callout, which reads the role and mints the permissions. |
| `ZITADEL_ISSUER_URL`, `ZITADEL_PROJECT_ID` | where to request the token, and the project holding the roles                                                                                                                                                                           |
| `NATS_INSTANCE`                            | first subject segment (`dev`, `prod`)                                                                                                                                                                                                   |
| `NATS_COMMAND_SERVICE`                     | the `{svc}` token of the command subject: `jiku-commands`                                                                                                                                                                               |
| `NATS_QUERY_SERVICE`                       | the `{svc}` token of the **query** subject: `jiku-queries`. Also the queue group of the second micro service. The separation lives in this token and not nested under the command one because the command subscription ends in `>`, which would swallow the queries too — two queue groups over overlapping subjects put two replies in the same inbox and one gets discarded in silence. |
| `SERVICE_VERSION`                          | version the service announces on the bus, default `1.0.0`. **Strict SemVer**: micro rejects the registration with anything else, so an invalid value (`latest`) **kills startup** instead of degrading silently. Declared in [deploy/.env.dist](../deploy/.env.dist). |
| `NATS_PROTOCOL_VERSION`                    | protocol version (`v1`)                                                                                                                                                                                                                 |
| `NATS_EVENTS_QUEUE`                        | queue group of the flat subscription to `{instance}.events.auth`, default `jiku-events`. **With N replicas and no queue group, all N would write the same row**: the mirroring is idempotent, so it is an optimisation rather than a correctness need, but two concurrent `UPDATE`s on the same row are a pointless lock. There is **no** variable for the subject: it is derived from `NATS_INSTANCE` by the protocol package, because one that could override it would let the code drift from the callout's permission **with no symptom at all**. |
| `LOG_COMMANDS`                             | prints each command and its reply. Off by default: payloads carry business data.                                                                                                                                                        |
| `CORE_TRUSTED_PUBLISHER_ID`                | the `sub` of the api's service user. Core compares the subject's `caller` against it to tell the api's channel from an external publisher's. **Core fails to start without it** — an empty value would send every command down the external branch, leaving `files.uploaded_by` with the api's service user instead of the person, so nobody could link what they uploaded. |
| `STORAGE_S3_ENDPOINT`                      | S3-compatible provider endpoint (AWS S3, MinIO, Spaces, R2). No default: it depends on each installation.                                                                                                                                |
| `STORAGE_S3_CREDENTIALS_ACCESSKEY`         | signing credential. Core signs **both** PUT and GET presigned URLs, so it needs read and write permission.                                                                                                                               |
| `STORAGE_S3_CREDENTIALS_SECRETKEY`         | signing credential                                                                                                                                                                                                                      |
| `STORAGE_S3_BUCKETNAME`                    | bucket. No default.                                                                                                                                                                                                                     |
| `STORAGE_S3_REGION`                        | region. No default.                                                                                                                                                                                                                     |
| `STORAGE_S3_FORCEPATHSTYLE`                | `'true'` for MinIO and compatibles                                                                                                                                                                                                      |
| `STORAGE_S3_KEY_PREFIX`                    | key prefix, default `grava-gestion`. **Do not change it on an installation that already has data** — see the warning in [deploy/.env.dist](../deploy/.env.dist), which is where this is documented in full.                               |

Full reference in [documentation/configuration.md](../documentation/configuration.md).

## Migrations

The API runs them on startup, with its own credentials. Core does not touch them: the schema
has a single owner.
