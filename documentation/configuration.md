# Configuration

Everything is configured at runtime, in one file: `deploy/.env`, copied from
`deploy/.env.dist`. The published images carry no configuration, so the same image runs in any
installation.

`deploy/.env.dist` has 55 variables with working defaults for a local run. Sixteen are blank
and must be filled in.

## The sixteen

| Variable | What goes in it |
|---|---|
| `DOMAIN`, `OPUS_DOMAIN` | public hostnames of the two frontends, **bare hosts with no scheme** — see below |
| `DATABASE_READONLY_PASSWORD` | password for the read-only user, shared by api and core |
| `IDENTITY_CLIENT_ID`, `IDENTITY_PROJECT_ID` | the identity provider application the frontends use |
| `GESTION_ZITADEL_PROJECT_ID` | the project where the roles live |
| `WEB_NEXTAUTH_SECRET`, `OPUS_NEXTAUTH_SECRET` | `openssl rand -base64 32`, one each |
| `API_SERVICE_USER_KEY_B64`, `CORE_SERVICE_USER_KEY_B64` | the machine-user keys each service uses to reach the bus — `deploy/service-user-key.sh` |
| `CORE_TRUSTED_PUBLISHER_ID` | the `sub` of the api's machine user. **`core` refuses to start without it** — see below |
| `DUMP_FILE` | a `.sql` holding the schema — see [installation.md](installation.md) |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | the mail server notifications go out through — see below |

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

`NATS_EVENTS_VERSION` is the version segment of the **domain events** `core` publishes
(`{instance}.events.{version}.{entity}.{action}`), and it is **independent of**
`NATS_PROTOCOL_VERSION` on purpose: sharing one value would drag the commands into a version bump
of events they have nothing to do with. Its real default lives in the code, so the installation
that does not set it gets `v1`. That plane is the only one on JetStream: it needs the
`JIKU_EVENTS` stream to exist and the NATS account to carry JetStream limits — both are
**installation steps, not configuration** (`deploy/nats/create-events-stream.sh` and
`deploy/nats/enable-jetstream.sh`; a fresh `bootstrap.sh` does both).

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

**Notifications** — `SMTP_HOST`, `SMTP_PORT` (defaults to `587`), `SMTP_USER`, `SMTP_PASSWORD`
and `SMTP_FROM`. This is the only outbound network dependency `core` has; everything else it
talks to is on the internal network. Like the storage credentials they are read **lazily**, at
the first delivery cycle that has something to send, and there is no startup assert: a
misconfigured mail server leaves rows `pending` with a `last_error` recorded, which is noisy and
recoverable, so it does not justify refusing to boot. **A core container that started cleanly
proves nothing about mail working either** — check that notifications are actually arriving.

Three `system_settings` rows tune the delivery process at runtime, without a restart:
`notification-dispatch-interval-seconds` (`60`), `notification-batch-size` (`50`) and
`notification-max-attempts` (`5`). They are read fresh on every cycle.

**The portal's hostname** — `OPUS_DOMAIN` is a **bare host, with no scheme and no trailing
slash** (`opus.example.com`). It is consumed in two forms: bare by the ingress, and as
`https://${OPUS_DOMAIN}` for `NEXTAUTH_URL` and for the `OPUS_URL` that `core` uses to build the
link inside every notification. A value that carries `https://` produces `https://https://…` in
every mail sent, and a broken link in an already-delivered email cannot be fixed afterwards.
**`core` refuses to start if `OPUS_URL` does not reach it**; the composes derive it, so with the
composes under `deploy/` there is nothing to set by hand.

## Two that change behaviour

`AUTH_BYPASS` skips token validation for local work. **It is ignored when `NODE_ENV=production`**,
so it cannot be left on by accident in a deployment.

`LOG_COMMANDS` makes core print every command and reply. Off by default because the payloads
carry business data.

## Reference

`deploy/.env.dist` documents each variable inline, next to its default.
[deploy/README.md](../deploy/README.md) covers how the secrets are split, which of them are
versioned, and how to generate the service user keys and the NATS identity.
