# Known limitations

Things that will surprise you, documented rather than hidden. None of these are secrets or
bugs to be reported — they are the current state, with the reasoning behind each one.

## The NATS identity has to be generated, and there is no rotation

The NATS server runs in operator mode and needs a resolver configuration plus sentinel
credentials. None of that is versioned, so a fresh clone cannot start NATS until you run
`deploy/nats/bootstrap.sh` once.

That part is solved. What remains:

- **There is no rotation mechanism.** Regenerating the identity breaks the server's trust and
  forces reissuing every credential, which is why the bootstrap refuses to overwrite an
  existing one without `--force`. It cannot run as part of `docker compose up`.
- **Backups are manual.** Losing `deploy/nats/creds/` means reissuing everything.
- **The auth-callout is a separate component**, consumed as a published image. Its source is
  not in this repository, so its behaviour cannot be inspected or patched from here.

You also need two service users in the identity provider, each with a JSON key.

## The migrations cannot build the schema from scratch

The 95 migrations under `api/db-upgrade/migrations/` all assume an existing schema. The
earliest one modifies the `objectives` table, and **no migration creates it**. Against an
empty database the API fails on startup:

```
ERROR: relation "public.objectives" does not exist
```

So a new installation needs a `.sql` with the schema, loaded before the first start
(`DUMP_FILE` in `deploy/.env`). There is no `db:create` or baseline migration to generate it.

This is a consequence of how the project was imported: the schema predates the migration
history. Fixing it means writing a baseline migration that creates the current schema and
marking the existing ones as applied — worth doing before there are external adopters, since
right now nobody can start from zero without a dump they do not have.

## Users are mirrored, not managed

Jiku reads identities from the provider; it does not manage them. `core` mirrors the `users`
row two ways: the auth-callout publishes an event on every successful authentication that
`core` consumes to create or update it, roles included, and — since the identity envelope
(REQ-007) — `core` also mirrors it from the `actor` the api attaches to every command a person
publishes, before authorising that command. No admin approval either way.

**HTTP no longer depends on any of this.** `validateToken` builds `req.user` from the verified
JWT claim alone; there is no `users` lookup on the request path, so `401 user_not_found` is
gone. A person who has never triggered either mirror simply has no `users` row yet — nothing
in `web` or `opus-web` needs one to exist. `POST /api/auth/present`, which used to create the
user on first login, is still a no-op: the api is read-only and never writes `users` directly.

Two more consequences worth knowing:

- **Delivery is not durable.** The event travels over core NATS without JetStream, so if `core`
  is down when it is published, it is lost with no record and the identity is mirrored on its
  next authentication.
- **Consistency is eventual, and asymmetric.** Revoking a role at the provider takes effect
  **immediately** for HTTP authorisation, which reads the token claim on every request, and
  **only at the next authentication** for the bus, which reads the mirrored row.

## A lost command is a lost command

The protocol is direct request/reply with **no JetStream**, which means:

- No retries and no distributed transaction.
- If core writes and the reply is lost, **the client sees an error for an operation that
  actually happened**.
- Commands are not guaranteed to be idempotent, so blindly retrying can duplicate work.

For the current volume this is a considered trade, not an oversight. It is the first thing to
revisit if writes become critical.

## Error codes are not catalogued

Replies carry `errorCode` and `errorMessage`, but there is no closed list of codes and no
documented mapping to HTTP statuses. Some errors also carry extra data — a daily-limit
rejection includes the remaining minutes — and the reply format does not account for it.

Practical effect: a client integrating over the bus cannot enumerate what it might receive.

## Error messages are in Spanish, and they are UI text

The frontends display the API's `message` field directly to the user, which makes those
messages part of the interface rather than a debugging aid. They are currently **mixed**:
some English, some Spanish.

They stay in Spanish because the frontends are in Spanish, and translating them would break
the interface with nothing to replace it. The proper fix is a closed error-code catalogue plus
i18n in the frontends.

## Some enum values are in Spanish, inside the schema

Requirement priority, state and type are stored with Spanish values (`sin_prioridad`,
`en_cola`, `sin_tipo`, …), baked into the PostgreSQL schema and into the bus contract.

Treat them as **opaque identifiers**. Changing them requires a data migration and an
incompatible contract change, which is why they have not been touched.

Related: `mattermost_group_name` survives as a project property even though the integration
that named it was removed. It is free-form text; the name is the only leftover.

## The interface is Spanish-only

Both frontends have their text hardcoded in Spanish, with no i18n layer. Documentation and
code comments are in English; the interface is not.

## Core trusts the message body for the acting user's identity

The API connects to the bus as itself, so the user id in the subject is the API's. The acting
user travels in the body (`creator` / `author`) and core trusts it.

That is safe **only because the access policy lets nothing but the API publish those
commands**. If you add a second publisher, this assumption stops holding and core would need
to verify identity itself.

## A pre-signed download URL outlives the request that produced it

Every read path answers with a redirect to a pre-signed storage URL. Once issued, that URL
grants access to the file **without any credential** until it expires, wherever it ends up
being copied or forwarded. The only control is its lifetime, `download-url-ttl-seconds`.

Attachment ids are still sequential integers, but enumerating them no longer reveals
anything: every endpoint requires a bearer token, so an unauthenticated caller gets `401`
before any id reaches the database. The list of authentication exemptions in
`api/config/public.ts` is empty — visibility level now only governs what an **authenticated**
user can see, not whether a file can be fetched anonymously.

## The `bus-observer` role reads everything

It exists for local debugging: it can subscribe to the entire protocol and publish nothing.
That means it can read every command's payload, including business data. The policy file
marks it local-only. **Do not grant it in production.**

## A key rotation at the identity provider can take the bus down

If the provider rotates its signing key, the auth-callout can start rejecting every token,
including valid ones, and not recover until it is restarted. While it lasts, no service can
connect to the bus.

The fix belongs in the auth-callout, which is a separate component. If it happens, restart
the callout.

## Two lint rules are warnings, not errors

`react-hooks/set-state-in-effect` fires on two components in `opus-web`
(`RichTextEditor`, `CreateRequirementModal`). The code works — they synchronise state with
props — but the rule is new in the React 19 plugin and fixing it properly means deriving the
state instead, which is a behavioural change. It is a warning so CI stays meaningful.

One test in `web` is skipped (`CreateRequirementForm`, `S-088 TS-3`): it asserts on
react-select's computed styles through a node jsdom does not accept. `web` declares
`jsdom ^24` while `vitest ^4` ships with 26+; aligning those is the moment to revisit it.

## Operational notes

- **File storage keys** carry a prefix, persisted in `files.storage_key`. Changing
  `STORAGE_S3_KEY_PREFIX` on an installation that already has data makes existing files
  unreachable. Documented in full — with what to do about it — in
  [deploy/.env.dist](../deploy/.env.dist).
- **Three unused tables remain**: `objective_mail_threads`, `requirement_mail_threads` and
  `inbound_mail_threads`, left over from the removed email notifications. No migration drops
  them, because removing a model does not remove its table and a destructive migration would
  lose data.
- **`week-assigned-times`** is still present but its future is undecided — it may be kept,
  reshaped or removed.
- **Both frontends run NextAuth v5, which has no stable release yet.** They are pinned to the
  same exact beta (`5.0.0-beta.32`) rather than a `^` range, so an install cannot silently pick
  up a different beta — but the dependency is a prerelease, and its API has changed between
  betas before. Upgrading should be done deliberately, with a login test against a real
  identity provider.
