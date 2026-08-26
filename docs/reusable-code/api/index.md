# Reusable Code Index — `api`

> Partial catalog. It was seeded by story S-005 with the reusable elements that story created;
> it is **not** a full scan of the service. Run `/service-update-reusable-code api` to complete it.

**Last updated:** 2026-08-25 (S-031)

## Utils

Total: 4

- **buildActor** (`api/lib/utils/bus/actor.ts`) - Builds the reserved `actor` envelope of every command from the **already verified Zitadel claim** (`sub` + the project roles claim), never from the `users` row. Injected once in `sendCommand`, so every command the api publishes carries it (S-029).
- **bus().query()** (`api/lib/utils/bus/index.ts`) - The bus query client: publishes on the `jiku-queries` subject with its own, longer timeout (`NATS_QUERY_TIMEOUT_MS`, 10000), over the same connection, inbox and service user as commands. Has no callers yet, on purpose (S-014).
- **redirectToPresigned** (`api/lib/utils/bus/download-ticket.ts`) - Closes any file-read path with a 302 to the presigned URL signed by `core`, carrying the reply metadata in the headers. Shared by the four read paths that remain after S-009 removed the public one.
- **toUploadTicket** (`api/lib/utils/bus/upload-ticket.ts`) - Translates the `files.request-upload` reply into the HTTP `UploadTicket`, renaming `id` to `fileId`. Shared by the two upload endpoints (S-004).

## Types

Total: 3

- **DownloadTicket** (`api/lib/utils/bus/download-ticket.ts`) - The `data` of the `files.{fileId}.request-download` reply: `downloadUrl`, `expiresIn`, `fileName`, `mimeType`, `fileSize`.
- **UploadTicketReply** (`api/lib/utils/bus/upload-ticket.ts`) - The `data` of the `files.request-upload` reply: `id` (of `files`), `uploadUrl`, `expiresIn`.
- **UploadTicket** (`api/lib/utils/bus/upload-ticket.ts`) - The HTTP upload-permission contract: `fileId`, `uploadUrl`, `expiresIn`.

## Test Helpers

Total: 4

- **dayOffset / HOY / HOY_M10 / HOY_M11 / MANANA** (`api/tests/helpers/dates.ts`) - Dates relative to today, never literals, for the time-tracking test suites. Mirrors `core/tests/helpers/dates.ts` so both halves of the S-031 parity test spell the same boundary the same way. Uses `setUTCDate` + `toISOString`, never millisecond arithmetic (S-031).
- **token_05_user_profile** (`api/tests/mocks/jsonwebtoken-mock.ts`) - The only mock token carrying the three OIDC profile claims (`name`, `preferred_username`, `email`). Use it to test what travels in the identity envelope when the Zitadel instance emits the profile scopes; the other four tokens cover the opposite case (S-029).
- **fakeBus.failWithNoResponders()** (`api/tests/mocks/bus.ts`) - Simulates that nobody is subscribed to the subject, so a test does not have to build the `NatsError` by hand. The api answers `503 service_unavailable`.
- **fakeBus.failWithTimeout()** (`api/tests/mocks/bus.ts`) - Simulates that the reply never arrived. The api answers `504 gateway_timeout`. A bare `new Error('timeout')` is **not** a timeout for the api: this is the only way to simulate one.
