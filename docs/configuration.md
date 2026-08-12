# Configuration reference

Every variable, per service, with what happens if you get it wrong. For how to get a stack
running, see [installation.md](installation.md).

Configuration lives in three places, and it helps to know which is which:

| File            | Used by                                                                  |
| --------------- | ------------------------------------------------------------------------ |
| `deploy/.env`   | the composes, which pass values down to each service. **Not versioned.** |
| `api/.env.dist` | template for running the API on its own, outside Docker                  |

**The frontend images carry no configuration.** Everything is read at runtime, so one
published image works for any deployment. That is why there are no `NEXT_PUBLIC_*` variables
left: Next bakes those into the browser bundle at build time, which would tie an image to a
single installation.

The browser never talks to the API directly. It calls `/api/...` on the frontend itself, and a
route handler forwards the request server-side, attaching the access token. Two consequences
worth knowing: the API's address only has to be reachable from the frontend container, and the
access token never leaves the server.

---

## api

### Database

| Variable                                                     | Notes                                                                                                      |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `POSTGRESQL_HOST`, `POSTGRESQL_PORT`, `POSTGRESQL_DB`        | connection target                                                                                          |
| `POSTGRESQL_USER`, `POSTGRESQL_PASSWORD`                     | **the read-only role.** The API must not be able to write; that is the guarantee the architecture rests on |
| `POSTGRESQL_MIGRATION_USER`, `POSTGRESQL_MIGRATION_PASSWORD` | the database owner. Migrations run on startup and do need to write                                         |
| `POSTGRESQL_POOL_MAX`, `_MIN`, `_IDLE`                       | connection pool                                                                                            |

### Authentication

| Variable           | Notes                                                                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `IDENTITY_URL`     | the OIDC provider. **Required**: without it, and without an explicit bypass, the process refuses to start                                                                             |
| `KEY_SYNC_ATTEMPS` | retries when fetching the JWKS (the spelling is a typo in the code)                                                                                                                   |
| `AUTH_BYPASS`      | `true` disables token validation entirely and treats every request as an admin. Refused when `NODE_ENV=production`; every bypassed request logs a warning. **Local development only** |
| `DEV_USER_ID`      | the user loaded while the bypass is active. Required when it is on                                                                                                                    |

> The API refusing to start is deliberate. It used to enable the bypass automatically when
> `IDENTITY_URL` was empty, which meant a missing variable silently produced an open API.

### The bus

| Variable                                   | Notes                                                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `NATS_URL`                                 | the server                                                                                       |
| `NATS_CREDS`                               | path to the sentinel credentials inside the container                                            |
| `ZITADEL_SERVICE_USER_KEY_B64`             | the service user's JSON key, base64-encoded. Written by `./service-user-key.sh api`, not by hand |
| `ZITADEL_ISSUER_URL`, `ZITADEL_PROJECT_ID` | where to request the token and which project holds the roles                                     |
| `NATS_INSTANCE`                            | first subject segment (`dev`, `prod`). Isolates deployments sharing one NATS                     |
| `NATS_SERVICE_NAME`                        | which service answers the commands                                                               |
| `NATS_PROTOCOL_VERSION`                    | protocol version, fourth subject segment (`v1`)                                                  |
| `NATS_REQUEST_TIMEOUT_MS`                  | how long the API waits for core before giving up                                                 |

### Attachment storage

Any S3-compatible provider: AWS S3, MinIO, DigitalOcean Spaces, Cloudflare R2.

| Variable                                         | Notes                                                                                                                                                                      |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `STORAGE_S3_ENDPOINT`                            | **required**                                                                                                                                                               |
| `STORAGE_S3_CREDENTIALS_ACCESSKEY`, `_SECRETKEY` | **required**                                                                                                                                                               |
| `STORAGE_S3_BUCKETNAME`                          | **required, no default**                                                                                                                                                   |
| `STORAGE_S3_REGION`                              | **required, no default**                                                                                                                                                   |
| `STORAGE_S3_FORCEPATHSTYLE`                      | `true` for MinIO                                                                                                                                                           |
| `STORAGE_S3_KEY_PREFIX`                          | prefix for object keys. **Do not change it on an installation with data**: keys are stored in `attachments.storage_key`, and existing attachments would become unreachable |

All five required values are validated when the service starts. They previously fell back to
one organisation's bucket and region, which meant a misconfigured install failed only when
someone uploaded the first file.

### Logging and runtime

| Variable                                   | Notes                                                   |
| ------------------------------------------ | ------------------------------------------------------- |
| `NODE_ENV`                                 | `production` also refuses `AUTH_BYPASS`                 |
| `SERVER_PORT`                              | HTTP port                                               |
| `LOGGER_INFO_PATH`, `LOGGER_ERROR_PATH`    | log files                                               |
| `LOGGER_INFO_LEVEL`, `LOGGER_ERROR_LEVEL`  | levels                                                  |
| `LOGGER_FILE_MAX_SIZE`, `LOGGER_MAX_FILES` | rotation                                                |
| `LOG_ACCESS_TOKEN`                         | prints the access token in the logs. **Debugging only** |

---

## core

Core writes, so it uses the owner credentials, and it has no HTTP surface.

| Variable                                                      | Notes                                                                                                                                                                                                                     |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POSTGRESQL_*`                                                | same as the API, but **with the full-privilege user**                                                                                                                                                                     |
| `NATS_URL`, `NATS_CREDS`                                      | the bus                                                                                                                                                                                                                   |
| `ZITADEL_SERVICE_USER_KEY_B64`                                | core's service user key. **Without it the connection is rejected**: the sentinel credentials grant nothing by themselves — it is the token that triggers the auth-callout, which reads the role and mints the permissions |
| `ZITADEL_ISSUER_URL`, `ZITADEL_PROJECT_ID`                    | as above                                                                                                                                                                                                                  |
| `NATS_INSTANCE`, `NATS_SERVICE_NAME`, `NATS_PROTOCOL_VERSION` | must match the API's, or the subjects will not line up                                                                                                                                                                    |
| `LOG_COMMANDS`                                                | prints every command and its reply. **Off by default**: payloads carry business data                                                                                                                                      |

---

## web (internal frontend)

| Variable                                                    | Notes                                                                                                                                                             |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `API_URL`                                                   | where the API is, **as seen from this container**. Read at runtime                                                                                                |
| `AUTH_URL`                                                  | the frontend's own public URL, for NextAuth                                                                                                                       |
| `AUTH_SECRET`                                               | session signing secret. Generate with `openssl rand -base64 32`                                                                                                   |
| `ZITADEL_ISSUER`, `ZITADEL_CLIENT_ID`, `ZITADEL_PROJECT_ID` | the OIDC application                                                                                                                                              |
| `APP_NAME`                                                  | application name, shown in the title and as the logo's alt text                                                                                                   |
| `APP_DESCRIPTION`                                           | meta description                                                                                                                                                  |
| `EXTERNAL_LINKS`                                            | optional JSON with shortcuts to your team's tools, shown at the foot of the navigation: `[{"tool":"github","href":"https://…","label":"Code"}]`. Empty by default |

> Both frontends run NextAuth v5, but their variable names differ: `web` uses the v5 names
> (`AUTH_*`) and `opus-web` kept the v4 ones (`NEXTAUTH_*`), which v5 still reads. Worth
> unifying — see [known-limitations.md](known-limitations.md).

## opus-web (client portal)

| Variable                                                    | Notes                                                                                            |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `API_URL`                                                   | where the API is, **as seen from this container**. The browser calls this portal, which forwards |
| `NEXTAUTH_URL`, `NEXTAUTH_SECRET`                           | NextAuth. These are the v4 names, still honoured by v5                                           |
| `ZITADEL_ISSUER`, `ZITADEL_CLIENT_ID`, `ZITADEL_PROJECT_ID` | the OIDC application                                                                             |

---

## deploy/.env

Consumed by the composes, which distribute values to the services.

| Variable                                                                                            | Notes                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `STAGE`                                                                                             | names containers and volumes                                                                                                                                                           |
| `DOMAIN`, `OPUS_DOMAIN`                                                                             | public hostnames, used by the reverse proxy                                                                                                                                            |
| `INGRESS_NETWORK`, `DATABASE_NETWORK`                                                               | external Docker networks, on a server                                                                                                                                                  |
| `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD`                                               | the owner                                                                                                                                                                              |
| `DATABASE_READONLY_USER`, `DATABASE_READONLY_PASSWORD`                                              | the API's role. `local.sh` creates it; the production compose does not                                                                                                                 |
| `DATABASE_PORT`                                                                                     | published port                                                                                                                                                                         |
| `DUMP_FILE`                                                                                         | optional `.sql` to preload on first start                                                                                                                                              |
| `API_VERSION`, `CORE_VERSION`, `WEB_VERSION`, `OPUS_WEB_VERSION`, `AUTH_CALLOUT_VERSION`            | image tags, one per service, so one can be redeployed alone. The tag goes **here**, not in the `*_IMAGE` variable                                                                      |
| `IDENTITY_URL`, `IDENTITY_ISSUER`, `IDENTITY_CLIENT_ID`, `IDENTITY_PROJECT_ID`                      | the provider and the frontends' application                                                                                                                                            |
| `GESTION_IDP_MODE`                                                                                  | `zitadel` or `mock`                                                                                                                                                                    |
| `GESTION_ZITADEL_ISSUER_URL`, `GESTION_ZITADEL_PROJECT_ID`                                          | what the auth-callout validates against                                                                                                                                                |
| `AUTH_CALLOUT_IMAGE`                                                                                | published image of the callout, **without a tag**. The compose builds the reference as `${AUTH_CALLOUT_IMAGE}:${AUTH_CALLOUT_VERSION}`, so putting the tag here yields `…:0.1.0:0.1.0` |
| `API_SERVICE_USER_KEY_B64`, `CORE_SERVICE_USER_KEY_B64`                                             | written by `./service-user-key.sh`, not by hand                                                                                                                                        |
| `WEB_NEXTAUTH_SECRET`, `OPUS_NEXTAUTH_SECRET`                                                       | session secrets for the frontends                                                                                                                                                      |
| `NATS_*`                                                                                            | as documented above                                                                                                                                                                    |
| `STORAGE_S3_ENDPOINT`, `_CREDENTIALS_ACCESSKEY`, `_CREDENTIALS_SECRETKEY`, `_BUCKETNAME`, `_REGION` | **all required** — the API refuses to start without them                                                                                                                               |
| `STORAGE_S3_FORCEPATHSTYLE`                                                                         | `true` for MinIO                                                                                                                                                                       |
| `STORAGE_S3_KEY_PREFIX`                                                                             | see the api section above                                                                                                                                                              |

## Where the secrets live

| What                                          | Where                       | Versioned |
| --------------------------------------------- | --------------------------- | --------- |
| Passwords, client ids, service-user keys      | `deploy/.env`               | no        |
| NATS identity (operator, accounts, sentinels) | `deploy/nats/creds/`        | no        |
| Bus access policy (roles → permissions)       | `deploy/nats/auth-callout/` | **yes**   |

The access policy is versioned on purpose: it is a product decision, not a secret.
