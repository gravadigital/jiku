# api

HTTP service. Authenticates, authorises by role, **reads the database directly**, and turns
every mutation into a command published on NATS.

It cannot write: it connects with a database role that only holds `SELECT`. That is what makes
the read/write split a guarantee rather than a convention — see
[documentation/README.md](../documentation/README.md).

**Migrations are the exception.** They run on startup and do write, using a separate set of
credentials (`POSTGRESQL_MIGRATION_USER`).

## Layout

| Path                     | Contents                                                        |
| ------------------------ | --------------------------------------------------------------- |
| `app.ts`                 | Express setup, global middleware, route mounting                |
| `bin/`                   | entry point. Validates the auth configuration before listening. |
| `config/public.ts`       | routes exempt from authentication                               |
| `lib/routes/`            | one file per route, auto-mounted from `lib/routes/index.ts`     |
| `lib/utils/`             | middleware, helpers, the bus client, storage                    |
| `db-upgrade/migrations/` | Sequelize migrations, run on startup                            |

**Authentication is global per HTTP method, not per route.** `app.ts` installs `validateToken`
for every path except the exemptions in `config/public.ts`, built as a negative-lookahead
regex. Deny-by-default, so a route file can look unprotected while being covered.

The endpoint list is in [documentation/api-reference.md](../documentation/api-reference.md).

## Running it

From the repository root, `npm install` covers this service and builds the shared packages it
imports.

```sh
npm run dev --workspace @jiku/api    # watch mode
npm start  --workspace @jiku/api     # runs migrations, then serves
```

It needs a PostgreSQL and, for writes to work, a reachable NATS. To bring up the whole stack
see [documentation/installation.md](../documentation/installation.md).

> The process **refuses to start** if there is no identity provider configured and no explicit
> `AUTH_BYPASS=true`. That is deliberate: it used to start anyway and serve every request as an
> administrator.

## Tests

They run on TypeScript directly and start an ephemeral PostgreSQL in Docker. All you need is
Docker running.

```sh
npm test                                    # all
npx mocha tests/routes/clients-get.test.ts  # one file
npm run test:unit                           # utils only, no database
npm run test:integration                    # routes and configuration
npm run test:coverage
```

Any file works on its own: the schema and the authentication mock are prepared in
`tests/setup-env.ts` and `tests/global-setup.ts`, which Mocha always loads.

| Variable       | Effect                                                             |
| -------------- | ------------------------------------------------------------------ |
| `KEEP_DB=true` | leaves the container running so the next run starts faster         |
| `CI=true`      | does not start a container; uses the database from the environment |

> The first run takes longer (~30s) while the PostgreSQL image downloads.

## Configuration

The variables and what breaks if they are wrong are in
[documentation/configuration.md](../documentation/configuration.md). `.env.dist` is the template for running this
service outside Docker.

## Migrations

`npm start` runs them before serving. To run them alone:

```sh
npm run upgrade-db --workspace @jiku/api
```

They are expected to be **additive**: the schema is not versioned separately from the product.
