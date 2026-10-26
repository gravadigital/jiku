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

- **Delivery is not durable.** The identity event travels over core NATS without JetStream, so
  if `core` is down when it is published, it is lost with no record and the identity is mirrored
  on its next authentication. This is specific to this event: the domain events `core` publishes
  do go through JetStream and are durable.
- **Consistency is eventual, and asymmetric.** Revoking a role at the provider takes effect
  **immediately** for HTTP authorisation, which reads the token claim on every request, and
  **only at the next authentication** for the bus, which reads the mirrored row.

## A lost command is a lost command

Commands are direct request/reply with **no JetStream** — the domain-events plane uses it, the
command plane deliberately does not — which means:

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
before any id reaches the database. The only authentication
exemption in `api/config/public.ts` is `GET /p/docs/`, the shared documentation links, and it
carries its own controls: a host of its own, a rate limit, a 256-bit token and a `404` that does
not reveal whether a link ever existed. Everything else needs a token — visibility level only
governs what an **authenticated** user can see, not whether a file can be fetched anonymously.

## The documentation module has limits of its own

Only relevant if jiku-docs is installed. They are listed together because most come from the same
design: Jiku reads and writes documentation over the bus and keeps none of it.

**Shared links**

- **The rate limit is per replica.** `/p/docs/*` allows 60 requests per minute per IP, counted in
  memory, so with N api replicas the effective limit is `60 × N`.
- **A page and its images share that quota.** A document with more than about 59 images uses the
  whole minute on one load.
- **`HEAD` counts as an access.** `HEAD /p/docs/{token}` resolves the link, so it adds one to the
  audit trail.
- **Anyone with the link reads the document.** It expires and can be revoked, but until then it
  is a credential.

**What the interface does not cover**

- **Folders and their permissions are managed outside Jiku**, in jiku-go. The web only browses.
- **No real time in the browser.** Changes by someone else show up when you reload or navigate.
- **History, move, delete and restore are not in the web**, although the api exposes them. The
  portal cannot edit, search or share.
- **Documents over 256 KiB are read-only** and cannot be created or edited over HTTP. The api
  also caps request bodies under `/api/docs` at 768 kb for `POST` and `PUT`; the rest of the api
  keeps 100 kb.
- **Creating a document without an `id` is not idempotent.** Retrying after a `504` creates a
  second document.
- **Lists have ceilings:** the root of `/docs` shows up to about 2000 folders, search returns at
  most 50 results with no paging, and the list of links for a document shows one page of 200.
- **Attachments are limited to 10 MB** by the upload widget; jiku-docs' own limit is not
  verified.

**Portal**

- **Markdown is rendered without GFM**: tables, strikethrough and task lists appear as plain
  text.
- **Documents over 256 KiB are fetched by the browser**, which needs a CORS `GET` rule on
  jiku-docs' bucket; if it is missing the document shows an error.
- **A document cannot show another document's attachment in the portal.** Attachments are served
  under the document that links them, and only if they belong to it: a `public` document that
  embeds or links an attachment of a different document — even a `public` one — shows it broken
  (404). Its own attachments work as before. The internal web is not affected.
- **Links to other documents appear as plain text in the portal.** A link whose path is
  `/docs/{id}` points to the internal web, which a client cannot open, so the portal shows its text
  without making it a link. Attachments, web links and `mailto:` links work as before; in the
  internal web the same link still navigates.

**Operation**

- **Module state is per replica.** Each api replica checks the module on its own, so two can
  disagree for up to 30 seconds.
- **People cannot ping the module.** A client using a person's token (jiku-go) cannot tell
  `unavailable` from `available` by ping; it learns by calling.
- **The module's service name is fixed by the access policy.** The templates authorise
  `jiku-docs-commands` and `jiku-docs-queries` literally; registering another name is rejected
  by the bus. Changing it is a security change, one line per template.
- **Every connector can read all documentation.** The `internal-app` role gained access to
  jiku-docs, which treats it as a trusted service. Granting that role to a new connector grants
  this too.
- **Every connector can read everyone's roles.** Core gives any caller with the `internal-app`
  role the `roles` and `identityType` of every user through `users.list`, because jiku-docs needs
  them to classify who calls it. That holds **whether or not jiku-docs is installed**: granting
  `internal-app` to a new connector grants this too. People (internal and external) cannot
  request them.

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

## The internal frontend is desktop-only

The shell declares `min-width: 1400px` with a fixed 300px sidebar: below that width the internal
frontend **scrolls horizontally** instead of reflowing. There is no mobile or tablet layout, by
design — the identity handoff this interface was built against states there is no responsive
mobile design in scope.

This replaced an earlier `overflow-x: hidden` that, below roughly 900px, silently **clipped**
content and left it unreachable. Scrolling is the lesser problem of the two, not a solution: how
Jiku should look on a phone is still an open question.

The client portal is unaffected and has its own layout.

## Two lint rules are warnings, not errors

`react-hooks/set-state-in-effect` fires on two components in `opus-web`
(`RichTextEditor`, `CreateRequirementModal`). The code works — they synchronise state with
props — but the rule is new in the React 19 plugin and fixing it properly means deriving the
state instead, which is a behavioural change. It is a warning so CI stays meaningful.

One test in `web` is skipped (`CreateRequirementForm`, `S-088 TS-3`): it asserts on
react-select's computed styles through a node jsdom does not accept. `web` declares
`jsdom ^24` while `vitest ^4` ships with 26+; aligning those is the moment to revisit it.

## Operational notes

- **`core` cannot sit behind PgBouncer in transaction pooling mode.** Its read queries use
  named prepared statements so PostgreSQL can reuse their plans, and those do not survive a
  pooler that hands each transaction a different server connection. Jiku's own composes connect
  directly to PostgreSQL; if you put PgBouncer in front of `core`, use session pooling.
- **File storage keys** carry a prefix, persisted in `files.storage_key`. Changing
  `STORAGE_S3_KEY_PREFIX` on an installation that already has data makes existing files
  unreachable. Documented in full — with what to do about it — in
  [deploy/.env.dist](../deploy/.env.dist).
- **Locally, the images of a shared page do not load.** The page's policy requires `https:` and
  the redirect points at MinIO over `http`. The page works; test images against a real bucket.
- **`week-assigned-times`** is still present but its future is undecided — it may be kept,
  reshaped or removed.
- **Both frontends run NextAuth v5, which has no stable release yet.** They are pinned to the
  same exact beta (`5.0.0-beta.32`) rather than a `^` range, so an install cannot silently pick
  up a different beta — but the dependency is a prerelease, and its API has changed between
  betas before. Upgrading should be done deliberately, with a login test against a real
  identity provider.

## Documentation search: what the filters and suggestions do not cover

These apply to the documentation routes and need jiku-docs 1.3.0 or later; the API does not check
the version at runtime, and an older jiku-docs answers `invalid_fields` to the new filters.

- **Topic suggestions match by prefix only.** Typing `vid` finds `video`, not `pedido-video`.
- **The person filter means "created by or last edited by".** The contract does not filter by the
  author of any version of a document.
- **Suggestions search text, not patterns.** `%`, `_` and `\` in the search are escaped.
