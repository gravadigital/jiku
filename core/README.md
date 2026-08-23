# core

NATS consumer: **the only service that writes to the database**.

It handles the commands the API publishes, validates business rules and writes. It exposes no
HTTP and validates neither tokens nor roles — that is the API's job.

The contract is [docs/apis/core.yaml](../docs/apis/core.yaml).
**When the code and that document disagree, the document wins.**

## How it works

```
NATS ──> Service ──> Dispatcher ──> Command ──> database
                     (transaction)  (validates and writes)
```

| Piece                   | Responsibility                                                            |
| ----------------------- | ------------------------------------------------------------------------- |
| `src/bus/host.ts`       | opens the connection and registers the micro services                     |
| `src/bus/service.ts`    | registers a micro service from a spec: endpoints, queue group and reply   |
| `src/bus/dispatcher.ts` | resolves the command, opens the transaction, replies                      |
| `src/commands/`         | one file per command                                                      |
| `src/models/`           | registers the models from `@jiku/models`                                  |

Each command pattern in the registry becomes **one micro endpoint**, so the subject matching is
done by the server instead of inside the process: `nats micro info jiku-commands` lists them all.

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
| `POSTGRESQL_*`                             | database connection. Core writes, so it uses the full-privilege user.                                                                                                                                                                   |
| `NATS_URL`                                 | the bus                                                                                                                                                                                                                                 |
| `NATS_CREDS`                               | path to the sentinel credentials                                                                                                                                                                                                        |
| `ZITADEL_SERVICE_USER_KEY_B64`             | core's service-user key, base64-encoded. **Without it the connection is rejected**: the sentinel credentials grant nothing by themselves — the token is what triggers the auth-callout, which reads the role and mints the permissions. |
| `ZITADEL_ISSUER_URL`, `ZITADEL_PROJECT_ID` | where to request the token, and the project holding the roles                                                                                                                                                                           |
| `NATS_INSTANCE`                            | first subject segment (`dev`, `prod`)                                                                                                                                                                                                   |
| `NATS_COMMAND_SERVICE`                     | the `{svc}` token of the command subject: `jiku-commands`                                                                                                                                                                               |
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
