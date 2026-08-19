# Reusable Code Index — `api`

> Partial catalog. It was seeded by story S-005 with the reusable elements that story created;
> it is **not** a full scan of the service. Run `/service-update-reusable-code api` to complete it.

**Last updated:** 2026-08-19 (S-005)

## Utils

Total: 1

- **redirectToPresigned** (`api/lib/utils/bus/download-ticket.ts`) - Closes any file-read path with a 302 to the presigned URL signed by `core`, carrying the reply metadata in the headers. Shared by the five read paths created in S-005.

## Types

Total: 1

- **DownloadTicket** (`api/lib/utils/bus/download-ticket.ts`) - The `data` of the `files.{fileId}.request-download` reply: `downloadUrl`, `expiresIn`, `fileName`, `mimeType`, `fileSize`.
