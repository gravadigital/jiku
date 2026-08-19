# Deploy

How to run Jiku: on a development machine and on a server.

```
deploy/
├── local.sh                  brings the whole stack up on this machine
├── service-user-key.sh       prepares a service user key for the .env
├── zitadel-token.sh          diagnoses a key against Zitadel
├── bus-inspect.sh            look at what is happening on the bus
├── .env.dist                 variable template — copy to .env
├── docker-compose.local.yml  development: builds from the repo
├── docker-compose.yml        production: pulls images from the registry
├── docker-compose.dev.yml    no external dependencies (mock IdP)
└── nats/
    ├── nats-server.conf
    ├── auth-callout/         rules.yaml + templates/ (access policy)
    └── creds/                NATS identity — NOT versioned
```

**Nothing needed to run the stack lives outside `deploy/`.** Secrets go in `deploy/.env` and
in `deploy/nats/creds/`, neither of them versioned.

---

## Getting started

Four steps. The first three are one-time.

### 1. Variables

```sh
cd deploy
cp .env.dist .env
```

Fill in, in `.env`:

| Variable                                      | What goes in it                                                        |
| --------------------------------------------- | ---------------------------------------------------------------------- |
| `DATABASE_PASSWORD`                           | password of the database owner                                         |
| `DATABASE_READONLY_PASSWORD`                  | password of the api's read-only user                                   |
| `IDENTITY_CLIENT_ID`, `IDENTITY_PROJECT_ID`   | the Zitadel application the frontends use                              |
| `GESTION_ZITADEL_PROJECT_ID`                  | the project where the roles live                                       |
| `WEB_NEXTAUTH_SECRET`, `OPUS_NEXTAUTH_SECRET` | `openssl rand -base64 32`                                              |
| `CORE_TRUSTED_PUBLISHER_ID`                   | the `userId` from the api's service user JSON key — **core will not start without it** |
| `STORAGE_S3_*`                                | S3-compatible storage. **core** signs both uploads and downloads, so the credentials need read **and** write permission. Any value works locally until something actually uploads a file. |
| `DUMP_FILE`                                   | optional: a `.sql` to preload the database                             |

### 2. Zitadel service users

api and core each connect to the bus with their own machine user. In Zitadel you need:

- A **machine user** for each service, with **Access Token Type = JWT**. The default is
  `Bearer`, which issues opaque tokens that the auth-callout rejects.
- The matching **role** on the `GESTION_ZITADEL_PROJECT_ID` project: `internal-app` for the
  api, `core` for core.
- A **JSON key** for each: Keys → New → JSON.

With those two keys:

```sh
./service-user-key.sh api  ~/Downloads/api-su.json
./service-user-key.sh core ~/Downloads/core-su.json
```

The script verifies the key against Zitadel — that the token is a JWT and carries the right
role — and writes it into `.env` base64-encoded.

Keep the api's `.json` at least until `CORE_TRUSTED_PUBLISHER_ID` is filled in: its `userId`
field is that variable's value. Core compares it against the subject's `caller` to tell the
api's channel from an external publisher's — get it wrong and every upload is attributed to
the api's service user instead of the person, and nobody can link what they uploaded. The
only symptom is `file_not_owned`, which looks like a permissions problem. Once that is done,
the `.json` files are no longer needed.

Each service requests its token with that key and renews it before it expires, so there is
nothing to refresh by hand.

### 3. NATS identity

The server runs in operator mode and needs an identity, generated once:

```sh
cd nats
./bootstrap.sh          # requires nsc
```

Details in [nats/creds/README.md](nats/creds/README.md). None of it is versioned, so **keep a
copy**: regenerating it forces reissuing the credentials of every service.

Without `nats/creds/nats-resolver.conf` the server does not start.

### 4. Bring it up

```sh
./local.sh up
```

| Service          | URL                   |
| ---------------- | --------------------- |
| web              | http://localhost:3000 |
| opus-web         | http://localhost:3001 |
| api              | http://localhost:3100 |
| NATS (monitoring)| http://localhost:8222 |

`./local.sh down` takes everything down and deletes the data. `./local.sh logs api` follows
one service's logs.

---

## On a server

Same shape, with `docker-compose.yml`, which pulls images instead of building:

```sh
cp .env.dist .env      # fill in, including each service's version
./service-user-key.sh api  <key.json>
./service-user-key.sh core <key.json>
cd nats && ./bootstrap.sh && cd ..    # or copy an already-generated creds/
docker compose pull
docker compose up -d
```

Differences from the local environment:

- Requires two external networks: the ingress one (`INGRESS_NETWORK`) and the database one
  (`DATABASE_NETWORK`).
- Versions are pinned per service (`API_VERSION`, `CORE_VERSION`, …), so core can be deployed
  without touching the frontends. Setting them to `dev` tracks the tip of the `dev` branch,
  which is republished on every push — handy for a staging environment, with no stability
  promise. `dev-<commit-sha>` pins one specific dev build.
- The read-only user has to be created by hand (SQL below); `local.sh` does it on its own, but
  the production compose does not.

---

## How the secrets are split

| What                                              | Where                       | Versioned |
| ------------------------------------------------- | --------------------------- | --------- |
| Passwords, client ids, service user keys          | `deploy/.env`               | no        |
| NATS identity (operator, accounts, sentinels)     | `deploy/nats/creds/`        | no        |
| Bus access policy (roles → permissions)           | `deploy/nats/auth-callout/` | **yes**   |

The access policy is versioned on purpose: it is a product decision, not a secret.

### The read-only user

The api connects as `DATABASE_READONLY_USER`. `local.sh` creates it; on a server it has to be
done once:

```sql
CREATE USER jiku_readonly WITH PASSWORD '...';
GRANT CONNECT ON DATABASE jiku TO jiku_readonly;
GRANT USAGE ON SCHEMA public TO jiku_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO jiku_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO jiku_readonly;
```

That last line matters: without it, tables created by a future migration are inaccessible to
the api.

**Migrations are the exception**: the api runs them at startup and they need to write, so they
use `POSTGRESQL_MIGRATION_USER` (the database owner).

---

## Diagnosis

### `Errors.App.NotFound` when logging into a frontend

Zitadel does not recognise the `client_id`: the **application** does not exist or was
recreated. The _project_ may well exist — they are different things.

```sh
curl -s "https://<your-zitadel-instance>/oauth/v2/authorize?client_id=<CLIENT_ID>\
&redirect_uri=http%3A%2F%2Flocalhost%3A3001%2Fapi%2Fauth%2Fcallback%2Fzitadel\
&response_type=code&scope=openid" -o /dev/null -w "%{http_code}\n"
```

`302` = the app exists. `400` = it does not.

The application has to be of type **User Agent / PKCE** (the frontends use no client secret)
and declare the exact redirect URI:
`http://localhost:3000/api/auth/callback/zitadel` for web, `:3001` for opus-web.

### `Authorization Violation` when connecting to the bus

The service user's token is no good. To see why:

```sh
./zitadel-token.sh --check <key.json>
```

It reports whether the token is a JWT or opaque, when it expires and which roles it carries.
The two usual causes: the machine user issues opaque tokens (Access Token Type = Bearer), or
it is missing the role.

### Inspecting the bus

```sh
./bus-inspect.sh status                            # connections and counters
./bus-inspect.sh logs                              # commands core processed
./bus-inspect.sh tail                              # live
./bus-inspect.sh send clients.new '{"name":"X"}'   # publish one by hand
```

`tail` and `logs` read core's trace, which with `LOG_COMMANDS=true` prints each command and
its reply:

```
[cmd] clients.new <- {"name":"Test"}
[cmd] clients.new -> {"status":"success","data":{"id":10}}
```

Off by default: the payload carries business data.

**A `nats sub` is no good for eavesdropping.** The permissions the auth-callout mints are
deliberately narrow: `internal-app` only publishes under its own session and `core` only
listens on its endpoint. That is what the `bus-observer` role in
[nats/auth-callout/templates/observer.yaml](nats/auth-callout/templates/observer.yaml) is for,
which listens to everything without being able to publish. It needs a service user with that
role and is **for local environments only**: it would read the contents of every command.

---

## Without external dependencies

`docker-compose.dev.yml` brings the stack up with the callout's `mock` IdP, with no Zitadel and
no network. Tokens have the form `mock:<sub>:<username>:<roles>`.

```sh
cp .env.dist .env
docker compose -f docker-compose.dev.yml up --build
```

web on 3001, opus-web on 3002, NATS on 4222, PostgreSQL on 5432.

---

## Notes

- **The api runs the migrations** at startup, with `POSTGRESQL_MIGRATION_USER`.
- **auth-callout does not live in this repo**: it is consumed as an image published on Docker
  Hub (`gravadigital/nats-zitadel-auth-callout`), and it ships **only the callout** — the NATS
  server is a compose service of its own. What is here is its configuration
  (`nats/auth-callout/`), mounted by path and read at startup.
- **JetStream is off**: the protocol is direct request/reply.
