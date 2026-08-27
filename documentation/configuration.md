# Configuration

Everything is configured at runtime, in one file: `deploy/.env`, copied from
`deploy/.env.dist`. The published images carry no configuration, so the same image runs in any
installation.

`deploy/.env.dist` has 49 variables with working defaults for a local run. Twelve are blank
and must be filled in.

## The twelve

| Variable | What goes in it |
|---|---|
| `DOMAIN`, `OPUS_DOMAIN` | public hostnames of the two frontends |
| `DATABASE_READONLY_PASSWORD` | password for the read-only user, shared by api and core |
| `IDENTITY_CLIENT_ID`, `IDENTITY_PROJECT_ID` | the identity provider application the frontends use |
| `GESTION_ZITADEL_PROJECT_ID` | the project where the roles live |
| `WEB_NEXTAUTH_SECRET`, `OPUS_NEXTAUTH_SECRET` | `openssl rand -base64 32`, one each |
| `API_SERVICE_USER_KEY_B64`, `CORE_SERVICE_USER_KEY_B64` | the machine-user keys each service uses to reach the bus — `deploy/service-user-key.sh` |
| `CORE_TRUSTED_PUBLISHER_ID` | the `sub` of the api's machine user. **`core` refuses to start without it** — see below |
| `DUMP_FILE` | a `.sql` holding the schema — see [installation.md](installation.md) |

Two more are not in that list but must not keep their defaults on a server:
`DATABASE_PASSWORD` and the `STORAGE_S3_*` credentials.

## Groups worth understanding

**Image versions** — `API_VERSION`, `CORE_VERSION`, `WEB_VERSION`, `OPUS_WEB_VERSION`. Pinned per
service, so core can be redeployed without touching the frontends. A release number (`1.0.0`)
pins that release; `dev` tracks the tip of the `dev` branch and is republished on every push.

**Database** — the api connects read-only; migrations use `POSTGRESQL_MIGRATION_USER`, the owner.
Two sets of credentials for one database, which is what enforces the read/write split. `core`
reuses the same read-only role for the queries it serves over the bus, with a pool and a cutoff
of its own: `POSTGRESQL_READ_POOL_MAX` and `POSTGRESQL_STATEMENT_TIMEOUT_MS`. The statement
timeout must stay **strictly below** `NATS_QUERY_TIMEOUT_MS`, so the database gives up before the
bus does — otherwise a slow query leaves the caller on a timeout that explains nothing.

**Identity** — Jiku authenticates nobody itself. The frontends use an OIDC application (User
Agent / PKCE, no client secret); `api` and `core` each use a machine user to reach the bus, with
**Access Token Type = JWT** — the default `Bearer` issues opaque tokens the bus rejects.

**Bus** — `core` serves **two** services on it: `NATS_COMMAND_SERVICE` (`jiku-commands`, the
writes) and `NATS_QUERY_SERVICE` (`jiku-queries`, the reads), each with its own queue group and
timeout — `NATS_REQUEST_TIMEOUT_MS` and `NATS_QUERY_TIMEOUT_MS`. Renaming either is **not** just
an edit here: the auth-callout authorises those names literally in
`deploy/nats/auth-callout/templates/`, and a mismatch still connects and then fails every publish
with `Authorization Violation`.

`CORE_TRUSTED_PUBLISHER_ID` is how `core` tells the api's channel from any other publisher: on a
match, `core` accepts the `actor` envelope the api attaches to every command — the person's id
and roles, straight from the JWT claim the api already verified — and mirrors that identity into
`users` before authorising. Left empty, every command would take the external branch and nobody
could link what they uploaded, so **core refuses to start**. `NATS_EVENTS_QUEUE` is the queue
group for the authentication event `core` consumes to mirror identities, and `SERVICE_VERSION` is
what each service announces in discovery — validated as strict SemVer, so a `latest` there is a
failed startup, not a default.

The auth-callout itself is configured by the `GESTION_IDP_*` and `AUTH_CALLOUT_*` variables, all
with defaults, wired to the identity provider and the NATS credentials.

**Storage** — any S3-compatible service, and **only `core` receives the credentials**: the api
has no access to the bucket, so it cannot touch an object core did not sign for it. Bucket and
region are required with no default, on purpose: a wrong default would write objects somewhere
unintended.

Two things about storage are **installation preconditions, not application configuration**, and
both fail in ways that do not name their cause:

- **The bucket needs a CORS policy.** The browser uploads straight to it, so without one the
  `PUT` dies with an opaque network error. Configured differently on each provider —
  [deploy/README.md, step 5](../deploy/README.md#5-bucket-cors).
- **`STORAGE_S3_ENDPOINT` has to be reachable from the browser**, because it is the host that
  ends up inside the signed URL. An internal Docker name works for core and not for the browser,
  and rewriting the host after signing gives `403 SignatureDoesNotMatch` —
  [deploy/README.md, step 6](../deploy/README.md#6-the-bucket-url-the-browser-will-see).

The bucket's URL does reach the browser, inside the `uploadUrl` and the `Location` of the read
`302`. It never arrives through a `NEXT_PUBLIC_*`: nothing about the bucket is baked into the
frontend images, so one image still serves every environment.

Note that the `STORAGE_S3_*` variables are read **lazily, on the first file command**. A core
container that started cleanly proves nothing about the storage being configured correctly.

## Two that change behaviour

`AUTH_BYPASS` skips token validation for local work. **It is ignored when `NODE_ENV=production`**,
so it cannot be left on by accident in a deployment.

`LOG_COMMANDS` makes core print every command and reply. Off by default because the payloads
carry business data.

## Reference

`deploy/.env.dist` documents each variable inline, next to its default.
[deploy/README.md](../deploy/README.md) covers how the secrets are split, which of them are
versioned, and how to generate the service user keys and the NATS identity.
