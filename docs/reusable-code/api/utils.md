# Utils — `api`

> Partial catalog seeded by S-005. Run `/service-update-reusable-code api` for a full scan.

## redirectToPresigned

**Location:** `api/lib/utils/bus/download-ticket.ts`

**Description:** Ends a file-read request with a `302` to the presigned URL that `core` signed,
putting the reply metadata into the response headers. Since REQ-001 the `api` never serves bytes:
every read path authorizes, publishes `files.{fileId}.request-download` and delegates the redirect
to this helper, so the five paths cannot drift apart in how they answer.

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
(both handlers) and `files-preview.ts`.
