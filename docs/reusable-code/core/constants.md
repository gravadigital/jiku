# Constants & Config — `core`

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
