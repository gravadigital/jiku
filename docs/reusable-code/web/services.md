# Services — `web`

> Partial catalog seeded by S-006. Run `/service-update-reusable-code web` for a full scan.

## requestUploadTicket

**Location:** `web/src/features/attachments/services/attachmentsApi.ts`

**Description:** Server Action that asks the api for permission to upload one file and returns the
`UploadTicket`. It sends **only** the four contract fields — sending an entity would be a leftover
of the draft model REQ-001 removed, since uploading no longer mentions any entity.

It lives in the `'use server'` module on purpose: the request needs the access token, which the
`apiClient` interceptor injects and which never reaches the browser. The `uploadUrl` that comes
back **does** reach the browser, and that is the one declared exception to ADR-009: it is a
single-object, short-TTL presigned URL, not a reusable credential.

**Signature:**

```ts
async function requestUploadTicket(payload: UploadTicketRequest): Promise<UploadTicket>;
```

**Usage:**

```ts
const ticket = await requestUploadTicket({
  fileName: file.name,
  mimeType: file.type,
  fileSize: file.size,
  checksum: null,
});
```

---

## putFileToStorage

**Location:** `web/src/features/attachments/services/attachmentsClientApi.ts`

**Description:** Sends the raw byte straight to the presigned S3 URL. It never touches the api, the
BFF or the bus.

Two things about it are load-bearing:

1. **It uses `XMLHttpRequest`, not `fetch`.** `fetch` gives no upload progress, and real progress is
   the whole point of the direct upload. This is the only reason the transport is still XHR.
2. **It sets no `Authorization` header.** The authorization travels signed in the URL's query
   string. Adding the header would leak the session token to the storage provider.

A `403` (expired URL) rejects with a distinguishable error — check it with
`isExpiredUploadUrlError` — so the UI can offer a retry that asks for a **fresh ticket**. There is
no automatic retry inside: retrying with an already-expired URL fails the same way.

**Signature:**

```ts
function putFileToStorage(params: {
  uploadUrl: string;
  file: File;
  onProgress?: (progress: number) => void;
}): Promise<void>;

function isExpiredUploadUrlError(error: unknown): boolean;
```

---

## uploadFile

**Location:** `web/src/features/attachments/services/attachmentsClientApi.ts`

**Description:** Composes the full single-file flow — ticket → `PUT` → `fileId` — and is the entry
point every upload in the service goes through. Mixing a Server Action (for the ticket) with raw
XHR (for the byte) is deliberate: the ticket needs the token, the byte does not.

It imports the Server Action **dynamically**, so this browser module does not drag `apiClient`
— and with it `auth()` — into its static graph.

**Signature:**

```ts
async function uploadFile(
  file: File,
  options?: { onProgress?: (progress: number) => void }
): Promise<number>;
```

**Usage:**

```ts
const fileId = await uploadFile(file, {
  onProgress: (progress) => setProgress(progress),
});
```

---

## getFilePreviewUrl

**Location:** `web/src/features/attachments/services/attachmentsClientApi.ts`

**Description:** Resolves the preview URL of a file that has **no link yet**, by its `fileId`. It
exists because the two identifier spaces cannot be mixed: resolving a `fileId` against
`/api/attachments/{id}/preview` would return a 404 or — worse — the preview of a *different*
attachment that happens to have that id. Use `getPreviewUrl` / `getDownloadUrl` for links.

**Signature:**

```ts
function getFilePreviewUrl(fileId: number): string; // → /api/files/{fileId}/preview
```
