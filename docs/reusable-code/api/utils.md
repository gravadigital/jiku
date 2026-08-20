# Utils — `api`

> Partial catalog seeded by S-005. Run `/service-update-reusable-code api` for a full scan.

## redirectToPresigned

**Location:** `api/lib/utils/bus/download-ticket.ts`

**Description:** Ends a file-read request with a `302` to the presigned URL that `core` signed,
putting the reply metadata into the response headers. Since REQ-001 the `api` never serves bytes:
every read path authorizes, publishes `files.{fileId}.request-download` and delegates the redirect
to this helper, so the four paths cannot drift apart in how they answer. (There were five until
S-009 removed the unauthenticated one.)

Two behaviours it centralizes are easy to get wrong and are load-bearing:

1. **It does not use `res.redirect()`.** Express's implementation calls `format()` + `send(body)`,
   which overwrite `Content-Type` with `text/html` and `Content-Length` with the length of its
   courtesy body — destroying exactly the metadata the redirect exists to carry.
2. **`Content-Length` is sent only on `HEAD`.** It describes the file on the other side of the
   redirect, not this response. On a `GET` it would promise bytes a 302 has no body for, and the
   client would hang until the connection aborted. Frontends read this metadata only via `HEAD`
   (`useAttachmentMeta.ts`, `RichContentRenderer.tsx`), so nothing is lost.

**Signature:**

```ts
function redirectToPresigned(
  req: Request,
  res: Response,
  data: DownloadTicket,
  disposition: 'inline' | 'attachment'
): Response
```

**Usage example:**

```ts
const data = await sendCommand<DownloadTicket>(
  res, `files.${attachment.fileId}.request-download`, { disposition: 'inline' }
);
if (!data) return;

return redirectToPresigned(req, res, data, 'inline');
```

**Used by:** `attachments-preview.ts`, `attachments-download.ts`, `opus-attachments-preview.ts`
and `files-preview.ts`. Four consumers: `opus-attachments-preview.ts` used it twice until S-009
deleted its public handler.

## toUploadTicket

**Location:** `api/lib/utils/bus/upload-ticket.ts`

**Description:** Translates the `data` of a `files.request-upload` reply into the `UploadTicket`
the HTTP contract declares, renaming `id` to `fileId`.

The rename is deliberate, not an oversight to be "unified away". On the bus, `id` is the convention
for every creation command. Over HTTP, `fileId` states *which* id it is — which matters here
because the attachments HTTP contract juggles **two** id spaces: the link id (`/attachments/{id}`)
and the file id (the one that later travels in `fileIds` when saving an entity). Confusing them is
precisely the mistake this name prevents.

It lives in `lib/utils/bus/` —the folder the convention reserves for bus contract translations—
rather than inside a handler, because **both** upload endpoints (internal and opus) share it.
Duplicating it would guarantee they eventually diverge.

**Signature:**

```ts
function toUploadTicket(data: UploadTicketReply): UploadTicket
```

**Usage example:**

```ts
const data = await sendCommand<UploadTicketReply>(res, 'files.request-upload', {
  uploader: actor(req),
  fileName,
  mimeType,
  fileSize,
  ...(checksum !== undefined ? { checksum } : {}),
});
if (!data) return;

return res.status(201).json(toUploadTicket(data));
```

**Used by:** `attachments-post.ts` and `opus-attachments-post.ts`.
