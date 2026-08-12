# core

NATS consumer: **the only service that writes to the database**.

It handles the commands the API publishes, validates business rules and writes. It exposes no
HTTP and validates neither tokens nor roles — that is the API's job.

The contract is [docs/apis/core.yaml](../docs/apis/core.yaml).
**When the code and that document disagree, the document wins.**

## How it works

```
NATS ──> Consumer ──> Dispatcher ──> Command ──> database
                      (transaction)  (validates and writes)
```

| Piece                   | Responsibility                                       |
| ----------------------- | ---------------------------------------------------- |
| `src/bus/consumer.ts`   | connects to the bus, subscribes with a queue group   |
| `src/bus/dispatcher.ts` | resolves the command, opens the transaction, replies |
| `src/commands/`         | one file per command                                 |
| `src/models/`           | registers the models from `@jiku/models`             |

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
| `NATS_SERVICE_NAME`                        | which service it answers for                                                                                                                                                                                                            |
| `NATS_PROTOCOL_VERSION`                    | protocol version (`v1`)                                                                                                                                                                                                                 |
| `LOG_COMMANDS`                             | prints each command and its reply. Off by default: payloads carry business data.                                                                                                                                                        |

Full reference in [documentation/configuration.md](../documentation/configuration.md).

## Migrations

The API runs them on startup, with its own credentials. Core does not touch them: the schema
has a single owner.
