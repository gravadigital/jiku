# Utils — `core`


## authorizeCaller

**Location:** `core/src/authorize-caller.ts`

**Description:** The authorisation gate of **both** dispatchers — commands and queries. It runs
**before resolving the method and before opening the transaction**, so an unauthorised caller never
learns whether the method exists and never takes a connection from the write pool.

```
caller === CORE_TRUSTED_PUBLISHER_ID  -> null (passes WITHOUT touching the database)
otherwise                             -> User.findByPk(caller)
                                           no row                         -> failure
                                           row, no role allows the method -> the SAME failure
```

Returns `null` when authorised, or the ready-made `Reply` the dispatcher must return — so the error
code, its message and its log live in **one** place for both planes. One code and **one message** for
both refusal cases on purpose: a different message would be the existence oracle the shared code
avoids.

**It never rejects, and it fails closed.** `getTrustedPublisherId()` throws when `loadConfig()` has
not run, and `findByPk` can reject; both would escape `dispatch()`, and *"the dispatcher never
throws"* (ADR-003) admits no path where it does. On anything unexpected it logs `error` and returns
`internal_error` — **not `null`**: a gate that cannot decide **denies**, since letting the message
through would turn a database outage into an authorisation bypass.

**No transaction** (a documented exception to the `orm` convention: there is no transaction yet), no
cache, and the read goes out through the **owner** connection even on the query plane —
`models/read.ts` deliberately registers no models, so the ORM is not available there.

**Since S-023 it is the composition of `readCallerRoles` + `authorizeWithRoles`**, with its
signature and its behaviour unchanged. The **command** plane still calls it; the **query** plane
chains the two halves itself, because it needs those same `roles` a second time to resolve the
caller's class with a single `SELECT`.

**Signature:**
```ts
type Plane = 'commands' | 'queries';
function authorizeCaller(caller: string, method: string, plane: Plane): Promise<Reply<never> | null>
```

**Usage:**
```ts
const denied = await authorizeCaller(callerFromSubject(subject), name, 'commands');
if (denied) {
  return denied;
}
```

## readCallerRoles

**Location:** `core/src/authorize-caller.ts`

**Description:** **The read, on its own.** Extracted in S-023 so the query plane can pay a **single
`SELECT`** and feed the **two** gates with it: the method gate (`authorizeWithRoles`) and the caller
class gate (`resolveCallerClass`). Implemented naively those would be two reads per request.

`roles` is `JSONB` **without a CHECK** and the table is writable by SQL, so a value that is not an
array is reachable. The guard turns that into *"no roles"* rather than an `internal_error`: fail
closed here too.

**It does not catch, and that is deliberate** — the caller decides what to do with the failure, and
on both planes that caller already has its own `try/catch`. Catching here would return `[]`, i.e. a
mute refusal, and would lose the distinction between *"not authorised"* and *"the database is not
answering"*.

**Signature:**
```ts
function readCallerRoles(caller: string): Promise<readonly string[]>
```

**Usage:**
```ts
const roles = await readCallerRoles(caller);          // ONE SELECT
const denied = authorizeWithRoles(caller, roles, method, 'queries');
const callerClass = resolveCallerClass(roles);        // the same roles, no second read
```

## authorizeWithRoles

**Location:** `core/src/authorize-caller.ts`

**Description:** **The decision, on its own:** may this caller run this method on this plane? It
**does not touch the database** — it receives the roles already read.

It **re-compares against `getTrustedPublisherId()`** even when the caller already did so before
reading. That is not redundant: the earlier comparison exists **not to read**, this one exists **to
decide**. Keeping it here makes the exemption a property of the **gate** rather than of the order in
which somebody chains the calls — and the query plane, which always reads, keeps it without
reimplementing it.

On refusal it logs the single `[auth]` `warn` (caller and method, never the payload) and returns the
`caller_not_authorized` failure with the shared message. The authorised path logs nothing.

**Signature:**
```ts
function authorizeWithRoles(
  caller: string,
  roles: readonly string[],
  method: string,
  plane: Plane
): Reply<never> | null
```

## resolveCallerClass

**Location:** `core/src/queries/caller-class.ts`

**Description:** **The second gate of the query plane:** *"what do I clip for this caller?"*. Maps
the caller's roles to a `CallerClass`, or `null` when no role produces one.

Kept **separate from `ROLE_METHODS`** on purpose: that map answers *"may it run this method?"* and
returns a permission; this one returns a **class**. Fusing them — or deriving this table from that
one — would let a permissions change silently move a data clip.

**The most restrictive class wins**, with precedence `external` > `internal` > `connector`, and the
result **does not depend on the input array's order**: the implementation walks the precedence list,
not the roles. Someone holding `['user','external-user']` is an external person who was also given
an internal role; if `internal` won, the lower-privilege role would *widen* access.

`admin` and `user` are **the same class**: in v1 the internal mode clips **nothing** at row level
(RF-23), and fine-grained per-role authorisation stays with the api over HTTP.

`external-publisher`, `core` and `bus-observer` are **absent from the table** — they have no class
because they do not query, and leaving them out is how that is said. Pure, with no cache and no
state; a test gate reads the source to keep it that way.

**Signature:**
```ts
type CallerClass = 'connector' | 'internal' | 'external';
function resolveCallerClass(roles: readonly string[]): CallerClass | null
```

**Usage:**
```ts
const resolved = resolveCallerClass(roles);
if (!resolved) {
  return failure(ErrorCode.UNKNOWN_CALLER, UNKNOWN_CALLER_MESSAGE);   // never `items: []`
}
```

## rolesAuthorize

**Location:** `core/src/authorize-caller.ts`

**Description:** The pure predicate behind the gate: does any of the caller's roles authorise this
method on this plane? **Union, not precedence** — one role is enough, which differs on purpose from
the callout's `rules.yaml`, where the first matching rule wins and only one template is granted. A
role absent from `ROLE_METHODS` is skipped rather than an error: that is the deny-by-default of
ADR-008, and it is what makes it acceptable to store `roles` without validating them against any
catalog.

**Signature:**
```ts
function rolesAuthorize(roles: readonly string[], method: string, plane: Plane): boolean
```

## matchesPattern

**Location:** `core/src/commands/registry.ts`

**Description:** Does a method name match a pattern with `{param}` segments? Extracted from
`CommandRegistry.resolve()` in S-017 because the authorisation gate needs the **same** matching
without resolving the command — five of the nine patterns of `external-publisher` carry a `{param}`.
The map and the registry **must** match identically, or a caller would end up authorised for a
pattern the registry resolves differently. Do not replace it with a regex: matching is by segment
because a `.` inside a value breaks a naive one.

**Signature:**
```ts
function matchesPattern(pattern: string, name: string): boolean
```

**Usage:**
```ts
matchesPattern('files.{fileId}.request-download', 'files.7.request-download'); // true
matchesPattern('tasks.{id}.edit', 'tasks.7.comment'); // false
```

## resolveActor

**Location:** `core/src/commands/resolve-actor.ts`

> Moved in S-003 from `core/src/commands/files/resolve-actor.ts`. It now lives one level up because
> **seven** commands share it — `files.request-upload` plus the six domain commands that link files
> — and leaving it under `files/` would force `requirements/` and `tasks/` to import from the file
> module.

**Description:** Resolves who the actor of a command is, depending on the channel it arrived
through. If the subject's `caller` equals `CORE_TRUSTED_PUBLISHER_ID`, the actor is the one
declared in the body — the api already authenticated that person against Zitadel by JWT. Otherwise
the actor is the `caller` itself, and whatever the body declares is ignored, because an external
publisher has no person behind it. The external branch emits one `warn`.

**Signature:**
```ts
function resolveActor(
  ctx: CommandContext,
  declaredActor: string | undefined,
  component: string
): string | undefined
```

**Usage:**
```ts
const actor = resolveActor(ctx, payload.uploader, 'files.request-upload');
if (!actor) return failure(ErrorCode.INVALID_FIELDS, 'Falta el uploader del archivo');
```

**Note:** It takes the declared value instead of reading a fixed field name so the six domain
commands of S-003 reuse it as-is for `author` / `creator` / `editor`. Do NOT duplicate or fork it:
if uploading and linking resolved identity differently, nobody could link what they uploaded.

## linkFiles

**Location:** `core/src/commands/link-files.ts`

**Description:** Links a list of `fileIds` to an entity that **already exists**. It resolves the
actor with `resolveActor`, reads the files in a single query, and validates them **in this order:
existence → liveness → ownership**. The order is mandatory: it is what makes a missing file answer
`invalid_fields` (400) instead of `file_not_owned` (403). On success it marks the bytes as uploaded
with one `UPDATE` and inserts one `attachments` row per file — carrying **only** the polymorphic
pair and `file_id`: the file metadata lives in `files` and is read back through the `include`. Repeated ids are deduplicated
silently. Additive mode — it never touches pre-existing links, so it suits creation commands.

It **never opens or closes a transaction** and never throws to signal an expected failure (ADR-003):
it uses the dispatcher's transaction from `ctx` and returns a ready-to-return failure `Reply`.

**Signature:**
```ts
function linkFiles(params: {
  fileIds: number[];
  declaredActor: string | undefined;
  entityType: AttachmentEntityType;
  entityId: number;
  component: string;
  ctx: CommandContext;
}): Promise<Reply<never> | null>   // null == linked fine
```

**Usage:**
```ts
const linkError = await linkFiles({
  fileIds: payload.fileIds,
  declaredActor: payload.creator,
  entityType: AttachmentEntityType.Requirement,
  entityId: requirement.id,
  component: 'requirements.new',
  ctx,
});
if (linkError) return linkError;
```

**Note:** Call it **after** creating the entity — it needs the `entityId`. Late validation is safe
because the dispatcher rolls back on any non-success reply, so a failed ownership check discards the
entity too. The `File` rows survive, unlinked, which is a valid state.

## syncFileLinks

**Location:** `core/src/commands/link-files.ts`

**Description:** The complete-set variant, for edit commands. Leaves the entity linked to
**exactly** the given `fileIds`: newcomers get a link, the ones no longer declared lose theirs. It
**preserves the rows of the links that stay** (same `id`, same `createdAt`) rather than recreating
them, and validates ownership **only on the new ids** — the ones already linked passed the same
check when they were linked, and `uploaded_by` does not change.

Unlinking is a **hard delete** (`destroy({ force: true })`). `softDelete()` no longer exists on
`Attachment`: it wrote `retention_status` and `deleted_at`, columns migration `20260819_05` dropped,
so it was removed from the model along with them. `force: true` is still required — the
`@BeforeDestroy` guard keeps it mandatory so deleting a link is always explicit at the call site.
It operates on the **link**, never on the file.

**Signature:** identical to `linkFiles`.

**Usage:**
```ts
// absent means "leave the links alone"; `[]` means "unlink everything"
if (payload.fileIds !== undefined) {
  const linkError = await syncFileLinks({
    fileIds: payload.fileIds,
    declaredActor: payload.editor,
    entityType: AttachmentEntityType.Requirement,
    entityId: requirement.id,
    component: 'requirements.edit',
    ctx,
  });
  if (linkError) return linkError;
}
```

## readFileSettings

**Location:** `core/src/commands/files/settings.ts`

**Description:** Reads the five file-policy keys from `system_settings` in a single query, inside
the transaction the dispatcher opened. Every missing key falls back to its code-level default, and
so does an unparseable value. There is no cache of any kind: configuration has to apply hot.

**Signature:**
```ts
function readFileSettings(transaction: Transaction): Promise<FileSettings>

interface FileSettings {
  uploadUrlTtlSeconds: number;
  downloadUrlTtlSeconds: number;
  maxSizeBytes: number;
  allowedExtensions: string[];
  allowedMimeTypes: string[];
}
```

**Usage:**
```ts
const settings = await readFileSettings(ctx.transaction);
if (payload.fileSize > settings.maxSizeBytes) {
  return failure(ErrorCode.FILE_TOO_LARGE, 'El archivo supera el tamaño máximo permitido');
}
```

## buildStorageKey

**Location:** `core/src/commands/files/storage.ts`

**Description:** Builds the storage object key as `{prefix}/f/{uuid}{ext}`, deriving only the
extension from the file name. The uploader never chooses where the file is stored, and the original
name never reaches the key — a `../../etc/passwd.pdf` yields a uuid key with a `.pdf` suffix.

**Signature:**
```ts
function buildStorageKey(fileName: string, keyPrefix: string): string
```

## contentDisposition

**Location:** `core/src/commands/files/storage.ts`

**Description:** Builds a `Content-Disposition` value safe to carry a user-supplied file name:
strips control characters, escapes backslashes and double quotes, and adds the RFC 5987
`filename*=UTF-8''…` form for non-ASCII names.

**Signature:**
```ts
function contentDisposition(disposition: 'inline' | 'attachment', fileName: string): string
```

## keyValuePairsToProperties

**Location:** `core/src/commands/projects/properties.ts`

**Description:** The **read** half of the `properties` ↔ `key_value_pairs` translation (ADR-004).
The column stores a flat object; the contract declares a list of pairs.

```
base:      { "documentacion": "https://…", "board_de_tareas": null }
contract:  [ { "code": "documentacion", "value": "https://…" },
             { "code": "board_de_tareas", "value": null } ]
```

It lives **next to its inverse** (`propertiesToKeyValuePairs`) and not in the query resource spec,
because the `contract-translation` convention says a translation lives in **one** helper of the
module: two copies of the same map in two planes is exactly the divergence that convention prevents.
The query spec references it as the `transform` of the `properties` includable.

**A `NULL` or absent column yields `[]`, never `null`.** The contract declares `properties` as a
list, and a consumer calling `.map()` on `null` breaks. The asymmetry with
`propertiesToKeyValuePairs` — which *does* return `undefined` for an absent field — is deliberate:
there, `undefined` is what makes partial edit work; here there is no partial edit to preserve.

**It does NOT filter by the allowed-codes list.** That allow-list is a **write** rule. Applying it on
read would silently hide any key that remained in the column.

**Signature:**
```ts
function keyValuePairsToProperties(
  raw: Record<string, string | null> | null | undefined
): Property[]
```

**Usage:**
```ts
// core/src/queries/projects/projects-spec.ts
properties: { kind: 'field', column: 'key_value_pairs', transform: keyValuePairsToProperties },
```

## resolveVariant

**Location:** `core/src/queries/engine/spec.ts`

Resolves a resource **variant** into a complete, **effective** `ResourceSpec` — the piece that lets
a resource read from more than one table without the rest of the engine knowing.

`validate-query`, `build-sql`, `project`, `include` and `run` keep operating on a single
`ResourceSpec` with **no per-variant branch**. The alternative — resolving the variant in the
resource's own file, picking between two complete specs — would duplicate 90 % of the spec per
variant and would leave "the discriminator is mandatory" outside the grammar, i.e. outside what
`meta.describe` (S-028) projects.

**The four name arrays are RE-DERIVED with `Object.keys`, never copied.** They are the very lists
the validator returns by reference in `errorDetails.allowed`; writing them by hand would
reintroduce inside the engine the divergence specs avoid.

**An unknown value THROWS.** It is not a reachable path — the validator already rejected any value
outside `values` — and throwing keeps the invariant visible: a table is **never** resolved by
omission. A spec **without** a discriminator returns the same reference, which is why the four
specs of S-022 and S-024 did not change a line.

**Signature:**
```ts
function resolveVariant(resource: ResourceSpec, value?: string): ResourceSpec
```

**Usage:**
```ts
// core/src/queries/engine/run.ts
const spec = resolveVariant(resource, query.variant);
```

## specFor

**Location:** `core/src/queries/engine/spec.ts`

Resolves a name of the returned set against **both** maps — `base` and `includable` — in one call.

**It exists because that lookup lived in four places** — `selectParts`, `projectRow`,
`attachCollections` and `parseProjection` — each one checking one map on its own. When a relation
became declarable in the base set the four had to change at once, and **the one that forgets does
not fail to compile: it returns the field empty.** The helper leaves the resolution in one place,
so the engine's next capability does not have to remember four files.

**Signature:**
```ts
function specFor(resource: ResourceSpec, name: string): BaseSpec | IncludableSpec | undefined
```

**Usage:**
```ts
// core/src/queries/engine/project.ts
const spec = specFor(resource, name);
if ('constant' in spec) { item[name] = spec.constant; continue; }
```

## isRelation

**Location:** `core/src/queries/engine/spec.ts`

Narrows a `BaseSpec | IncludableSpec` to a `RelationSpec`, wherever it is declared.

Uses `'kind' in spec` and **not a cast**: `BaseFieldSpec` and `BaseConstantSpec` have no `kind`, and
an `as` would switch off exactly the check the three base-set shapes need.

**Signature:**
```ts
function isRelation(spec: BaseSpec | IncludableSpec | undefined): spec is RelationSpec
```

**Usage:**
```ts
// core/src/queries/engine/validate-query.ts
const relations = selected.filter((name) => isRelation(specFor(resource, name)));
```

## deniesAllRows

**Location:** `core/src/queries/engine/spec.ts`

Answers the question `runList` and `runGet` ask **before building anything**: can this caller see no
row at all of this resource?

`true` **if and only if** the caller class is `external` and the spec's `externalScope.kind` is
`'none'`. It is the mechanism behind the fourth clip shape (S-026), the only one that is not a
predicate: the other three **narrow** the set and this one **empties** it, so the engine answers
`items: []` with **zero SQL** instead of a `WHERE FALSE` that would return the same rows and still
pay a round-trip to the database on every request of a portal that has no business reading anything.

Lives next to `resolveVariant` because it is **spec resolution**, not execution: the engine asks and
does not interpret. It **names no resource**, which is the criterion that decides whether the
abstraction held.

The cut runs **after** `validate()`, which runs in the dispatcher: the grammar is the same for the
three caller classes, so an undeclared name is still `invalid_fields` and never `items: []`.

**Signature:**
```ts
function deniesAllRows(resource: ResourceSpec, ctx: QueryContext): boolean
```

**Usage:**
```ts
// core/src/queries/engine/run.ts
if (deniesAllRows(spec, ctx)) {
  const page: Record<string, unknown> = { limit: query.limit, returned: 0 };
  if (query.count !== false) {
    page.total = 0;
  }
  return success({ items: [], page });
}
```

## enumValues

**Location:** `core/src/queries/engine/spec.ts`

**Description:** The VALUES of a spec's enum, in order.

It exists because since S-028 a spec may declare its enum entries in **two shapes** — a plain
string, or `{ value, label }` — and `errorDetails.allowed` has to keep being a list of **strings**.
Without this projection, `allowed` would have started carrying objects, and every consumer of the
shared error catalog would have had to learn about a shape change that does not concern it.

It returns a **new array**, not the spec's list by reference. That is the one place where the
"the list travels by reference" contract is relaxed, and in exchange the spec does not have to keep
two lists of the same enum — which is exactly the parallel structure S-028 exists to avoid.

**Signature:**
```ts
function enumValues(entries: EnumSpec | undefined): string[];
```

**Usage:**
```ts
// core/src/queries/engine/validate-query.ts
const allowed = enumValues(enums[spec.enum]);
if (typeof raw !== 'string' || !allowed.includes(raw)) {
  return invalid(`El filtro "${field}" no acepta ese valor`, { field, value: raw, allowed });
}
```

## enumLabeled

**Location:** `core/src/queries/engine/spec.ts`

**Description:** The same enum as `{ value, label }[]`, with **the raw value as the label's
fallback**. It is what `meta.describe` projects.

The fallback is not laziness: a `label: undefined` in the response would force every consumer to
handle the case, and the raw value is always a legitimate label — it is what the api displayed
before labels existed.

**Signature:**
```ts
function enumLabeled(entries: EnumSpec | undefined): { value: string; label: string }[];
```

**Usage:**
```ts
// core/src/queries/meta/describe-spec.ts
for (const name of Object.keys(spec.enums)) {
  enums[name] = enumLabeled(spec.enums[name]);
}
// -> [{ value: 'tramite', label: 'Trámite' }, …]  for a spec that declares labels
// -> [{ value: 'backlog', label: 'backlog' }, …]  for one that does not
```

## describeResource

**Location:** `core/src/queries/meta/describe-spec.ts`

**Description:** Projects a `ResourceSpec` to the shape `meta.describe` publishes — **the contract
as data**, derived from the very structures the validator reads to reject names.

**It names no resource**, with the same criterion that keeps `engine/spec.ts` generic: it takes a
spec and returns its description, so adding resource 17 does not touch a line of it.

**What it publishes and what it drops** is the whole point, because the spec carries both halves —
the contract's name and the database's — and this function keeps only the first (ADR-004):

| Origin | Published | **Dropped** |
|---|---|---|
| `BaseFieldSpec` | the name, `kind: 'field'` | `column`, `from`, `transform` |
| `BaseConstantSpec` | the name, `kind: 'constant'` | the value |
| `IncludableComputedSpec` | the name, `kind: 'computed'` | **`expr`** (raw SQL) |
| `OneRelationSpec` | `cardinality`, the field NAMES, `optional` | `table`, `localKey`, `targetKey` |
| `ManyRelationSpec` | idem + `cap`, `truncatedFlag`, `scalar` | `table`, `parentKey`, `join`, `where`, `order` |
| `FilterableSpec` | `kind`, the enum name, `search` / `searchNumeric` / `contains.shape` | `column`, `from`, `via`, the search columns, `contains.column` |
| `SortableSpec` | the name | `column`, `nullable` |
| `ExternalScopeSpec` | **nothing** | everything |
| `where` / `table` / `joins` | **nothing** | everything |

A resource **with a discriminator** is described **per variant**, built with `resolveVariant()` —
the same function the engine calls before validating, which is what makes the description and the
validator read literally the same structure. Describing the union would declare a `type` that half
the variants answer `invalid_fields` to.

**Signature:**
```ts
function describeResource(resource: ResourceSpec): ResourceDescription;
```

**Usage:**
```ts
// core/src/queries/meta/meta-describe.ts
const resources: Record<string, ResourceDescription> = {};
for (const spec of specs) {
  resources[spec.name] = describeResource(spec);
}
return Promise.resolve(success({ resources }));
```
