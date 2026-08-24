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
