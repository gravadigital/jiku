# Utils — `core`

## resolveActor

**Location:** `core/src/commands/files/resolve-actor.ts`

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
