# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Versioning policy

The whole monorepo shares a single version: `api`, `core`, `web`, `opus-web` and the
packages under `packages/` are released together and always carry the same number. The
per-service variables in `deploy/` (`API_VERSION`, `CORE_VERSION`, …) exist so a single
service can be redeployed without touching the others, not to version them separately.

What each bump means:

| Bump      | When                                                                                                                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **major** | A breaking change to the HTTP API or to the NATS protocol. The protocol also carries a `version` segment in its subjects (`v1`), which is the mechanism that lets old and new consumers coexist during a migration. |
| **minor** | New functionality, backwards compatible.                                                                                                                                                                            |
| **patch** | Bug fixes and internal changes with no effect on either contract.                                                                                                                                                   |

The database schema is not versioned separately: migrations under
`api/db-upgrade/migrations/` run on startup and are expected to be additive.

### Cutting a release

The version lives in eight `package.json` files, the lockfile and four `*_VERSION`
defaults in `deploy/.env.dist`. One script writes all of them:

```sh
scripts/set-version.sh 1.2.3      # bump everything
scripts/set-version.sh --check    # verify they agree (CI runs this)
```

Then move the `[Unreleased]` entries under the new heading, commit on `dev`, merge to
`main`, and tag:

```sh
git tag v1.2.3 && git push origin v1.2.3
```

Pushing the tag is what publishes. `release.yml` re-checks that the tag matches the
tree, runs build, lint and the full suite, and then pushes four images to Docker Hub —
`gravadigital/jiku-{api,core,web,opus-web}`, each tagged `1.2.3`, `1.2` and `latest`.

A tag that disagrees with `package.json` fails before anything is built, so a
mislabelled image never reaches the registry.

### The `dev` tag

Separately from releases, every push to `dev` republishes the same four images tagged
`dev`, overwriting the previous ones. It is a moving pointer to the tip of the branch,
useful for a staging environment; it is not a release and carries no stability promise.

Each build also publishes an immutable `dev-<commit-sha>` tag, so a specific dev image
stays reachable after the `dev` tag has moved on.

To run against it, set the per-service versions to `dev` in `deploy/.env`:

```
API_VERSION=dev
CORE_VERSION=dev
WEB_VERSION=dev
OPUS_WEB_VERSION=dev
```

---

## [Unreleased]

## [1.3.2] - 2026-09-07

Frontend-only release. No change to the HTTP contract, the NATS protocol, the database schema
or the deployment configuration: only the `web` image needs to move.

### Fixed

- **Opening a task with comments broke the screen.** Any requirement carrying at least one
  comment threw `TypeError: e.getTime is not a function` and the whole detail view fell back to
  the route's "unexpected error" page. The api serializes dates as ISO strings
  (`createdAt: {type: string, format: date-time}`) while `web`'s hand-written domain types
  declared them as `Date`, so nothing caught it at compile time. The normalization now sits in
  the shared date utilities rather than on the one line that failed — the same latent pattern
  was present in five other places, and any caller forgetting a `new Date()` brought the view
  down again.

- **The date fields were not date fields.** `Input variant="date"` rendered `type="text"`: the
  calendar icon was decorative and opened nothing, not even the native picker, and the field
  accepted arbitrary text. Fixing the variant removed the reason for the exception that had kept
  six fields on a raw `<input type="date">`, so the product goes from three parallel mechanisms
  for entering a date down to one component covering all twelve form fields. Inline editing on a
  card (`FinishDateLabel`) deliberately stays on `react-datepicker`.

- **The date field drew two calendar icons.** Once the field became `type="date"` the browser
  added its own indicator next to the design system's, leaving two calendars in the same input —
  a grey one on the left that did nothing and a dark one on the right that worked — because ours
  is `pointer-events: none`. Ours was removed and the browser's kept, since that is the control
  that opens the picker. The magnifier on `search` is unaffected: no native control duplicates it.

- **Twelve selectors had no search box.** Of the 48 selectors in the service only 3 were
  `searchable`, and the ones missing it were precisely those whose options come from the api —
  projects, people, actors, requirements — the lists that grow as the product gets used. The
  worst was the hour-logging target selector: it merges projects, requirements and tasks into the
  longest list in the product, on the most frequently used screen, and its placeholder already
  read "Buscar proyecto, requisito o tarea…" over a menu that filtered nothing. The ~35 selectors
  backed by a fixed constant correctly remain without one.

### Changed

- **Domain date types now say what the api actually sends.** `Person`, `Client`, `Project`,
  `Objective`, `WorkedTime` and `ObjectiveActivity` declare their date fields as `string`, which
  made the compiler flag the 22 places where the value crossed from read to use without
  conversion. Presentation components that receive and format a date accept `Date | string`,
  because both kinds of caller are legitimate. Create/edit form state keeps `Date`, where the
  value is a real object from the date picker validated with `yup.date()`, and the conversion at
  that boundary is now explicit.

- **`searchable` is decided by where the options come from, not by how many there are.**
  Dynamic (mapped from the api) always carries it; fixed (a module constant) does not. Counting
  options describes whichever installation happens to be in front of you — a dynamic list with 8
  options today has 80 once the product is in use, and nobody revisits the selector. Web design
  system `4.0.0` → `4.2.0`.

## [1.3.1] - 2026-09-06

### Fixed

- **The client portal no longer serves internal requirements.** Requirements carry a
  `visibilityLevel` (`public` / `internal`), and `/api/opus/*` ignored it: an `internal`
  requirement was listed, opened, edited, commented and subscribed to from the portal. Only the
  *activity* of a requirement was being filtered. The trim now applies to the requirement itself
  across the surface, and **for every role** — `user` and `admin` included — because visibility
  is a property of the resource, not of the caller: the portal is the screen shared with the
  client. Blocked paths answer `404 requirement_not_found`, identical to a non-existent id, so
  the response does not confirm the requirement exists.

  `DELETE /api/opus/requirements/:reqid/subscriptors/:userId` is deliberately exempt: it only
  removes the caller's own subscription, and blocking it would strand whoever subscribed while
  the requirement was public.

### Notes for existing installations

- **Requirements marked `internal` disappear from the client portal.** The column defaults to
  `public`, so only requirements explicitly set to `internal` are affected. Measure before
  deploying:

  ```sql
  SELECT count(*) FROM requirements WHERE visibility_level = 'internal';
  ```

  If those requirements were visible to clients until now, they vanish from the listing without
  explanation, and a client holding a direct URL to one gets a `404`. No migration, no
  configuration change, and no effect on the internal frontend.

## [1.3.0] - 2026-09-06

Five requests. Comment editing moves onto the bus and reaches requirements for the first time,
the requirement state machine is deliberately taken back out of `core`, listings gain real
totals and multi-state filtering, and `web` is rebuilt on a tokenised Design System with a dark
theme.

**Backwards compatible, with two behavioural notes worth reading.** No endpoint changes its HTTP
status, and the one error-code string that changed had no consumers. But a rule that `1.2.0`
started enforcing server-side is now deliberately gone, and another was narrowed back — both are
in **Changed**, and neither is a bug.

### Added

- **Editing a requirement's comment.** `PATCH /api/requirements/{reqid}/comments/{cid}`, the
  endpoint that closes the long-standing asymmetry where only a task's comment could be edited.
  Author or `admin`, text and attachments together, and `fileIds` is the complete set that must
  end up linked — the same `syncFileLinks` semantics as `requirements.{id}.edit`.
- **Two new bus commands**, 21 → 23: `requirements.{id}.comment.{cid}.edit` and
  `tasks.{id}.comment.{cid}.edit`. Both join the shared role → method constant, which grows from
  18 to 20 enumerated commands for `admin` and `user`.
- **Two new error codes** in `@jiku/nats-protocol`: `comment_not_owned` (403 — not the author and
  not an `admin`) and `activity_not_editable` (400 — the activity exists but is not a `comment`).
- **`edited_at` / `edited_by` on both activity tables**, and an "edited" marker in the feed. The
  marker is shown on the internal frontend only, never on the portal, whatever the comment's
  visibility. Editing does not notify — there is no notification channel in the product.
- **Multi-state filtering on `GET /requirements`.** `state` now accepts a comma-separated list
  and returns requirements in **any** of them. The listing defaults to `planificacion`, `en_cola`,
  `desarrollo`, `revision`; clearing every state shows all of them rather than none.
- **Real totals on listings.** `count=true` on `GET /requirements` returns the number of matches
  instead of the page, so each tab's total is fetched rather than inferred from an incomplete
  page. `count` on `GET /objectives` existed in the code already and is now documented.
- **Hours per requirement, broken down by person.** `GET /requirements/{reqid}/worked-hours`
  gains `byPerson` — `[{ personId, firstName, lastName, minutes }]`, ordered by minutes
  descending — whose sum is exactly `totalMinutes`. Always present, `[]` when there are none.
  The breakdown is by `Person`, so it includes people who are disabled, discharged, or have no
  linked `User`. The response schema is now specified in the contract instead of `type: object`.
- **`include=totalMinutes` on `GET /requirements`**, opt-in, so the listing can render an hours
  column without one call per row. It costs two correlated subqueries per row and is not paid for
  unless asked; `count=true` ignores it. Same gradation as the includable field of the same name
  in the bus query contract.
- **A dark theme for the internal frontend**, with a selector in the sidebar and the choice
  remembered per browser. Contrast is now measured rather than assumed: the six state families
  are checked against WCAG AA on every test run.
- **A pagination window.** Long listings render at most 10 page numbers, centred on the current
  page, instead of one button per page.

### Changed

- **The requirement state sequence is no longer enforced (REQ-012).** `1.2.0` moved the
  `analisis → planificacion → en_cola → desarrollo → revision` table into `core` and enforced it
  for the first time; that is **deliberately derogated**. Any state is now reachable from any
  other, forward or backward, and `resuelto` / `cancelado` stop being terminal.
  `invalid_state_transition` **is no longer emitted** — it stays in the catalog without an
  emitter. This is a loosening: calls that used to fail with 400 now succeed. Anything that
  relied on the server to reject a backwards transition no longer has that guard.
- **Leaving `resuelto` clears the resolution.** Moving a requirement out of `resuelto` into a
  non-terminal state sets `resolutionType`, `resolutionConclusion` and `resolutionComment` to
  `null` in the same update — atomic by construction, not two writes.
- **Mandatory resolution type + conclusion is narrowed back to `incidencia` (REQ-012).** `1.2.0`
  had widened C-17 to every requirement type; for `funcionalidad`, `mejora` and `otro` both
  fields are optional again. `resolution_required` still answers 400, and `type` is still read
  from the stored row rather than the payload. Both `requirements.{id}.edit` and
  `requirements.{id}.resolve` share the one validator.
- **`finishedAt` is rewritten on every entry into `resuelto`**, so it reflects the last
  resolution. `scheduledAt`, `inProgressAt` and `inReviewAt` stay write-once — the asymmetry is
  intentional, now that a requirement can be resolved more than once.
- **`PATCH /api/objectives/{id}/comment/{cid}` publishes to the bus** instead of writing through
  the ORM, which was an undeclared fourth exception to ADR-001. Its `403` body code changes from
  `forbidden` to `comment_not_owned`; the HTTP status is unchanged, and neither frontend consumed
  the old string. It also accepts `fileIds` now, and `admin` may edit another author's comment.
- **`visibilityLevel` is immutable once a comment exists**, on both edit commands, and is
  rejected with `invalid_fields` if sent.
- **`web` runs on a three-tier token layer.** Colour, typography and spacing come from reference,
  semantic and component tokens instead of hardcoded values, and every screen was migrated onto a
  shared component set. The Design System is versioned separately and reached **4.0.0** — see
  [docs/design-system/web/CHANGELOG.md](docs/design-system/web/CHANGELOG.md).
- **The internal frontend is explicitly desktop-only**: the shell declares `min-width: 1400px`
  and scrolls horizontally below it. This replaces an `overflow-x: hidden` that silently clipped
  content and made it unreachable below roughly 900px. See
  [known-limitations.md](documentation/known-limitations.md).

### Fixed

- **Six state families failed WCAG AA contrast in dark mode**, between 1.38:1 and 3.98:1 against
  a 4.5:1 minimum. Dark tints had been derived without redeclaring each family's text colour, so
  every one kept its light-mode ink on a dark tint. Now 7.2:1 to 9.9:1, and asserted by a test.
  `--text-link` had the same problem (3.79:1) and moves to aqua green.
- **A global `span { font-size: 1.25rem }`** forced 20px on every `<span>` in the application,
  overriding what components declared by class — a state `Badge` rendered at 20px instead of 11px.
- **A global `td { max-width: 9.4rem }`** clipped every state pill in a table.
- **The project filter lost its search box** when it moved off `react-select`. `Select` gains an
  opt-in `searchable` with accent-insensitive matching, so `validacion` finds `Validación
  Fiscal`. Keyboard navigation operates on the visible options, not the unfiltered list.
- **The requirement stepper offers all seven states** and suggests the previous one on
  resolution, instead of only the next in a sequence that no longer exists.
- A button's loading spinner was invisible; `(editado)` did not match the size of the edit
  controls beside it; the rich-text editor did not focus when clicked anywhere but its text; the
  state filter overflowed its line and could not be ticked from the menu; the project detail
  rendered an empty stages section.

### Removed

- **`InputSelect`**, `core/src/commands/requirements/state-transitions.ts`, and two dead colour
  maps (`OBJECTIVE_STATE_COLORS`, `OBJECTIVE_AREA_COLORS`, `PROJECT_STATUS_COLORS`) that still
  declared the discontinued palette. A guard test keeps the old palette from re-entering.

### Notes for existing installations

- **One migration, `20260901_01_activity_edited_at_edited_by`.** Adds `edited_at` and `edited_by`
  to `requirement_activity` and `objective_activity`. Both columns are nullable with no default,
  so PostgreSQL only touches the catalog — no table rewrite, no long lock, no downtime. `NULL`
  means "never edited", which is correct for every pre-existing row; there is no backfill. The
  `down` drops all four columns in a transaction.
- **No environment variables were added, renamed or removed.** `deploy/.env.dist` is unchanged
  apart from the version defaults.
- **No changes to NATS roles or permissions.** The two new commands are covered by the existing
  `{instance}.{user_id}.jiku-commands.v1.>` publish permission, so no auth-callout template
  changes and no re-issued credentials.
- **Bus consumers:** the two new commands and two new error codes are additive. If you match on
  `invalid_state_transition` for requirements, note that it is no longer emitted — the code
  remains in the catalog, but nothing raises it.
- **HTTP consumers:** `state` on `GET /requirements` is a superset of what it accepted before, so
  `state=desarrollo` behaves exactly as it did. If you handled the `403` body code `forbidden`
  from `PATCH /api/objectives/{id}/comment/{cid}`, it is now `comment_not_owned`.

## [1.2.0] - 2026-08-27

One request, seven stories. `admin` and `user` gain write access to the bus, and every
business rule that gated a write — role, entity ownership, submission windows, the
requirement state machine, resolution requirements — moves into `core`, the only place
that now enforces any of it.

**Read the security and behaviour notes below even though this is a backwards-compatible
release.** No HTTP status or error code changes shape for a consumer that already mapped
them the way the two frontends do, but three rules start being enforced where they
previously were not, and `admin`/`user` gain real publish permission on the bus.

### Added

- **People publish commands.** `admin` and `user` connect to the bus with permission to
  publish on `{instance}.{user_id}.jiku-commands.v1.>`, not just to query. `external-user`
  is unaffected — still queries only, still only through the portal.
- **The identity envelope.** The `api` attaches `actor` — the caller's id and roles, plus
  name/username/email — to every command it publishes, built straight from the verified
  JWT claim. `core`'s dispatcher extracts it before validation; only
  `CORE_TRUSTED_PUBLISHER_ID` may send one.
- **`core` mirrors identity on every command, not only on the auth event.** With an
  `actor` present, `core` creates or updates the `users` row in its own transaction,
  before authorising. The mirror self-heals on first write, so a stale or missing row is
  no longer a way to get `401`.
- **Command 21: `week-assigned-times.replace`.** The weekly assignment grid was the one
  domain write still going straight to the ORM from the `api`; it is now a command like
  every other write, admin-only, and rejects past weeks.
- **The requirement state machine, enforced server-side for the first time.**
  `analisis → planificacion → en_cola → desarrollo → revision`, incidents skip
  `en_cola`. Both `requirements.{id}.edit` and `requirements.{id}.resolve` check it and
  return `invalid_state_transition` on a bad jump.
- **`access_denied`**, a new shared error code (403) distinguishing "you may not touch
  this entity" (`core`, entity/project-scoped) from `caller_not_authorized` ("your role
  does not enable this method", the role map). Both already mapped to 403 on the HTTP
  side, so no frontend changes.
- `core`'s role → command map now enumerates real methods for `admin` and `user` — 18
  shared commands, one admin-only, one envelope-only — instead of the empty list they
  carried while they had no write path at all.

### Changed

- **Every write rule the `api` used to enforce now lives in `core`.** Role checks,
  entity/project ownership, the worked-time submission window, charging hours to another
  person, task/requirement mutual exclusion, weekly-assignment past-week protection, and
  mandatory resolution type + conclusion — all removed from the `api`'s routes and
  applied once, in `core`, on every channel that reaches them.
- **`validateToken` no longer queries `users`.** `req.user` is built entirely from the
  verified JWT claim. The `401 user_not_found` response is gone from all 61 routes.
- **Resolution type + conclusion (C-17) now applies to every requirement type**, not only
  `incidencia`. The `api` enforced it for incidents alone; `core` enforces it uniformly
  on both `requirements.{id}.edit` and `requirements.{id}.resolve`.
- `worked-times.new`'s `personId` becomes optional in the bus contract — `core` resolves
  it from the actor's linked Person when absent. `unworked-times.new` keeps `personId`
  required; the asymmetry is intentional.
- Eight command schemas' `creator`/`editor`/`author`/`uploader` fields become optional —
  the effective actor is always resolved by `core`'s `resolveActor()`, never enforced by
  Joi presence, closing a gap where the `api` had to duplicate the same id in two places.

### Removed

- **`deploy/nats/auth-callout/templates/person.yaml`**, the single template shared by all
  three person roles. Replaced by `person-internal.yaml` (`admin`/`user`: queries and
  commands) and `person-external.yaml` (`external-user`: queries only, unchanged).
- The `api` middlewares that used to run these rules before delegating to `core`:
  `validateDateRange`, `validatePersonPermission`, `validateWeekNotPast`,
  `validateDeletePermission`, the `.oxor('objectiveId','requirementId')` check and
  `validateResolutionRules`. The transaction middlewares (`startTransaction`/
  `commitTransaction`) lose their only caller along with the ORM-based weekly-assignment
  write they wrapped.

### Fixed

- **Eight command schemas rejected a valid envelope-only payload.** `creator`/`editor`/
  `author` were still `required()` even when `actor` carried the same identity, forcing
  the `api` to send the id twice and risking a spurious `invalid_fields` on a mismatch.

### Security

- **`admin` and `user` gain publish permission on the bus.** This is the release's
  substantive security change (ADR-007): a person's own token now authorises writing to
  `jiku-commands`, not only reading from `jiku-queries`. It is deliberate and is enforced
  twice — once by the auth-callout template, once by `core`'s role → command map — but
  any installation that relied on "people can only read the bus" as a security boundary
  needs to re-examine that assumption before upgrading.

### Behaviour notes (no contract change, but observable)

- Resolving a non-`incidencia` requirement without a resolution type and conclusion now
  fails with `400 resolution_required`, where it previously succeeded.
- A requirement-state jump the `api` never validated (skipping `en_cola`, for instance)
  now fails with `400 invalid_state_transition`.
- When two rules fail on the same `worked-times`/`unworked-times` call, the error code
  returned can differ from before: the rules moved into `core` and are now evaluated in a
  different order. `docs/apis/api.yaml` marks each reordered case explicitly.

### Notes for existing installations

- **No new environment variables, no migrations.** `deploy/.env.dist` and
  `api/db-upgrade/migrations/` are both untouched by this release.
- **`admin` and `user` roles in Zitadel gain real write access to the bus** the moment
  this version is deployed — see *Security* above. If an operator's threat model assumed
  otherwise, that assumption needs revisiting before, not after, the upgrade.
- **Any local override of `deploy/nats/auth-callout/templates/person.yaml`** — outside a
  plain checkout of this repository — needs to move to `person-internal.yaml` /
  `person-external.yaml`. `rules.yaml` already points at the new names; a manual copy of
  the old template left in place is simply unused, not a conflict, but a manual rule that
  still references `person.yaml` by path will fail to resolve.
- `docs/apis/api.yaml` and `docs/apis/core.yaml` are the source of truth for the two
  contracts: where the code disagrees, the document wins.

## [1.1.0] - 2026-08-26

Six requests and twenty-eight stories. The file no longer travels through the `api`, and
the single NATS service `gestion` is replaced by two — `jiku-commands` for writes and
`jiku-queries` for reads.

**Read the two sections at the end before upgrading.** Several changes below are not
backwards compatible — the attachment upload body, `fileIds` in the domain commands, the
service rename, the removed public endpoint — and an installation that upgrades without
following *Notes for existing installations* will break.

### Added

- **Reading the product over the bus.** `jiku-queries` is a second micro service living in
  the same `core` process, with its own queue group, its own read-only database connection
  and its own timeout. Twenty-three endpoints over seventeen resources, with keyset
  pagination over opaque cursors, per-resource filters, `include` for related entities and
  field projection. `docs/apis/core-queries.yaml` is the contract, and `meta.describe`
  returns it as data, derived from the same specs that validate a request.
- **Direct-to-S3 upload from `web` and `opus-web`.** The browser asks the bus for an upload
  ticket, `PUT`s the byte straight to the bucket with a presigned URL and reports real
  progress. Neither the `api` nor NATS ever sees the file.
- **`GET /api/files/{id}/preview`** — previewing a file that is not linked to anything yet,
  which is the state both upload forms are in before the entity is saved.
- **`users.roles` and `users.identity_type`, mirrored from the bus.** `core` consumes the
  `{instance}.events.auth` event the auth-callout publishes on every successful
  authentication and creates or updates the row. Signing up needs no admin approval. The
  event travels over core NATS without JetStream: if the consumer is down the event is lost,
  and the identity is mirrored on its next connection.
- **Bus callers are authorised by role**, in both dispatchers. A role that does not list a
  method gets `caller_not_authorized`; a caller with no row in `users` gets `unknown_caller`.
  The `api` maps the first to 403.
- **People connect to the bus.** `templates/person.yaml` grants the three product roles
  (`admin`, `user`, `external-user`) queries only — not one write subject.
- `identityType` in the authorship payloads, and the badge both frontends render from it, so
  a row written by a service is not shown as if a person had written it. `roles` is not
  exposed in any HTTP response.
- **The bus is introspectable.** Both services register under the micro framework, so
  `nats micro info` and `nats micro stats` list their endpoints and report per-operation
  request counts and latency. `deploy/bus-inspect.sh` wraps the usual queries, and
  `SERVICE_VERSION` is what each service announces in discovery.
- `errorDetails` in the `Reply` envelope, plus `unknown_caller`, `query_timeout`,
  `invalid_cursor`, `comment_not_found` and `task_not_found` in the shared error catalogue.
  All of it additive: `failure()` gained an optional third parameter and no code was retired.
- **The `api` tells 503 from 504.** No subscriber on the subject is `service_unavailable` and
  the operation did not happen; a reply that did not arrive in time is `gateway_timeout` and
  it may have. The branch is chosen from the NATS client's signal, not from elapsed time.
- `tasks.new` and `tasks.{id}.edit` accept files; they did not before.
- Eighteen composite indexes for the keyset orderings (`20260824_02`), created
  `CONCURRENTLY`.
- MinIO in the local development stack, with the bucket created by `deploy/local.sh`.
- The engineering documentation is tracked under `docs/`: the PRD, thirteen ADRs, ten flows,
  three OpenAPI specs, the database schemas, and the requests and stories behind this
  release.

### Changed

- **A file is no longer an attachment.** The new `files` table holds the object — key,
  region, size, checksum, uploader, retention — and `attachments` holds only the link
  between a file and an entity. A file with no link is a valid state, which is what removed
  the five `*_draft` entity types and the re-anchoring they needed.
- **`POST /api/attachments` and `POST /api/opus/attachments` no longer take the file.** They
  take a JSON body of `fileName`, `mimeType`, `fileSize` and an optional `checksum`, and
  return an upload ticket. `entityType`, `entityId`, `description` and `files` are rejected
  with 400, and a `multipart/form-data` body is a 400 as well. One file per request: three
  files are three independent requests.
- **The six domain commands that receive files take `fileIds`, not `attachmentIds`**, and
  only accept a file the caller uploaded — `file_not_owned`, mapped to 403. A `fileId` that
  does not exist falls into `invalid_fields` (400); telling the two apart is deliberate.
  `attachmentScope` is gone with no replacement, and the ten-file cap moved from a `multer`
  transport limit to a domain rule in the bus contract.
- **Reads redirect instead of streaming.** The attachment routes authorise, resolve the
  file, ask `core` for a presigned URL and answer 302. The "stream under 15 MB, presign over
  it" branch is gone; there is one path for every size, and the `api` moves no bytes in
  either direction.
- **The NATS service `gestion` is now `jiku-commands`**, with `jiku-queries` alongside it in
  the third subject segment. The twenty existing commands are registered as micro endpoints
  with no change to their logic. `NATS_SERVICE_NAME` is replaced by `NATS_COMMAND_SERVICE`
  and `NATS_QUERY_SERVICE`; the observer template moved to `bus-observer`.
- **`core` owns the storage.** It is the only service with bucket credentials — it signs both
  the upload and the download URL — and the `STORAGE_S3_*` variables are no longer in the
  `api`'s environment in any compose file. That is an infrastructure guarantee, not a
  convention: the `api` cannot touch an object `core` did not sign for it.
- `internal-app` is the connector role, and it now authorises both planes in the role-to-method
  map. It previously authorised nothing, and the `api` passed only through the trusted-`sub`
  exemption — so a second identity carrying the role could connect and publish, and collected
  a `caller_not_authorized` on every method.
- The user-facing documentation moved from `docs/` to `documentation/`; `docs/` now holds the
  engineering documentation.
- Every push to `dev` publishes the four images tagged `dev`, plus an immutable
  `dev-<commit-sha>`.

### Removed

- **The public attachment endpoint.** `GET /api/opus/attachments/{id}/public` and the
  `GET /attachments/{id}/{fileName}` route in `opus-web` are both gone, together with the
  one entry in `api/config/public.ts`. It was the last surface in the product that could
  originate a download with no credential. The lists in that file are now empty and the
  mechanism is kept on purpose: declaring something public has to stay a one-line change in
  a file whose only job is to enumerate what is public.
- **The external-system integration (Jira).** The tables `external_integration_config`,
  `external_project` and `external_sync_event`, the nine `external_*` columns on tasks, their
  three Sequelize models and two never-taken branches in `web`. It was schema with no code;
  the capability is dropped from the product.
- **The `external-publisher` role**, its rule and its template. It enumerated nine write
  subjects and no queries for a channel that never existed in Zitadel, so the channel was
  never used and the two enumerations were dead configuration kept in sync by hand.
- `multer`, the `api`'s S3 client and `uuid`. The upload no longer buffers 10 MB × 10 files
  in the `api`'s memory.
- `SERVICE_NAME` and `subscriptionSubject()` from `@jiku/nats-protocol`, and the wildcard
  subscription they served.

### Fixed

- **A service identity could not be mirrored, which took down four things at once.** A
  Zitadel machine user has no email address, so with `users.email` `NOT NULL` the consumer
  discarded every service event with `"email" is required` — and with no row in `users` both
  bus gates rejected that identity. The column is now nullable, and the requirement is
  conditional: `core`'s schema still demands an email for a person, where a missing one means
  the publisher is misconfigured and that diagnosis is worth keeping.
- **File linking was broken against a migrated database.** The `Attachment` model still
  declared the ten columns migration `20260819_05` had dropped, and every link wrote them, so
  linking failed with `column "file_name" ... does not exist` and `GET /api/attachments` was
  broken by the same cause. The test suite could not catch it: it builds its schema with
  `sync()` from the model, so for the tests those columns existed. A test comparing the model
  against the columns the migrations leave behind is the guard that was missing.
- Three bugs that crossed the two id spaces — a file id used against the attachment route, a
  `file:` reference rendered as raw text, and an attachment marker saved with a file id.
  They were silent because the two spaces overlap: resolving a file id against the link route
  does not 404, it serves a different file.
- `files.{fileId}.request-download` no longer checks `byte_status`. `pending` meant both "the
  byte never arrived" and "not linked yet", which made a freshly uploaded file impossible to
  preview by construction.

### Notes for existing installations

- **This release contains a destructive migration.** `20260819_05_harden_attachments_schema`
  is a point of no return, and the procedure in
  `docs/changelog/2026-08-19-separacion-file-attachment.md` expects the four additive
  migrations before it to be deployed first, their seven counts read from the log, and the
  result accepted by a human. Both halves ship in this tag, so an installation with data
  should run the first four from a checkout without the fifth and only then move to `2.0.0`.
- **`CORE_TRUSTED_PUBLISHER_ID` is required and `core` will not start without it.** It is the
  `sub` of the `api`'s service user, and it is how `core` tells the `api`'s channel from any
  other publisher. Empty, every command would take the external branch and no user could
  link what they uploaded.
- **`NATS_SERVICE_NAME` is gone.** Set `NATS_COMMAND_SERVICE` and `NATS_QUERY_SERVICE`
  instead, and remember that changing either one is not enough on its own: the auth-callout
  authorises those names literally in `deploy/nats/auth-callout/templates/`. A mismatch still
  connects and then fails every publish with `Authorization Violation`.
- **`STORAGE_S3_ENDPOINT` is now the URL the signature is built from, and the signature ends
  up in the browser.** It has to be an address the browser can resolve — an internal Docker
  name works for `core` and breaks the direct `PUT`. Rewriting the host of an already-signed
  URL gives `403 SignatureDoesNotMatch`, because the host travels in SigV4's `SignedHeaders`.
  The bucket also needs a CORS policy, or the `PUT` dies with an opaque network error. Both
  are covered in `deploy/README.md`, steps 5 and 6.
- New variables read only by `core`: `POSTGRESQL_READ_POOL_MAX`,
  `POSTGRESQL_STATEMENT_TIMEOUT_MS`, `NATS_EVENTS_QUEUE` and `SERVICE_VERSION`.
  `POSTGRESQL_STATEMENT_TIMEOUT_MS` must stay strictly below `NATS_QUERY_TIMEOUT_MS`, or a
  slow query leaves the caller on a bus timeout that explains nothing. `SERVICE_VERSION` is
  validated as strict SemVer: a `latest` or a `1.0` there is a failed startup.
- **The `external-publisher` role must be removed from Zitadel** if it was ever granted, and
  the three product roles now need a `person` rule to exist for `identity_type` to be
  reported correctly. Before those rules existed every event went out as
  `identity_type: "service"`. `deploy/nats/add-events-user.sh` provisions the identity that
  publishes the auth event.
- **Anything already speaking to the bus has to move to `jiku-commands`.** The subject's
  `version` segment is still `v1` — the protocol shape did not change, the service name did —
  so there is no window in which both names answer.
- `docs/apis/core.yaml`, `docs/apis/core-queries.yaml` and `docs/apis/api.yaml` are the
  source of truth for the three contracts: where the code disagrees, the document wins.

## [1.0.0] - 2026-08-12

First public release.

### Added

- Apache-2.0 license, `NOTICE`, contribution guide, security policy and code of conduct.
- Continuous integration running build, lint and the test suites of the four projects.
- Root `build` script and a `postinstall` hook that compiles the shared packages, so a
  fresh clone works with a single `npm install`.
- Shared ESLint configuration for the TypeScript projects.

### Changed

- `web` and `opus-web` are now npm workspaces: one `npm install` from the root covers the
  whole monorepo. Their Dockerfiles build from the repository root as a consequence.
- Container images are published on Docker Hub instead of a private registry.
- The auth-callout is consumed from `gravadigital/nats-zitadel-auth-callout`. That image
  ships only the callout: the NATS server runs as a separate service.
- Every package now declares version `1.0.0`. They were inconsistent (`0.1.0`, `1.3.1`)
  and there were `version.txt` files disagreeing with them.

### Fixed

- **Authentication could be silently disabled.** When `IDENTITY_URL` was empty the API
  skipped token validation entirely and treated every request as an admin, and the
  documented setup path shipped that variable empty. Bypassing authentication is now an
  explicit opt-in (`AUTH_BYPASS=true`, refused when `NODE_ENV=production`), and the
  process refuses to start when the configuration would leave the API open.
- **`GET /api/mattermost/projectobjectives` required no authentication.** Anyone who
  guessed a group name could read a project's objectives. The route was removed: no
  frontend consumed it and the integration that did was decommissioned.
- The access token is no longer accepted through the `?jwt=` query parameter, where it
  could end up recorded in access logs.
- A failed startup now exits with a non-zero status.
- `KEEP_DB=true` had no effect on the API test suite: the container was always removed.

### Removed

- **Mattermost and email notifications, and the hour-reminder cron jobs.** These were
  integrations with one organisation's infrastructure rather than product features: the
  Mattermost bot had already been decommissioned, and the reminders encoded specific
  business rules (a fixed daily hour target, fixed schedules, a named channel). The
  `nodemailer` and `node-schedule` dependencies and around fourteen environment variables
  went with them.
- **`POST /api/objectives/convert-to-requirement`**, together with its button and hook in
  the internal frontend.
- Internal tooling, sprint planning documents and generated catalogues that were tracked
  in the repository (516 files).
- Personal data belonging to a third party that had been pasted into design prototypes.

### Notes for existing installations

- The tables `objective_mail_threads`, `requirement_mail_threads` and
  `inbound_mail_threads` are no longer used, but **no migration drops them**: removing a
  model does not remove its table, and a destructive migration would lose data.
- `STORAGE_S3_BUCKETNAME` and `STORAGE_S3_REGION` are now **required**. They used to fall
  back to one organisation's bucket and region, which meant a misconfigured install failed
  only when the first file was uploaded.
- `STORAGE_S3_KEY_PREFIX` is new and **defaults to the previous hardcoded value**. Object
  keys are stored in `attachments.storage_key`, so changing it on an installation with
  data would make existing attachments unreachable.
