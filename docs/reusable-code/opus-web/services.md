# Services — `opus-web`

> Partial catalog seeded by S-007. Run `/service-update-reusable-code opus-web` for a full scan.

## requestUploadTicket

**Location:** `opus-web/src/features/attachments/services/attachmentsApi.ts`

**Description:** Asks the api for permission to upload one file and returns the `UploadTicket`. It
sends **only** the four contract fields — sending an entity would be a leftover of the draft model
REQ-001 removed, since uploading no longer mentions any entity.

The call goes through `apiClient` to `/api/opus/attachments`, so the catch-all route handler adds
the Bearer on the server and the access token never reaches the browser. The `uploadUrl` that comes
back **does** reach the browser, and that is the one declared exception to ADR-009: it is a
single-object, short-TTL presigned URL, not a reusable credential.

`checksum` defaults to `null`: the contract accepts it but nobody verifies it, so computing a
sha256 would cost a full pass over the file for a field the server ignores.

**Signature:**

```ts
async function requestUploadTicket(input: UploadTicketInput): Promise<UploadTicket>;
```

**Usage:**

```ts
const ticket = await attachmentsApi.requestUploadTicket({
  fileName: file.name,
  mimeType: file.type,
  fileSize: file.size,
});
```

---

## putFileToStorage

**Location:** `opus-web/src/features/attachments/services/attachmentsApi.ts`

**Description:** Sends the raw `File` to the presigned URL with `PUT`. It uses `XMLHttpRequest` and
not `fetch` because it is the only browser API that exposes `upload.onprogress` with
`loaded`/`total`, which is where the real percentage comes from.

The URL already carries the signature in its query string, so no `Authorization` and no cookies are
sent, and `withCredentials` stays `false` — setting it to `true` would break the CORS preflight
against a bucket with an explicit `AllowedOrigin`, and the symptom would be an opaque network error.

It never retries: an expired URL needs a fresh ticket, not a repeat of the same `PUT`. Errors are
built by hand with the `ApiError` shape, since this path does not go through the axios interceptor.
S3 answers XML on failure, so the body is never parsed — telling `403` (expired) apart from
`status: 0` (network or missing CORS) is all the UI needs.

**Signature:**

```ts
function putFileToStorage(
  uploadUrl: string,
  file: File,
  onProgress: (percent: number) => void,
  contentType?: string
): Promise<void>;
```

**Error codes:** `upload_url_expired` (403) · `upload_network_error` (status 0) ·
`upload_aborted` · `upload_error` (any other non-2xx).

---

## uploadFile

**Location:** `opus-web/src/features/attachments/services/attachmentsApi.ts`

**Description:** Composes the two steps — ticket then `PUT` — and resolves with the `fileId`, which
is what later travels in `fileIds` when the entity is saved. The three metadata fields come from the
browser `File` and not from the api, because the api no longer sees the byte.

It is called with `await` from a component handler rather than wrapped in a `useMutation`: the
result goes to the editor's local state, not to a query cache, and the incremental progress has no
cache representation.

**Signature:**

```ts
async function uploadFile(
  file: File,
  onProgress: (percent: number) => void
): Promise<UploadedFile>;
```

**Usage:**

```ts
const uploaded = await attachmentsApi.uploadFile(file, setUploadProgress);
setPendingAttachments((prev) => [...prev, { fileId: uploaded.fileId, ... }]);
```

---

## getFilePreviewUrl

**Location:** `opus-web/src/features/attachments/services/attachmentsApi.ts`

**Description:** Resolves the preview URL of a file that has **no link yet**, by `fileId`. It is the
editor's read path: while the comment or requirement is unsaved there is no `attachments` row to ask
for, so the read enters through the file's own identifier space.

Its sibling `getPreviewUrl(id)` resolves an **already linked** attachment by `attachments.id` and is
what the activity feed uses. Confusing the two is silent: it returns the wrong file or a 404,
depending on what exists under that number.

**Signature:**

```ts
function getFilePreviewUrl(fileId: number): string; // -> /api/files/{fileId}/preview
function getPreviewUrl(id: number): string;         // -> /api/attachments/{id}/preview
```
