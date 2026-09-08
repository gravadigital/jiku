# NATS identity

**Nothing in this directory is versioned except this README.**

The NATS server runs in **operator mode**, which the auth-callout requires: authorisation is
decided with account-signed JWTs, and that is what lets the callout mint a different User JWT
per connection. A server in classic `authorization {}` mode cannot do that.

Consequence: **without `nats-resolver.conf` the server does not start**, and without NATS
nothing writes.

## Generating it

```sh
cd deploy/nats
./bootstrap.sh
```

Requires [`nsc`](https://github.com/nats-io/nsc):

```sh
curl -sf https://binaries.nats.dev/nats-io/nsc/v2@latest | sh
```

That is all. The script creates the operator, the two accounts, the sentinels, the XKey and
the resolver configuration, and declares the auth callout. It uses a throwaway `nsc` store, so
it does not touch your own.

> **Run it once per installation.** It refuses to overwrite an existing identity unless you
> pass `--force`, because regenerating invalidates every credential already distributed and
> forces reissuing them in all services.

## What it produces

| File                            | What it is                                             | Used by                                              |
| ------------------------------- | ------------------------------------------------------ | ---------------------------------------------------- |
| `nats-resolver.conf`            | operator, system account and account JWTs              | the `nats-server` (included from `nats-server.conf`) |
| `sentinel-client.creds`         | the sentinel services connect with                     | api and core                                         |
| `sentinel-handler.creds`        | the callout's own sentinel                             | auth-callout                                         |
| `callout-events.creds`          | publishes the authentication events (required)         | auth-callout                                         |
| `callout-env.sh`                | path contract for the callout                          | auth-callout                                         |
| `app-account.pub` / `.sk.seed`  | APP account: signs the User JWTs the callout issues    | auth-callout                                         |
| `auth-account.pub` / `.sk.seed` | AUTH account: signs the `authorization_response`       | auth-callout                                         |
| `callout-xkey.pub` / `.seed`    | XKey (curve25519) that decrypts authorisation requests | auth-callout                                         |

The three seeds and the `.creds` files are **secret material**; the script sets them to `600`.
The `.pub` files are public but kept alongside for convenience.

## The events credential, and adding it to an installation that already exists

**`callout-events.creds` is a deployment precondition, not an extra.** The auth-callout publishes
one authentication event per accepted connection and **does not start without this credential**:
`CALLOUT_EVENTS_CREDS` points at a path that is not there. Since S-016 `core` *consumes* those
events to mirror identities into `users`, an installation missing the file is also one where
**no identity is ever mirrored**. Before S-016 nobody listened and a missing credential had no
functional consequence; that is no longer the case.

**A new installation already has it:** `bootstrap.sh` calls `add-events-user.sh` as its last
step. It arrived after the bus was first deployed, so it also has its own script rather than
being only a step of the one-shot bootstrap — which is what an installation that predates it
needs:

```sh
cd deploy/nats
./add-events-user.sh
```

**It is not a regeneration and it is not `--force`.** A user JWT is signed by the *account's*
signing key, whose seed is already here as `app-account.sk.seed`, and adding a user does not
touch the account JWT — so `nats-resolver.conf` does not change and no credential already
distributed stops working. The script rebuilds a throwaway `nsc` context out of what is in this
directory, mints the one user and throws the context away again.

The permission it writes is the **literal** subject `<instance>.events.auth`, while the callout
is configured with a pattern. The instance is read from `deploy/.env` (`NATS_INSTANCE`); pass
`--instance` to override it. Getting the two out of step fails as an asynchronous permissions
violation in the callout's log — never as a refused connection.

## JetStream, and enabling it on an installation that already exists

**A new installation already has it:** `bootstrap.sh` now grants the APP account JetStream
storage and memory limits as part of creating that account, and `nats-server.conf` ships with
`jetstream {}` enabled. Both are needed for the `JIKU_EVENTS` stream (the persisted transport
for domain events, see the root `CHANGELOG.md` and REQ-014) to exist: the server enables the
capability, the account's JWT sets its ceiling.

This section is for an installation that ran `bootstrap.sh` **before** that was true.

### Why the limits are not in `nats-server.conf`

The server runs in **operator mode**, so `nats-server.conf` only sets the server-wide
JetStream ceiling (`store_dir`, and optionally `max_memory_store`/`max_file_store`). The
**effective** limit — whether the APP account can create a stream at all — lives in the
**account's JWT**, set with `nsc edit account --js-disk-storage/--js-mem-storage/...`. Without
a non-zero `--js-disk-storage`, JetStream is enabled at the server but the account cannot
create streams, and the error surfaces only when you try:
`no JetStream default or applicable tiered limit present`.

### Why this one needs the operator key and `add-events-user.sh` did not

An account JWT is signed by the **operator**. `bootstrap.sh` generates the operator's signing
key into a throwaway store and **discards it on exit** — only the two *account* signing keys
are persisted here, in `app-account.sk.seed` and `auth-account.sk.seed`.

`add-events-user.sh` (above) can add a user without the operator key because **adding a user
does not touch the account JWT** — a user JWT is signed by the account's own signing key,
which *is* persisted. **Assigning JetStream limits does touch the account JWT**, so it needs a
key that, in an installation that predates these limits, no longer exists anywhere.

### If you kept the operator key

If you saved the operator's signing key seed somewhere outside this directory (`bootstrap.sh`
never persists it, so this only applies if you exported it yourself at generation time), the
path is clean and **invalidates nothing already distributed**:

```sh
cd deploy/nats
./enable-jetstream.sh --operator-key <path-to-the-seed>
```

It edits the APP account's JWT with the JetStream limits, rewrites the account's line in
`nats-resolver.conf` (backing up the original first), and tells you to restart the server —
see the next section for why a restart is required. The AUTH account is left untouched: the
callout has no business with JetStream.

Already-distributed `.creds` files keep working: they are signed by the account's *signing
key*, which does not change. Only the account JWT itself is re-signed by the operator.

### If you did not (the default)

If the key was never kept, `enable-jetstream.sh` detects it and refuses with an explanatory
error rather than a raw `nsc` failure naming a key that means nothing out of context. The only
way out is to re-generate the identity:

```sh
cd deploy/nats
./bootstrap.sh --force
```

**This is not free.** `--force` **reissues every credential** in this directory — the operator,
both accounts, both sentinels, the XKey, and the events publisher user. Every service that
holds one of these `.creds` files (api, core, the auth-callout) needs the new file
redistributed and to reconnect. Regenerating the identity is already documented above as "not
a recoverable operation in practice" — this is the same operation, done for the same reason.

### Why the resolver needs a restart, not a `push`

`nats-resolver.conf` is generated with `nsc generate config --mem-resolver`: the account JWTs
are **embedded directly in the file** (`resolver: MEMORY`), not held by a separate resolver
service. There is no endpoint to `nsc push` to. "Re-pushing the JWTs", in this installation,
means: **rewrite `nats-resolver.conf` with the updated account JWT, then restart the `nats`
container** — the server only reads `resolver_preload` at startup, so nothing takes effect
until it restarts:

```sh
docker compose restart nats
```

### Creating the stream

Once the account has the limits (either path above) and the server has been restarted:

```sh
cd deploy/nats
./create-events-stream.sh
```

It creates `JIKU_EVENTS` on `<instance>.events.v1.>` — the version segment is what keeps
`<instance>.events.auth` (the identity event above, no version, three segments) out of this
stream. See the script's header for the full reasoning.

### The persistent volume

`storage: file` means JetStream writes to disk, at the `store_dir` `nats-server.conf`
declares. That path needs a **named volume** mounted in the compose file — without one, it
lives in the container's ephemeral filesystem and the stream is silently lost on the next
recreate (a `docker compose down`, a `--force-recreate`, or — in production, where the service
runs `restart: always` — any redeploy). Nothing logs an error: a connector just stops
receiving events. The three compose files (`docker-compose.yml`, `.dev.yml`, `.local.yml`)
already declare this volume; if you hand-roll a different compose setup, do not skip it.

### What this does not break

Enabling JetStream at the server level does **not** grant anyone permission to publish to or
consume `JIKU_EVENTS` — that is separate, deliberately: infrastructure first, permission
alongside the code that uses it (`core`'s `pub.allow` and a connector template, in later
stories of REQ-014). It also does not, and must not, touch `CALLOUT_EVENTS_STREAM` for the
auth-callout: setting that variable now that a stream exists would make the callout try to
publish with JetStream acks, using a credential (`callout-events.creds`) that was never
granted the permissions that requires, and it would fail at startup naming the stream instead
of the missing permission. See the comment above `CALLOUT_EVENTS_SUBJECT` in the compose
files, and `add-events-user.sh`'s header, for the full trap.

## Why `sentinel-client.creds` is safe to distribute

It **grants nothing on its own** — it denies publish and subscribe on everything. Connecting
with it triggers the callout, and all real access comes from the User JWT the callout issues
after reading the role from the caller's token.

You can verify this: connect with it while the callout is not running, and every operation is
refused with a permissions violation.

## The two accounts

| Account        | Holds                    | Why separate                                                            |
| -------------- | ------------------------ | ----------------------------------------------------------------------- |
| `GESTION`      | the services (api, core) | the callout binds the users it mints to this account                    |
| `GESTION_AUTH` | the callout itself       | its user is _exempt_ from the callout — otherwise it could not serve it |

That separation is not stylistic: an authorisation service cannot be subject to its own
authorisation.

## Development

`docker-compose.dev.yml` runs the callout in `mock` mode: an in-process identity provider that
decodes the identity from the token text, with no secrets and no network. Tokens look like
`mock:<sub>:<username>:<roles>`.

**Even in mock mode you still need this identity**: it belongs to the NATS server, not to the
identity provider. `./bootstrap.sh` is required either way.

## Backups

Keep a safe copy of this directory. Regenerating the identity is not a recoverable operation
in practice: the server's trust changes and every credential has to be reissued.

There is no rotation mechanism yet — see
[../../../documentation/known-limitations.md](../../../documentation/known-limitations.md).
