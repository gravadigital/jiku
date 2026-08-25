# Constants & Config — `core`

## ROLE_METHODS

**Location:** `core/src/authorize-caller.ts`

**Description:** The role → method map of the bus: **closed and deny-by-default** (ADR-008). Anything
absent from it authorises nothing.

| Role | Commands | Queries |
| --- | --- | --- |
| `internal-app` | — | — |
| `external-publisher` | the 9 of its callout template | none |
| `admin` · `user` · `external-user` | none | all (`'*'`) |
| `core` · `bus-observer` | none | none |

`internal-app`, `core` and `bus-observer` are listed with **empty lists** rather than absent.
They authorise the same thing (nothing), but listing them makes this the **complete table** of the
roles that may connect to the bus — which is what somebody reads to audit it. And there is a case
where the difference shows: if the api's service-user `sub` rotated and `CORE_TRUSTED_PUBLISHER_ID`
went stale, the api would fall down the non-exempt branch, find its row with `roles:
['internal-app']` and be **refused** — the correct default.

The sentinel `'*'` is **valid only on the query plane**: write access is always enumerated, and a
test enforces it. The 9 subjects of `external-publisher` are enumerated **here and in
`deploy/nats/auth-callout/templates/external-publisher.yaml`**, in two grammars (`{fileId}` vs `*`),
with nothing technical keeping them in sync — **adding a command for the external connector is two
changes, not one, and they go in the same commit.**

## CLASS_BY_ROLE

**Location:** `core/src/queries/caller-class.ts`

**Description:** The role → **class** map of the query plane, and the precedence that resolves a
caller holding several roles. **Closed and deny-by-default** (ADR-008): a role that is not in it
produces no class, and without a class there is no query — the dispatcher answers `unknown_caller`,
never an empty list.

**Deliberately not derived from `ROLE_METHODS`.** That map answers *"may it run this method?"*; this
one answers *"what do I clip for it?"*. Coupling them would make a permissions change silently move
a data clip.

```ts
const PRECEDENCE: readonly CallerClass[] = ['external', 'internal', 'connector'];

const CLASS_BY_ROLE = {
  'external-user': 'external',
  user: 'internal',
  admin: 'internal',
  'internal-app': 'connector',
};
```

| Role | Class | What the service clips |
|---|---|---|
| `internal-app` | `connector` | Nothing. The caller authorises on its own |
| `user`, `admin` | `internal` | Nothing at row level (explicit v1 decision, RF-23) |
| `external-user` | `external` | Whatever the resource's spec declares |
| `external-publisher`, `core`, `bus-observer`, unknown, `[]` | — | No class: they do not query |

**The most restrictive wins**, and the input array's order does not decide: the resolver walks
`PRECEDENCE`, not the roles.

**Today the method gate shadows this one for every non-exempt caller.** The only roles with
`queries: ALL` are `admin`, `user` and `external-user`, and all three *have* a class; any other
caller is cut earlier with `caller_not_authorized`. The one path that reaches `unknown_caller` is the
`CORE_TRUSTED_PUBLISHER_ID`, which passes gate 1 by exemption and arrives here with no usable roles —
exactly what happens in production when the api's authentication event is lost.

## loadConfig / getTrustedPublisherId

**Location:** `core/src/config.ts`

**Description:** Startup validation and access to `CORE_TRUSTED_PUBLISHER_ID`, the `sub` of the
api's service user. `loadConfig()` is the **only startup assert of the service**; it throws when the
variable is missing or empty, deliberately breaking the `process.env.X || 'default'` pattern used
everywhere else. An empty value would send every command down `resolveActor`'s external branch,
leaving `files.uploaded_by` with the api's service user instead of the person — and the only symptom
would be a `file_not_owned`, which looks like a permissions problem rather than a configuration one.

`src/index.ts` calls it after `dotenv.config()` and before `consumer.start()`. Commands never read
`process.env`; they reach the value through `resolveActor`.

**Signature:**
```ts
function loadConfig(): void;              // throws when CORE_TRUSTED_PUBLISHER_ID is missing/empty
function getTrustedPublisherId(): string; // throws when loadConfig() has not run
function resetConfig(): void;             // tests only
```

## File policy defaults

**Location:** `core/src/commands/files/settings.ts`

**Description:** The code-level defaults guaranteeing the system works with no rows loaded in
`system_settings`. The seed is convenience; these are the guarantee.

```ts
DEFAULT_UPLOAD_URL_TTL_SECONDS   = 300
DEFAULT_DOWNLOAD_URL_TTL_SECONDS = 300
DEFAULT_MAX_SIZE_BYTES           = 10485760
DEFAULT_ALLOWED_EXTENSIONS       // 13 entries
DEFAULT_ALLOWED_MIME_TYPES       // 12 entries — `.jpg` and `.jpeg` share `image/jpeg`
SETTING_KEYS                     // the five key names; part of the contract with the operator
```

## DEFAULT_KEY_PREFIX

**Location:** `core/src/commands/files/storage.ts`

**Description:** `'grava-gestion'`, the historical default of `STORAGE_S3_KEY_PREFIX`. Changing it
on an installation with data makes every existing file unreachable, since the keys already persisted
in `files.storage_key` still point at the old prefix.

## Query grammar limits

**Location:** `core/src/queries/engine/validate-query.ts`, `core/src/queries/engine/cursor.ts`,
`core/src/queries/dispatcher.ts`

**Description:** The numbers of the query contract. They are constants and not literals scattered
through the engine because every one of them is a promise the contract makes to the caller.

| Constant | Value | Meaning |
|---|---|---|
| `DEFAULT_PAGE_LIMIT` | `50` | Used when `page.limit` is absent **or `0`** — `0` means "use the default", not "give me nothing" |
| `MAX_PAGE_LIMIT` | `200` | A larger request is **silently capped**: it is `success`, and the effective value travels back in `page.limit` |
| `CURSOR_VERSION` | `1` | A cursor with any other `v` is `invalid_cursor`: its `k` may mean something else |
| `DEFAULT_PAYLOAD_BUDGET_BYTES` | `524288` | Half of NATS' default 1 MiB `max_payload`; used when the connection announces nothing |

`IDENTITY_PAYLOAD_FIELDS` (same file) is the **closed** list of identity names a payload may not
carry — `userId`, `caller`, `sub`, … The identity comes from the **second token of the subject and
only from there** (RF-19). Ignoring such a field would be worse than rejecting it: it would suggest a
caller can ask on someone else's behalf and the service just did not listen this time.

## ENTITY_TYPES / ENTITY_TABLES

**Location:** `core/src/queries/entity-type.ts`

The `entityType` translation, **in one place**.

`entityType` is not a filter: it is what makes an **id mean something**. The ids of
`objective_activity` and `requirement_activity` **overlap** — 1234 exists in both and they are
different things — so without it a `comments.get {id: 1234}` would return "some" comment and the
bug would be silent and intermittent: it works until both tables grow enough.

**It goes BOTH WAYS** (RF-25): the query hits `objective_activity` and the item comes back with
`entityType: "task"`. In S-025 the return trip shows up in the embedded attachments — the query
filters `attachments.entity_type = 'objective_comment'` and the comment returns as `"task"` — and
S-027 (`attachments.list`) exercises the whole thing again. **That is why it lives here and not
inside a spec:** two copies of this table can diverge with nothing to say so.

**It is DATA, not functions.** The specs read these names as they are built, so `meta.describe`
(S-028) can project the contract without running a translation.

| | `task` | `requirement` |
|---|---|---|
| `activityTable` | `objective_activity` | `requirement_activity` |
| `subscriptionTable` | `objectives_subscriptors` | `requirement_subscriptors` |
| `entityColumn` | `objective_id` | `requirement_id` |
| `ownerTable` | `objectives` | `requirements` |
| `commentAttachmentType` | `objective_comment` | `requirement_comment` |

**Mind the plural.** The task subscription table is **plural** and the requirement one is
**singular**. The asymmetry belongs to the database, not to the contract, and copying one for the
other breaks the SQL — with nothing saying so until the query runs.

`ENTITY_TYPES` is `['task', 'requirement']` and **the order is part of the contract**: it is what
travels in `errorDetails.allowed`. The `EntityType` union is derived from the array, never written
by hand.

**Usage:**
```ts
// core/src/queries/comments/comments-spec.ts
const tables = ENTITY_TABLES[entity];
return { table: tables.activityTable, base: { entityId: { column: tables.entityColumn } }, … };
```
