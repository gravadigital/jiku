# Configuration

Everything is configured at runtime, in one file: `deploy/.env`, copied from
`deploy/.env.dist`. The published images carry no configuration, so the same image runs in any
installation.

`deploy/.env.dist` has 33 variables with working defaults for a local run. Nine are blank and
must be filled in.

## The nine

| Variable | What goes in it |
|---|---|
| `DOMAIN`, `OPUS_DOMAIN` | public hostnames of the two frontends |
| `DATABASE_READONLY_PASSWORD` | password for the api's read-only user |
| `IDENTITY_CLIENT_ID`, `IDENTITY_PROJECT_ID` | the identity provider application the frontends use |
| `GESTION_ZITADEL_PROJECT_ID` | the project where the roles live |
| `WEB_NEXTAUTH_SECRET`, `OPUS_NEXTAUTH_SECRET` | `openssl rand -base64 32`, one each |
| `DUMP_FILE` | a `.sql` holding the schema — see [installation.md](installation.md) |

Two more are not in that list but must not keep their defaults on a server:
`DATABASE_PASSWORD` and the `STORAGE_S3_*` credentials.

## Groups worth understanding

**Image versions** — `API_VERSION`, `CORE_VERSION`, `WEB_VERSION`, `OPUS_WEB_VERSION`. Pinned per
service, so core can be redeployed without touching the frontends. A release number (`1.0.0`)
pins that release; `dev` tracks the tip of the `dev` branch and is republished on every push.

**Database** — the api connects read-only; migrations use `POSTGRESQL_MIGRATION_USER`, the owner.
Two sets of credentials for one database, which is what enforces the read/write split.

**Identity** — Jiku authenticates nobody itself. The frontends use an OIDC application (User
Agent / PKCE, no client secret); `api` and `core` each use a machine user to reach the bus, with
**Access Token Type = JWT** — the default `Bearer` issues opaque tokens the bus rejects.

**Bus** — `CALLOUT_*` configures the auth-callout: 13 variables, all with defaults, wired to the
identity provider and the NATS credentials. `NATS_REQUEST_TIMEOUT_MS` is how long the api waits
for core.

**Storage** — any S3-compatible service. Bucket and region are required with no default, on
purpose: a wrong default would write objects somewhere unintended.

## Two that change behaviour

`AUTH_BYPASS` skips token validation for local work. **It is ignored when `NODE_ENV=production`**,
so it cannot be left on by accident in a deployment.

`LOG_COMMANDS` makes core print every command and reply. Off by default because the payloads
carry business data.

## Reference

`deploy/.env.dist` documents each variable inline, next to its default.
[deploy/README.md](../deploy/README.md) covers how the secrets are split, which of them are
versioned, and how to generate the service user keys and the NATS identity.
