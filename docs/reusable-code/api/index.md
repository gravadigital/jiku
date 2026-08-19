# Reusable Code Index — `api`

> Partial catalog. It was seeded by story S-005 with the reusable elements that story created;
> it is **not** a full scan of the service. Run `/service-update-reusable-code api` to complete it.

**Last updated:** 2026-08-19 (S-004)

## Utils

Total: 2

- **redirectToPresigned** (`api/lib/utils/bus/download-ticket.ts`) - Closes any file-read path with a 302 to the presigned URL signed by `core`, carrying the reply metadata in the headers. Shared by the five read paths created in S-005.
- **toUploadTicket** (`api/lib/utils/bus/upload-ticket.ts`) - Translates the `files.request-upload` reply into the HTTP `UploadTicket`, renaming `id` to `fileId`. Shared by the two upload endpoints (S-004).

## Types

Total: 3

- **DownloadTicket** (`api/lib/utils/bus/download-ticket.ts`) - The `data` of the `files.{fileId}.request-download` reply: `downloadUrl`, `expiresIn`, `fileName`, `mimeType`, `fileSize`.
- **UploadTicketReply** (`api/lib/utils/bus/upload-ticket.ts`) - The `data` of the `files.request-upload` reply: `id` (of `files`), `uploadUrl`, `expiresIn`.
- **UploadTicket** (`api/lib/utils/bus/upload-ticket.ts`) - The HTTP upload-permission contract: `fileId`, `uploadUrl`, `expiresIn`.
