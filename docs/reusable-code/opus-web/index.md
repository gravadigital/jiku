# Reusable Code Index — `opus-web`

> Partial catalog. It was seeded by story S-007 with the reusable elements that story created;
> it is **not** a full scan of the service. Run `/service-update-reusable-code opus-web` to complete it.

**Last updated:** 2026-08-19 (S-007)

## Services

Total: 4

- **requestUploadTicket** (`opus-web/src/features/attachments/services/attachmentsApi.ts`) - Asks the api for upload permission through the same-origin proxy and returns the `UploadTicket` (`fileId`, `uploadUrl`, `expiresIn`).
- **putFileToStorage** (`opus-web/src/features/attachments/services/attachmentsApi.ts`) - Sends the raw byte straight to the presigned S3 URL over `XMLHttpRequest`, reporting real transfer progress.
- **uploadFile** (`opus-web/src/features/attachments/services/attachmentsApi.ts`) - Composes ticket → PUT → `fileId`. The single entry point every upload in the service goes through.
- **getFilePreviewUrl** (`opus-web/src/features/attachments/services/attachmentsApi.ts`) - Resolves the preview URL of a file that has **no link yet**, by `fileId`.

## Types

Total: 3

- **UploadTicket** (`opus-web/src/features/attachments/types/attachment.types.ts`) - Upload permission for a single object: `fileId`, `uploadUrl`, `expiresIn`.
- **UploadTicketInput** (`opus-web/src/features/attachments/types/attachment.types.ts`) - What the client declares to ask for a ticket: `fileName`, `mimeType`, `fileSize`, `checksum`.
- **UploadedFile** (`opus-web/src/features/attachments/types/attachment.types.ts`) - Result of a finished upload: `fileId` plus the three metadata fields read from the browser `File`.

## Route Handlers

Total: 1

- **GET/HEAD `/api/files/[id]/preview`** (`opus-web/src/app/api/files/[id]/preview/route.ts`) - Own handler for the preview of a file with **no link**, by `fileId`; forwards the Bearer and returns the api's 302 without following it.
