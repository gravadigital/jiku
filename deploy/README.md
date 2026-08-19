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

Six steps, all one-time except bringing the stack up. **Steps 5 and 6 configure the bucket**, and
they are the two that are easiest to skip and hardest to diagnose: get either wrong and uploading
a file fails with an error that points nowhere near the cause.

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
| `STORAGE_S3_*`                                | S3-compatible storage. **core** signs both uploads and downloads, so the credentials need read **and** write permission. **Only `core` receives them** — the api has no access to the bucket, so it cannot touch an object core did not sign for it. Any value works locally until something actually uploads a file. |
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

### 5. Bucket CORS

**Do this before anyone tries to upload.** The browser uploads the file straight to the bucket
with a presigned `PUT`, and reads it back from the `Location` of a `302`. Neither goes through
the api, so **the bucket itself has to allow the frontends' origins**. Without that policy the
`PUT` dies with an opaque network error — no status code, no body, nothing in the api's logs —
and it looks like a frontend bug when it is not one.

The four supported providers **each take a different format**, so there is no single file to
copy. What has to be true in all of them is the same:

| Setting          | Value                                                                 | Why                                                                          |
| ---------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Allowed origins  | `https://<DOMAIN>` and `https://<OPUS_DOMAIN>` — never `*`             | Two frontends, two different hostnames. A presigned URL plus a wide-open bucket is a wider permission than the design assumes |
| Allowed methods  | `PUT`, `GET`, `HEAD`                                                   | `PUT` uploads, `GET`/`HEAD` is the read after the `302`. **The `OPTIONS` preflight is answered by the provider from these** — it is not a value you list |
| Allowed headers  | `Content-Type` (at minimum), `Content-Length`                          | The presigned `PUT` carries a signed `Content-Type`, and a non-simple `Content-Type` on a cross-origin request **triggers a preflight** |
| Exposed headers  | `ETag` (and `Content-Length` where the provider allows it)             | Without exposing them the browser's JS cannot read them, and the upload progress and preview `HEAD` lose information |
| Max age          | `3600`                                                                 | Otherwise every file in a batch pays for its own preflight                     |

**Why two origins and not one.** `web` and `opus-web` are served from different hostnames —
`DOMAIN` and `OPUS_DOMAIN` in `.env`. Both upload, so **both** have to be in the policy. If the
installation is also used from a development machine, add `http://localhost:3000` (web) and
`http://localhost:3001` (opus-web); leave them out of a production bucket.

**The preflight matters even though you never configure it directly.** The presigned `PUT` carries
a signed `Content-Type`, and a cross-origin request with a non-simple `Content-Type` makes the
browser send an `OPTIONS` preflight first. None of the four providers takes `OPTIONS` as an
allowed *method* — each answers the preflight from the methods and headers you declared. What
this means in practice: **if `Content-Type` is missing from the allowed headers, the preflight is
refused and the upload never starts, even with `PUT` allowed.** That is the single most common
way to get this wrong.

#### AWS S3

JSON, applied with the CLI. The top-level key is `CORSRules` — note this differs from the XML
form, whose root is `CORSConfiguration`.

```json
{
  "CORSRules": [
    {
      "ID": "jiku-frontends",
      "AllowedOrigins": ["https://<DOMAIN>", "https://<OPUS_DOMAIN>"],
      "AllowedMethods": ["PUT", "GET", "HEAD"],
      "AllowedHeaders": ["Content-Type", "Content-Length"],
      "ExposeHeaders": ["ETag", "Content-Length"],
      "MaxAgeSeconds": 3600
    }
  ]
}
```

```sh
aws s3api put-bucket-cors --bucket <STORAGE_S3_BUCKETNAME> --cors-configuration file://cors.json
```

`AllowedMethods` only accepts `GET`, `PUT`, `HEAD`, `POST`, `DELETE` — **`OPTIONS` is not a valid
value here**, and it does not need to be: S3 answers the preflight from the methods listed.
Pass the policy with `file://` rather than inline; that is the documented form and it avoids
shell quoting problems. _(verified against docs.aws.amazon.com: the `s3api put-bucket-cors` CLI reference
and "Enabling CORS" in the S3 user guide, 2026-08-19)_

#### MinIO

**Read this before reaching for `mc cors set`.** Per-bucket CORS is **not available in community
MinIO** — it is a paid-tier (AIStor) feature. Against a community server the command fails with
`A header you provided implies functionality that is not implemented`. The MinIO docs do not
state the split; it is confirmed by maintainers in `minio/minio` discussions #20841 and #20555.
_(unverified against official docs — see those discussions, 2026-08-19)_

**On community MinIO — which is what a self-hosted install almost always runs — the only CORS
mechanism is a server-level environment variable:**

```sh
MINIO_API_CORS_ALLOW_ORIGIN="https://<DOMAIN>,https://<OPUS_DOMAIN>"
```

A comma-separated list of origins. It defaults to `*`; **set it explicitly**, or the bucket is
open to every origin and CA-2's scoping is lost.

Its limits, which are worth knowing before choosing MinIO for a production install:

- It is **deployment-wide**, not per bucket.
- It controls **origins only**. Methods, allowed headers, exposed headers and max-age cannot be
  expressed through it — MinIO answers those on its own.
- Because `ETag` cannot be added to an expose-headers list, JS that needs to read `ETag` off the
  upload response may not get it. The upload itself still works.
- **The preflight is answered by MinIO itself.** There is no place to list `OPTIONS`, `PUT` or
  `Content-Type` here: once the origin is allowed, MinIO responds to the `OPTIONS` preflight and
  permits the signed `Content-Type`. That is why getting the origin list right is the whole job
  on this mechanism — and why there is nothing to check but the origin when it fails.

_(verified against docs.min.io settings reference, 2026-08-19)_

On **AIStor**, per-bucket CORS is available and takes **XML**, not JSON:

```xml
<CORSConfiguration>
  <CORSRule>
    <AllowedOrigin>https://<DOMAIN></AllowedOrigin>
    <AllowedOrigin>https://<OPUS_DOMAIN></AllowedOrigin>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedHeader>Content-Type</AllowedHeader>
    <AllowedHeader>Content-Length</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <MaxAgeSeconds>3600</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>
```

```sh
mc cors set <ALIAS>/<BUCKET> cors.xml
```

`<AllowedMethod>` takes the S3 verbs, so `OPTIONS` does not go in the list — the preflight is
answered from the methods declared. `Content-Type` **does** have to be listed, or the preflight
is refused even though `PUT` is allowed.

A per-bucket policy takes precedence over `MINIO_API_CORS_ALLOW_ORIGIN`.
_(verified against docs.min.io/aistor `mc cors set`, 2026-08-19)_

#### DigitalOcean Spaces

Console: **Spaces Object Storage → the bucket → Settings → CORS Configurations → Add**. The
fields are Origin, Allowed Methods, Allowed Headers and Access Control Max Age.

**`ExposeHeaders` is supported by the service but not offered in the console** — to set it you
need the XML route:

```xml
<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <CORSRule>
    <AllowedOrigin>https://<DOMAIN></AllowedOrigin>
    <AllowedOrigin>https://<OPUS_DOMAIN></AllowedOrigin>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedHeader>Content-Type</AllowedHeader>
    <AllowedHeader>Content-Length</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <MaxAgeSeconds>3600</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>
```

```sh
s3cmd setcors cors.xml s3://<STORAGE_S3_BUCKETNAME>
```

As with S3, `OPTIONS` is not one of the `<AllowedMethod>` values — Spaces answers the preflight
from the methods listed, provided `Content-Type` is among the allowed headers.

`s3cmd` is the CLI DigitalOcean documents for this. The `aws` CLI pointed at the Spaces endpoint
is plausible — Spaces is S3-compatible — but **DigitalOcean does not document it**, so prefer
`s3cmd` or the console. _(verified against docs.digitalocean.com "Configure CORS", 2026-08-19;
the `aws` CLI path is unverified)_

**If the Spaces CDN is enabled, purge the CDN cache after changing the policy** — cached
responses still carry the old headers, and the symptom is a CORS failure that "should already be
fixed".

#### Cloudflare R2

Dashboard: **R2 → the bucket → Settings → CORS Policy → Add CORS policy → JSON**.

The JSON is a **bare array**, not wrapped in a top-level key — the main shape difference from
AWS:

```json
[
  {
    "AllowedOrigins": ["https://<DOMAIN>", "https://<OPUS_DOMAIN>"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type", "Content-Length"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

```sh
wrangler r2 bucket cors set <BUCKET> --file cors.json
wrangler r2 bucket cors list <BUCKET>
```

R2 also implements `PutBucketCors` over the S3 API, so `aws s3api put-bucket-cors
--endpoint-url <r2-endpoint>` works as well.

`OPTIONS` is not listed in `AllowedMethods` here either; R2 answers the preflight from the
declared methods and headers.

**List the allowed headers explicitly.** Cloudflare's troubleshooting page calls out
`AllowedHeaders` missing `Content-Type` as a common failure, and its guidance for custom headers
is to enumerate them. Whether a `"*"` wildcard is ignored outright is not stated either way in
their docs, so do not rely on it. _(verified against developers.cloudflare.com/r2 CORS and
wrangler command reference, 2026-08-19; the wildcard behaviour is unverified)_

#### Checking the policy without a browser

The preflight is one `curl` away, and it answers the question the browser's opaque error does
not:

```sh
curl -i -X OPTIONS '<uploadUrl>' \
  -H 'Origin: https://<DOMAIN>' \
  -H 'Access-Control-Request-Method: PUT' \
  -H 'Access-Control-Request-Headers: content-type'
```

`200` or `204` with `Access-Control-Allow-Origin` echoing back your origin means the policy is
in place. A `403`, or a response with no `Access-Control-*` headers, means it is not — and that
is exactly the state that produces the opaque failure in the browser.

### 6. The bucket URL the browser will see

`STORAGE_S3_ENDPOINT` is **the URL core signs with, and the signature ends up in the browser**.
The presigned `PUT` and the `Location` of the read `302` are absolute URLs with that host inside
them, so the value has to be an address **the browser can resolve** — not one that only exists
inside the Docker network.

`http://minio:9000` is the classic wrong answer. It works for core, which shares the network, and
fails in the browser, which does not know that name. There is no separate "public endpoint"
variable to set: **the one value has to be the public one.**

Three ways out when the internal and the public address differ:

| Way                              | How                                                                                                                        | When                                                                       |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **One public host for everyone** | `STORAGE_S3_ENDPOINT=https://storage.example.com`, and core's container reaches that same host — through public DNS or an `extra_hosts` entry | **Recommended.** One URL, so what is signed and what is served cannot drift apart |
| **Split-horizon DNS**            | The same name resolves to the internal IP inside the network and to the public one from outside                              | When leaving the network just to come back in is expensive                  |
| **Bucket published on the host** | `STORAGE_S3_ENDPOINT=http://localhost:9000` with the port published                                                          | **Local development only**                                                  |

#### Do not rewrite the host after signing

The tempting shortcut — keep `http://minio:9000` and swap the host on the already-signed URL, in
the api or in the frontend — **does not work, and fails in a way that misdirects.**

The host travels inside `SignedHeaders` in SigV4. Change it and the signature no longer matches
what the bucket recomputes, so the bucket answers **`403 SignatureDoesNotMatch`**. The upload got
all the way to the bucket and was rejected, so it reads as a **credentials** problem — wrong access
key, wrong secret, clock skew — and it is none of those. It is the host.

The same `403` does have one other cause worth ruling out: **a container clock more than 15 minutes
off**, which invalidates the signature independently of the host.

#### The bucket URL reaches the browser, and that is on purpose

The browser ends up knowing the bucket's address — on every upload and on every read, since the
`302` sends it there directly. That is a deliberate exception, recorded as D-23 in
[ADR-009](../docs/adrs/ADR-009-token-confinado-al-servidor.md).

What keeps it narrow is **how** it gets there:

- It arrives **inside the `uploadUrl` and the `Location` of the `302`** — both already absolute
  URLs, produced by core's signature and returned in the api's responses.
- It is **never** a `NEXT_PUBLIC_*` variable. Nothing about the bucket is baked into the frontend
  images: one image still serves every environment, which is the part of ADR-009 that matters most.
- The access token still never reaches the browser.

**Do not add a `NEXT_PUBLIC_*` for the bucket** to "make it easier" for the frontend. The frontend
does not need one — it already receives absolute URLs — and adding one would tie an image to an
environment.

#### `core` starting up does not mean the storage is configured

The `STORAGE_S3_*` variables are read **lazily, on the first file command** — not at startup. A
container that came up clean proves nothing about the bucket; the symptom of a bad credential is
an upload or a download that fails later.

`CORE_TRUSTED_PUBLISHER_ID` is the opposite and the only one of its kind: it is asserted **at
startup**, deliberately, so core refuses to start without it. One variable fails loudly and early,
the other six fail quietly and late.

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

## Letting an external service publish

A service outside the product can upload files and link them to domain entities over the bus,
with the same flow as a web user and no special treatment: it asks for a presigned URL with
`files.request-upload`, `PUT`s the bytes at the bucket, and sends the resulting `fileIds` in
whichever domain command it is attaching them to.

It needs a role of its own. `rules.yaml` has **no catch-all**, so a perfectly valid Zitadel token
whose role is not declared there simply does not connect — that is the intended behaviour, and it
is why this is the only way in.

To enable one:

1. In Zitadel, create a **machine user** with **Access Token Type = JWT** (the default `Bearer`
   issues opaque tokens the callout rejects).
2. Grant it the **`external-publisher`** role on the `GESTION_ZITADEL_PROJECT_ID` project.
3. Give it a JSON key and hand that to the service.

Nothing in `deploy/` needs changing: the rule and the template
([nats/auth-callout/templates/external-publisher.yaml](nats/auth-callout/templates/external-publisher.yaml))
are already versioned.

**Its permissions are narrower than the api's, on purpose.** The api publishes under
`gestion.v1.>` — everything. An external publisher gets an explicit list: the two `files.*`
commands, the domain commands that accept `fileIds`, and `attachments.*.delete`. Adding a new
command to that list is a deliberate decision, which is the point: an outside service should not
gain access to a new command just because the protocol grew one.

**The client must set `inboxPrefix` when it connects.** Replies come back on
`_INBOX.<hash-of-user-id>.>`, and that is the only inbox the template authorises. A client that
lets the library pick a random `_INBOX.<random>` gets **no replies at all**, and the symptom is a
**timeout** rather than a permissions error — which sends you looking in the wrong place. In
`nats.js` this is the `inboxPrefix` connection option.

**Files it uploads are attributed to it, not to a person.** Core compares the subject's `caller`
against `CORE_TRUSTED_PUBLISHER_ID`; an external publisher's does not match, so `files.uploaded_by`
records the external service itself. That is intended — it is the author.

---

## Diagnosis

### A file upload fails with an opaque network error

The browser `PUT` to the bucket fails with **no status code, no body**, and the request shows
as failed or cancelled in devtools. Nothing appears in the api's or core's logs, because the
request never reached them.

**CORS is not configured on the bucket.** This is the failure mode with no useful signal: it
looks like a frontend or network bug and it is neither. Check the bucket's CORS policy first —
see [step 5](#5-bucket-cors) — before looking anywhere else.

Confirm it without a browser:

```sh
curl -i -X OPTIONS '<uploadUrl>' \
  -H 'Origin: https://<DOMAIN>' \
  -H 'Access-Control-Request-Method: PUT' \
  -H 'Access-Control-Request-Headers: content-type'
```

A `403`, or a `200` with no `Access-Control-Allow-Origin` in the response, is the confirmation.

Two neighbouring causes, if the preflight does pass:

- **The response's `Access-Control-Allow-Origin` does not match the frontend's origin** — the
  policy is there but scoped to the wrong hostname. `web` and `opus-web` are different origins;
  both have to be listed.
- **The browser cannot resolve the host of `uploadUrl`** — that is not CORS, it is
  `STORAGE_S3_ENDPOINT` pointing at an address that only exists inside the Docker network. See
  [step 6](#6-the-bucket-url-the-browser-will-see).

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
