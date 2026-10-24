# Reusable Code Index — `opus-web`

> Partial catalog. It was seeded by story S-007 with the reusable elements that story created;
> it is **not** a full scan of the service. Run `/service-update-reusable-code opus-web` to complete it.

**Last updated:** 2026-10-24 (S-084)

## Components

Total: 5

- **AutomatedIdentityBadge** (`opus-web/src/shared/components/ui/AutomatedIdentityBadge/AutomatedIdentityBadge.tsx`) - Renders the `"Automático"` mark next to an author's name when that author is a service identity, and nothing at all otherwise. Owns the visibility condition and both approved strings.
- **Badge** (`opus-web/src/shared/components/ui/Badge/Badge.tsx`) - Neutral or semantic pill built entirely from tokens. Since S-019 it also forwards `role` and `aria-label`, so a caller can give it a real accessible name.
- **DocsAlert** (`opus-web/src/features/docs/components/DocsAlert/DocsAlert.tsx`) - Inline warning/error notice of the docs module (`role="status"` / `role="alert"`, icon + text, never color alone).
- **DocumentMarkdown** (`opus-web/src/features/docs/components/DocumentMarkdown/DocumentMarkdown.tsx`) - Read-only, safe markdown viewer: no raw HTML, frontmatter stripped, headings shifted one level, attachment links rewritten to the own proxy.
- **DocsSection** (`opus-web/src/features/docs/components/DocsSection/DocsSection.tsx`) - Collapsible "Documentación (n)" section for a project or a requirement; renders nothing when the module is not installed or there are no public documents.

## Services

Total: 7

- **requestUploadTicket** (`opus-web/src/features/attachments/services/attachmentsApi.ts`) - Asks the api for upload permission through the same-origin proxy and returns the `UploadTicket` (`fileId`, `uploadUrl`, `expiresIn`).
- **putFileToStorage** (`opus-web/src/features/attachments/services/attachmentsApi.ts`) - Sends the raw byte straight to the presigned S3 URL over `XMLHttpRequest`, reporting real transfer progress.
- **uploadFile** (`opus-web/src/features/attachments/services/attachmentsApi.ts`) - Composes ticket → PUT → `fileId`. The single entry point every upload in the service goes through.
- **getFilePreviewUrl** (`opus-web/src/features/attachments/services/attachmentsApi.ts`) - Resolves the preview URL of a file that has **no link yet**, by `fileId`.
- **modulesApi.getAll** (`opus-web/src/features/docs/services/modulesApi.ts`) - Reads `GET /api/opus/modules` through the same-origin proxy.
- **docsApi.list** (`opus-web/src/features/docs/services/docsApi.ts`) - Public documents of a project or requirement, 5 per page, cursor-paginated.
- **docsApi.getById** (`opus-web/src/features/docs/services/docsApi.ts`) - One document; downloads `contentUrl` itself when the body exceeds 256 KiB.

## Hooks

Total: 4

- **useModules / useModule** (`opus-web/src/features/docs/hooks/useModules.ts`) - Optional-module status (`['modules']`, refetched every 60 s); `useModule(name)` projects it and treats loading/error as `not_installed` with `isKnown: false`.
- **useDocuments** (`opus-web/src/features/docs/hooks/useDocuments.ts`) - Infinite query of public documents by `projectId` or `requirementId`; invalidates `['modules']` on `module_unavailable`.
- **useDocument** (`opus-web/src/features/docs/hooks/useDocument.ts`) - One document by ULID (`['docs-document', id]`).

## Utils

Total: 5

- **docsUrlTransform** (`opus-web/src/features/docs/utils/docsUrlTransform.ts`) - `urlTransform` for markdown viewers: rewrites `/docs/attachments/{ULID}` (any host) to `/api/docs/attachments/{ULID}`, keeps http(s)/mailto, blanks everything else.
- **stripFrontmatter** (`opus-web/src/features/docs/utils/frontmatter.ts`) - Removes a leading YAML frontmatter block.
- **formatDocDate** (`opus-web/src/features/docs/utils/dates.ts`) - `DD/MM/AAAA`, or `—` for an invalid date.
- **withModuleInvalidation** (`opus-web/src/features/docs/utils/moduleInvalidation.ts`) - Wraps a query function: invalidates `['modules']` on `module_unavailable` and rethrows.
- **classifyDocumentError** (`opus-web/src/features/docs/utils/classifyDocumentError.ts`) - Maps an `ApiError` status to `not_found` / `unavailable` / `system`.

## Types

Total: 7

- **UploadTicket** (`opus-web/src/features/attachments/types/attachment.types.ts`) - Upload permission for a single object: `fileId`, `uploadUrl`, `expiresIn`.
- **UploadTicketInput** (`opus-web/src/features/attachments/types/attachment.types.ts`) - What the client declares to ask for a ticket: `fileName`, `mimeType`, `fileSize`, `checksum`.
- **UploadedFile** (`opus-web/src/features/attachments/types/attachment.types.ts`) - Result of a finished upload: `fileId` plus the three metadata fields read from the browser `File`.
- **IdentityType** (`opus-web/src/shared/types/identity.types.ts`) - Whether an identity is a person or an automated service: `'person' | 'service'`. Mirrors the api enum; the two values are in English because they come from the auth-callout rules, not from the product.
- **AuthorUser** (`opus-web/src/shared/types/identity.types.ts`) - A user as the **author** of something. Mirrors the `AuthorUser` schema of `docs/apis/api.yaml`: `id`, `name`, `email` and an optional `identityType`. It is not the subscriber selector type.
- **DocsDocument** (`opus-web/src/features/docs/types/docs.types.ts`) - Verbatim of the `DocsDocument` contract (`api.yaml`); also `DocsDocumentPage`, `DocsAttachment`, `ModuleEntry`, `ModuleStatus`, `DocsListScope`.
- **ULID_PATTERN** (`opus-web/src/features/docs/constants/docs.constants.ts`) - Single place for the ULID regex used by the viewer and the attachments handler.

## Route Handlers

Total: 2

- **GET/HEAD `/api/files/[id]/preview`** (`opus-web/src/app/api/files/[id]/preview/route.ts`) - Own handler for the preview of a file with **no link**, by `fileId`; forwards the Bearer and returns the api's 302 without following it.
- **GET `/api/docs/attachments/[id]`** (`opus-web/src/app/api/docs/attachments/[id]/route.ts`) - Own handler for docs attachments: validates session and ULID, calls `/api/opus/docs/attachments/{id}` with `redirect: 'manual'` and propagates the 302 with `nosniff`.
