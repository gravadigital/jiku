# core

Bus worker: **the only service that writes to the database**.

It handles the commands the API publishes, validates business rules and writes. It exposes no
HTTP and validates neither tokens nor roles — that is the API's job.

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
NATS ──> jiku-commands ──> Dispatcher      ──> Command ──> database (owner user)
                           (transaction)       (validates and writes)

NATS ──> jiku-queries  ──> QueryDispatcher ──> Query   ──> database (read-only role)
                           (NO transaction)    (explicit SQL, no ORM)
```

| Piece                     | Responsibility                                                          |
| ------------------------- | ----------------------------------------------------------------------- |
| `src/bus/host.ts`         | opens the connection and registers the micro services                   |
| `src/bus/service.ts`      | registers a micro service from a spec: endpoints, queue group and reply |
| `src/bus/dispatcher.ts`   | resolves the command, opens the transaction, replies                    |
| `src/commands/`           | one file per command                                                    |
| `src/queries/`            | registry + dispatcher (**no transaction**) + the 6 read endpoints       |
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

More on the design in [documentation/README.md](../documentation/README.md).

## Adding a command

1. Create the file under `src/commands/<entity>/`, implementing the `Command` interface.
2. Register it in `src/commands/index.ts`.
3. Write its tests in `tests/commands/`.

The `pattern` has to match the subject in the protocol document. Variable segments go in
braces: `clients.{id}.edit`.

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
