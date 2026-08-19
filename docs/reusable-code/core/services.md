# Services — `core`

## StorageSigner

**Location:** `core/src/commands/files/storage.ts`

**Description:** The S3 signer of `core`: exactly two operations, sign a PutObject and sign a
GetObject. It never performs network I/O — the SDK signs locally with the credentials — which is
what lets it run inside the dispatcher's transaction without risking the 5 s timeout of ADR-002.

It is built **lazily**, at first use, and can be replaced through `setStorageSigner()`. This differs
deliberately from `api/lib/utils/storage-service.ts`, which instantiates at import time and throws
when configuration is missing: copying that pattern would break the whole `core` test suite, since
the test environment has no real credentials.

**Interface:**
```ts
interface StorageSigner {
  readonly bucket: string;
  readonly region: string;
  readonly keyPrefix: string;
  signUpload(key: string, mimeType: string, expiresIn: number): Promise<string>;
  signDownload(
    key: string, fileName: string,
    disposition: 'inline' | 'attachment', expiresIn: number
  ): Promise<string>;
}

function getStorageSigner(): StorageSigner;
function setStorageSigner(replacement: StorageSigner | null): void;
```

**Usage:**
```ts
const signer = getStorageSigner();
const key = buildStorageKey(payload.fileName, signer.keyPrefix);
const uploadUrl = await signer.signUpload(key, payload.mimeType, settings.uploadUrlTtlSeconds);
```

**Do not add** `uploadFromBuffer`, `getFileStream`, `deleteFile`, `listByPrefix` or `headObject`:
`core` signs, it does not move bytes.
