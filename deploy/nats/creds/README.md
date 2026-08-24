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
