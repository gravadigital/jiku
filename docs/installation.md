# Installation

Two different things are covered here: setting up a development environment, and running the
whole stack. For what each variable means, see [configuration.md](configuration.md).

## Requirements

|                               |                                                                                                            |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Node.js 24**                | see [`.nvmrc`](../.nvmrc)                                                                                  |
| **Docker**                    | required for the stack, and also for the `api` and `core` test suites, which start an ephemeral PostgreSQL |
| **PostgreSQL 15**             | provided by the composes; only needed separately for a production deployment                               |
| **An OIDC identity provider** | Jiku does not manage users. See [below](#the-identity-provider).                                           |

## Development

```sh
git clone https://github.com/gravadigital/jiku.git
cd jiku
npm install
```

That is one install for the whole monorepo: the four services and the shared packages.
`npm install` also compiles `packages/*`, which `api` and `core` import from `dist/` — skip
that and they fail with errors that do not point at the real cause.

```sh
npm run build   # compiles the shared packages, then api and core
npm test        # test suites of all four projects
npm run lint
```

To work on a single project: `npm run <script> --workspace <name>`, where the names are
`@jiku/api`, `@jiku/core`, `web` and `opus-web`.

## Running the stack

### Three prerequisites

**1. The NATS identity.** The server runs in operator mode, which the auth-callout requires,
and needs a resolver configuration plus sentinel credentials. `deploy/nats/creds/` ships only a
README, because none of it is versioned. Generate it once:

```sh
cd deploy/nats
./bootstrap.sh          # requires nsc
```

**Without `nats-resolver.conf` the NATS server does not start**, and without NATS nothing
writes. Details in [`deploy/nats/creds/README.md`](../deploy/nats/creds/README.md).

Run it **once per installation**: regenerating the identity invalidates every credential
already distributed. Keep a backup of `deploy/nats/creds/`.

**2. Two service users in the identity provider**, one for `api` and one for `core`, each with
a JSON key. See [below](#the-identity-provider).

**3. A `.sql` with the database schema.** The migrations modify an existing schema rather than
creating it, so a new installation needs one loaded before the first start — point `DUMP_FILE`
at it in `deploy/.env`. See [known-limitations.md](known-limitations.md).

### The three composes

They are not variations on a theme — pick by what you are doing:

| Compose                    | For                                              | Identity provider         | Ports                             |
| -------------------------- | ------------------------------------------------ | ------------------------- | --------------------------------- |
| `docker-compose.dev.yml`   | working without a real identity provider         | the callout's `mock` mode | web 3001, opus-web 3002, api 3000 |
| `docker-compose.local.yml` | the full stack on your machine, via `./local.sh` | real                      | web 3000, opus-web 3001, api 3100 |
| `docker-compose.yml`       | a server                                         | real                      | behind a reverse proxy            |

> **The ports differ between the first two.** If you switch composes and a frontend cannot
> reach the API, that is usually why.

### On your machine

```sh
cd deploy
cp .env.dist .env      # fill in the values
./local.sh up
```

`./local.sh up` waits for PostgreSQL, creates the read-only role the API needs, optionally
loads a dump (`DUMP_FILE`), and brings everything up. `./local.sh down` tears it down and
deletes the data; `./local.sh logs api` follows one service.

Once the service-user keys exist:

```sh
./service-user-key.sh api  <path-to-api-key.json>
./service-user-key.sh core <path-to-core-key.json>
```

The script validates each key against the identity provider — that the token is a JWT and
carries the right role — and writes it into `.env` base64-encoded. The JSON files are not
needed afterwards.

### Without an identity provider

`docker-compose.dev.yml` runs the callout in `mock` mode: an in-process identity provider
that decodes the identity from the token text, with no secrets and no network. Tokens look
like `mock:<sub>:<username>:<roles>`.

```sh
cd deploy
cp .env.dist .env
docker compose -f docker-compose.dev.yml up --build
```

**The NATS identity is still required** even in mock mode: it belongs to the server, not to
the identity provider.

### On a server

```sh
cp .env.dist .env      # fill in, including the per-service versions
./service-user-key.sh api  <key.json>
./service-user-key.sh core <key.json>
# copy the generated nats/creds/ into place
docker compose pull
docker compose up -d
```

Differences from a local run:

- Two external networks are required: the ingress network and the database network.
- Versions are pinned per service (`API_VERSION`, `CORE_VERSION`, …), so `core` can be
  redeployed without touching the frontends.
- **The read-only role is not created for you.** `local.sh` does it; the production compose
  does not. See below.

## The read-only database role

This is what makes "the API does not write" a guarantee rather than a convention. Create it
once:

```sql
CREATE USER jiku_readonly WITH PASSWORD '...';
GRANT CONNECT ON DATABASE jiku TO jiku_readonly;
GRANT USAGE ON SCHEMA public TO jiku_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO jiku_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO jiku_readonly;
```

**The last line matters.** Without it, tables created by a future migration are invisible to
the API, and the failure shows up long after the change that caused it.

Migrations are the exception to the read-only rule: they run on API startup and do write, so
they use `POSTGRESQL_MIGRATION_USER` — the database owner.

## The identity provider

Jiku authenticates against an OIDC provider and reads roles from a token claim. It has
been developed against [Zitadel](https://zitadel.com); anything that issues JWT access
tokens with a roles claim should work, but nothing else has been tested.

What has to exist there:

**For the frontends** — an application of type _User Agent / PKCE_ (they use no client
secret), declaring the exact redirect URIs:
`http://localhost:3000/api/auth/callback/zitadel` for `web`, `:3001` for `opus-web`.

**For the services** — a machine user each for `api` and `core`, with:

- **Access Token Type = JWT.** The default is `Bearer`, which issues opaque tokens the
  auth-callout rejects.
- The matching role on the project: `internal-app` for the API, `core` for core.
- A JSON key (Keys → New → JSON).

**Roles** used by the HTTP API: `user`, `admin`, `external-user`. They arrive as the claim
`urn:zitadel:iam:org:project:<PROJECT_ID>:roles`.

## Troubleshooting

### `Errors.App.NotFound` when logging in

The provider does not recognise the `client_id`: the _application_ does not exist or was
recreated. The _project_ can still exist — they are different objects.

```sh
curl -s "https://<your-idp>/oauth/v2/authorize?client_id=<CLIENT_ID>\
&redirect_uri=http%3A%2F%2Flocalhost%3A3001%2Fapi%2Fauth%2Fcallback%2Fzitadel\
&response_type=code&scope=openid" -o /dev/null -w "%{http_code}\n"
```

`302` means the application exists, `400` that it does not.

### `Authorization Violation` when connecting to the bus

The service user's token is not accepted:

```sh
./zitadel-token.sh --check <key.json>
```

It reports whether the token is a JWT or opaque, when it expires and which roles it carries.
The two usual causes: the machine user issues opaque tokens (Access Token Type = Bearer), or
it is missing the role.

### The API starts and rejects everything with `user_not_found`

Authentication succeeded but that identity is not in the `users` table. Jiku does not
create users — see [known-limitations.md](known-limitations.md).

### The API refuses to start complaining about `IDENTITY_URL`

That is deliberate. Without an identity provider configured and without an explicit
`AUTH_BYPASS=true`, the API refuses to start rather than run without validating tokens. See
[configuration.md](configuration.md).

### Inspecting the bus

```sh
./bus-inspect.sh status                            # connections and counters
./bus-inspect.sh logs                              # commands core processed
./bus-inspect.sh tail                              # live
./bus-inspect.sh send clients.new '{"name":"X"}'   # publish one by hand
```

`tail` and `logs` read core's trace, which prints each command and its reply when
`LOG_COMMANDS=true`. It is off by default because payloads carry business data.

**A plain `nats sub` will not work as a spy.** The minted permissions are deliberately
narrow. For that there is the `bus-observer` role, which can listen to everything without
publishing — and which must only be used locally, because it reads every command's contents.
