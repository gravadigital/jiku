# Reusable Code Index — `web`

> Partial catalog. It was seeded by story S-006 with the reusable elements that story created;
> it is **not** a full scan of the service. Run `/service-update-reusable-code web` to complete it.

**Last updated:** 2026-09-01 (S-048)

## Components

Total: 1

- **AutomatedIdentityBadge** (`web/src/shared/components/ui/AutomatedIdentityBadge/AutomatedIdentityBadge.tsx`) - The single implementation of the automated-identity mark: renders the `"Automático"` badge only when `identityType === 'service'`, and nothing at all otherwise.

## Services

Total: 7

- **requestUploadTicket** (`web/src/features/attachments/services/attachmentsApi.ts`) - Server Action that asks the api for upload permission and returns the `UploadTicket` (`fileId`, `uploadUrl`, `expiresIn`).
- **putFileToStorage** (`web/src/features/attachments/services/attachmentsClientApi.ts`) - Sends the raw byte straight to the presigned S3 URL over `XMLHttpRequest`, reporting real transfer progress.
- **uploadFile** (`web/src/features/attachments/services/attachmentsClientApi.ts`) - Composes ticket → PUT → `fileId`. The single entry point every upload in the service goes through.
- **getRequirementsCount** (`web/src/features/requirements/services/requirementsApi.ts`) - Server Action that returns the raw count of requirements matching a filter set, by passing `count: true` inside the filters object (not concatenated onto the query string) so `cleanFilters` handles it correctly.
- **getFilePreviewUrl** (`web/src/features/attachments/services/attachmentsClientApi.ts`) - Resolves the preview URL of a file that has **no link yet**, by `fileId`.
- **getRequirementWorkedHours** (`web/src/features/requirements/services/requirementsApi.ts`) - Server Action that returns the total minutes and per-person breakdown for a single requirement (`GET /requirements/{reqid}/worked-hours`); no filters, the id goes in the path.
- **updateRequirementComment** (`web/src/features/requirements/services/requirementsApi.ts`) - Server Action that edits an already-published requirement comment (`PATCH /requirements/{reqid}/comments/{cid}`, note plural `/comments/`); `fileIds`, when sent, is the complete set to keep linked, never a delta.

## Hooks

Total: 5

- **useUploadAttachment** (`web/src/features/attachments/hooks/useUploadAttachment.ts`) - Sequential upload queue: one file at a time, per-file progress, per-file errors, and retry of the failed ones.
- **useAttachmentMeta** (`web/src/features/attachments/hooks/useAttachmentMeta.ts`) - Resolves name, size and mime of an attachment or a file via `HEAD`, and exposes the error `status`/`code` so callers can tell 403 apart from 404.
- **useRequirementsCount** (`web/src/features/requirements/hooks/useRequirementsCount.ts`) - Wraps `getRequirementsCount` in `useQuery` with key `['requirements-count', filters]`; inherits the global 30s `staleTime`, no per-hook override.
- **useRequirementWorkedHours** (`web/src/features/requirements/hooks/useRequirementWorkedHours.ts`) - Wraps `getRequirementWorkedHours` in `useQuery` with key `['requirement-worked-hours', reqid]`; a query of its own, independent of the requirement's detail query, so it degrades on its own without blocking the rest of the screen.
- **useUpdateRequirementComment** (`web/src/features/requirements/hooks/useUpdateRequirementComment.ts`) - Wraps `updateRequirementComment` in `useMutation`; invalidates both `['requirement', reqid]` and `['attachments', 'requirement_comment', cid]` on success.

## Utils

Total: 5

- **extractFileIds** (`web/src/features/attachments/utils/extractFileIds.ts`) - Reads the `[file:N]` placeholders out of markdown to build the `fileIds` payload.
- **extractAttachmentIds** (`web/src/features/attachments/utils/extractFileIds.ts`) - Reads the `[attach:N]` placeholders — ids of **links**, not of files — out of already-saved markdown.
- **fileErrorMessage** (`web/src/features/attachments/utils/fileErrorMessages.ts`) - Maps the file domain error codes to the user-facing Spanish message, with a fallback.
- **commentErrorMessage** (`web/src/features/attachments/utils/fileErrorMessages.ts`) - Maps the comment-edit domain error codes (`comment_not_owned`, `activity_not_editable`, `comment_not_found`, `file_not_owned`, `service_unavailable`, `gateway_timeout`) to the user-facing Spanish message; unknown codes always fall back to the caller-supplied text.
- **getPageWindow** (`web/src/shared/components/ui/Pagination/getPageWindow.ts`) - Pure function that computes a sliding window of at most 10 page numbers, centered on the current page and clamped to `[1, totalPages]`. No React dependency; used by `Pagination`.

## Types

Total: 6

- **UploadTicket** (`web/src/features/attachments/types/attachment.types.ts`) - Upload permission for a single object: `fileId`, `uploadUrl`, `expiresIn`.
- **UploadTicketRequest** (`web/src/features/attachments/types/attachment.types.ts`) - What the client declares to ask for a ticket: `fileName`, `mimeType`, `fileSize`, `checksum`.
- **AttachmentResource** (`web/src/features/attachments/types/attachment.types.ts`) - Discriminates the two identifier spaces: `'attachment'` (a link) and `'file'` (a file with no link).
- **UploadQueueError** (`web/src/features/attachments/hooks/useUploadAttachment.ts`) - One failed file in the queue: `fileName`, `message`, `retryable`.
- **IdentityType** (`web/src/features/auth/types/auth.types.ts`) - The two kinds of identity a user row can have: `'person' | 'service'`.
- **AuthorUser** (`web/src/features/auth/types/auth.types.ts`) - A user as an **author**: mirrors the api's `AuthorUser` schema (`id`, `name`, `email`, optional `identityType`), with no `username` and no `roles`.
