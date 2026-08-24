# Reusable Code Index — `web`

> Partial catalog. It was seeded by story S-006 with the reusable elements that story created;
> it is **not** a full scan of the service. Run `/service-update-reusable-code web` to complete it.

**Last updated:** 2026-08-24 (S-019)

## Components

Total: 1

- **AutomatedIdentityBadge** (`web/src/shared/components/ui/AutomatedIdentityBadge/AutomatedIdentityBadge.tsx`) - The single implementation of the automated-identity mark: renders the `"Automático"` badge only when `identityType === 'service'`, and nothing at all otherwise.

## Services

Total: 4

- **requestUploadTicket** (`web/src/features/attachments/services/attachmentsApi.ts`) - Server Action that asks the api for upload permission and returns the `UploadTicket` (`fileId`, `uploadUrl`, `expiresIn`).
- **putFileToStorage** (`web/src/features/attachments/services/attachmentsClientApi.ts`) - Sends the raw byte straight to the presigned S3 URL over `XMLHttpRequest`, reporting real transfer progress.
- **uploadFile** (`web/src/features/attachments/services/attachmentsClientApi.ts`) - Composes ticket → PUT → `fileId`. The single entry point every upload in the service goes through.
- **getFilePreviewUrl** (`web/src/features/attachments/services/attachmentsClientApi.ts`) - Resolves the preview URL of a file that has **no link yet**, by `fileId`.

## Hooks

Total: 2

- **useUploadAttachment** (`web/src/features/attachments/hooks/useUploadAttachment.ts`) - Sequential upload queue: one file at a time, per-file progress, per-file errors, and retry of the failed ones.
- **useAttachmentMeta** (`web/src/features/attachments/hooks/useAttachmentMeta.ts`) - Resolves name, size and mime of an attachment or a file via `HEAD`, and exposes the error `status`/`code` so callers can tell 403 apart from 404.

## Utils

Total: 3

- **extractFileIds** (`web/src/features/attachments/utils/extractFileIds.ts`) - Reads the `[file:N]` placeholders out of markdown to build the `fileIds` payload.
- **extractAttachmentIds** (`web/src/features/attachments/utils/extractFileIds.ts`) - Reads the `[attach:N]` placeholders — ids of **links**, not of files — out of already-saved markdown.
- **fileErrorMessage** (`web/src/features/attachments/utils/fileErrorMessages.ts`) - Maps the file domain error codes to the user-facing Spanish message, with a fallback.

## Types

Total: 6

- **UploadTicket** (`web/src/features/attachments/types/attachment.types.ts`) - Upload permission for a single object: `fileId`, `uploadUrl`, `expiresIn`.
- **UploadTicketRequest** (`web/src/features/attachments/types/attachment.types.ts`) - What the client declares to ask for a ticket: `fileName`, `mimeType`, `fileSize`, `checksum`.
- **AttachmentResource** (`web/src/features/attachments/types/attachment.types.ts`) - Discriminates the two identifier spaces: `'attachment'` (a link) and `'file'` (a file with no link).
- **UploadQueueError** (`web/src/features/attachments/hooks/useUploadAttachment.ts`) - One failed file in the queue: `fileName`, `message`, `retryable`.
- **IdentityType** (`web/src/features/auth/types/auth.types.ts`) - The two kinds of identity a user row can have: `'person' | 'service'`.
- **AuthorUser** (`web/src/features/auth/types/auth.types.ts`) - A user as an **author**: mirrors the api's `AuthorUser` schema (`id`, `name`, `email`, optional `identityType`), with no `username` and no `roles`.
