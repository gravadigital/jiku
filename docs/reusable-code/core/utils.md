# Utils — `core`

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
with one `UPDATE` and inserts one `attachments` row per file. Repeated ids are deduplicated
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

Unlinking is a **hard delete** (`destroy({ force: true })`), never `softDelete()`: the latter writes
`retention_status` and `deleted_at` on `attachments`, columns migration `20260819_05` already
dropped. It operates on the **link**, never on the file.

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
