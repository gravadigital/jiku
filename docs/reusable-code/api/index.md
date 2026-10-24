# Reusable Code Index — `api`

> Partial catalog. It was seeded by story S-005 with the reusable elements that story created;
> it is **not** a full scan of the service. Run `/service-update-reusable-code api` to complete it.

**Last updated:** 2026-10-24 (S-080)

## Middlewares

Total: 3

- **validateRequirementIsPublic** (`api/lib/utils/middlewares/validate-requirement-is-public.ts`) - Cuts off access to an `internal` requirement across the `/api/opus/*` surface, answering **404 `requirement_not_found`** — identical to a missing id, so the 404 does not confirm the resource exists. Goes after `validateRequirement`. **Does not look at the role**: the trim belongs to the surface, not the caller.
- **requireModule** (`api/lib/utils/middlewares/require-module.ts`) - `requireModule('docs')` cuts a route off with **404 `module_not_installed`** (`not_installed` and `incompatible`) or **503 `module_unavailable`** (`unavailable`), reading the in-memory registry (no bus call). Goes first in the chain: `requireModule('docs') -> hasAnyRole -> Joi` (S-077).
- **publicHostOnly / publicDocsHeaders / requirePublicHost / publicDocsRateLimit / publicDocsAccessLog** (`api/lib/utils/middlewares/public-docs.ts`) - The chain of the public share routes (`/p/docs/*`, mounted at the root, outside `/api`): `publicHostOnly` is the FIRST middleware of the app (in the public host everything but `GET/HEAD /p/docs/*` is the generic 404), `publicDocsHeaders` sets the five read-only headers on every response, `publicDocsAccessLog` logs one line with the token masked, `requirePublicHost` cuts a wrong `Host` with the generic 404, `publicDocsRateLimit` is the single 60/min/IP limiter (in-memory store, per replica; `PUBLIC_DOCS_RATE_STORE.resetAll()` in tests) (S-080).

## Utils

Total: 18

- **buildActor** (`api/lib/utils/bus/actor.ts`) - Builds the reserved `actor` envelope of every command from the **already verified Zitadel claim** (`sub` + the project roles claim), never from the `users` row. Injected once in `sendCommand`, so every command the api publishes carries it (S-029).
- **bus().query()** (`api/lib/utils/bus/index.ts`) - The bus query client: publishes on the `jiku-queries` subject with its own, longer timeout (`NATS_QUERY_TIMEOUT_MS`, 10000), over the same connection, inbox and service user as commands. Has no callers yet, on purpose (S-014).
- **redirectToPresigned** (`api/lib/utils/bus/download-ticket.ts`) - Closes any file-read path with a 302 to the presigned URL signed by `core`, carrying the reply metadata in the headers. Shared by the four read paths that remain after S-009 removed the public one.
- **toUploadTicket** (`api/lib/utils/bus/upload-ticket.ts`) - Translates the `files.request-upload` reply into the HTTP `UploadTicket`, renaming `id` to `fileId`. Shared by the two upload endpoints (S-004).
- **moduleQuery / moduleCommand / runModuleCommand** (`api/lib/modules/client.ts`) - The funnel every documentation route uses to talk to jiku-docs: checks the module state, injects `actor: { id }` (only `id`, the token wins, 401 without a verified identity), builds the subject from the registry's `serviceName`, translates errors with the docs map and returns `data` or `null` once it has answered. `anonymous: true` is kept for compatibility but has no production callers (the public `shares.*` routes use `sendToModule`). `if (!data) return;`; use `runModuleCommand` when success carries no data (S-077).
- **docsModule / listModules** (`api/lib/modules/registry.ts`) - In-memory, per-replica state of the optional `docs` module (`not_installed | incompatible | unavailable | available`), fed by the `JIKU_MODULES` KV watch and a 30 s ping. Two replicas can disagree for up to 30 s. `start()` never rejects; `listModules()` is the public view (`incompatible` reported as `not_installed`) (S-077).
- **DOCS_STATUS_BY_ERROR_CODE / docsHttpStatusFor / docsErrorBody** (`api/lib/modules/docs/errors.ts`) - jiku-docs error codes (30) to HTTP, and the `{ code, message, details? }` body with the code untranslated. Own to the module: do **not** merge with core's `STATUS_BY_ERROR_CODE` (S-077).
- **bus().queryModule / commandModule / pingModule / openModuleKv** (`api/lib/utils/bus/index.ts`) - The module-facing methods of the bus client. `openModuleKv` binds `JIKU_MODULES` read-only with `allow_direct: true`, which is mandatory: with `bindOnly` nats.js would otherwise use `STREAM.MSG.GET`, which the auth-callout does not allow (S-077).
- **isUlid / joiUlid / respondDocsNotFound / ULID_PATTERN** (`api/lib/modules/docs/ids.ts`) - The jiku-docs id format. `isUlid` validates a path id before it reaches the bus (a `.`, `*` or `>` would inject NATS subject tokens); `joiUlid()` is the query-param schema; `respondDocsNotFound(res, code)` answers the 404 of a malformed id exactly like a missing one (S-078); the code also covers `share_not_found` (S-079).
- **contentChecksum** (`api/lib/modules/docs/checksum.ts`) - The jiku-docs `Checksum` (`sha256:` + hex) of the UTF-8 text the api sends in `content` (DD-8). Not the binary checksum of the `storage` convention (S-079).
- **redirectToModuleDownload** (`api/lib/modules/docs/download.ts`) - 302 to the jiku-docs `downloadUrl` with `X-Content-Type-Options: nosniff`, no body, no `Content-Type`/`Content-Disposition` (the reply carries no file metadata). Not `res.redirect()`; not `redirectToPresigned` (S-078).
- **pickDefined / buildPage / PAGE_LIMIT_MAX** (`api/lib/modules/docs/query.ts`) - Build the jiku-docs payload from validated query params: `filter` only with the keys that came (never `undefined`/`null`), `page` with `cursor` only if present, and the 200 effective page maximum (S-078).
- **sendToModule / ModuleOutcome** (`api/lib/modules/client.ts`) - Publishes to a module with the body AS IS (no `actor` added or removed, does not look at the module state) and returns a typed outcome (`data | failure | timeout | unreachable`) instead of answering HTTP. For routes that cannot answer JSON, like the public share pages; `moduleQuery` is built on it (S-080).
- **publicDocsHost / isPublicHostRequest / assertPublicUrlConfig / maskPublicDocsUrl / PUBLIC_DOCS_PATH** (`api/lib/modules/docs/public-url.ts`) - The public host derived from `JIKU_PUBLIC_URL` (read on every call; blank = `null`), the raw `Host` comparison (never `X-Forwarded-Host`), the startup assert (invalid URL, non-http(s), or with path/query/fragment stops the api) and the token-masking of a `/p/docs/*` URL for logs (S-080).
- **sendPublicNotice / sendSharedDocument / renderSharedDocument / escapeHtml / PUBLIC_DOCS_HEADERS / PUBLIC_NOTICES** (`api/lib/modules/docs/public-page.ts`) - The minimal HTML template of the public share page and the three identical exception pages (404 / 429 / 503), with the read-only headers (CSP, noindex, no-referrer, no-store, nosniff). The 404 is the same byte for byte for any cause (S-080).
- **fetchSharedHtml** (`api/lib/modules/docs/public-html.ts`) - Downloads the presigned `htmlUrl` of `shares.resolve` as text (<= 5 MiB, 10 s, no redirects, only 200). Throws on any failure; never logs the URL (S-080).
- **queryShare / clientInfo / SHARE_TOKEN_PATTERN** (`api/lib/modules/docs/public-share.ts`) - Steps 4 and 5 of the public chain: module state + `shares.resolve` / `shares.attachment` without `actor`, collapsed to `{ ok, data } | { ok: false, status: 404 | 503 }`; `clientInfo(req)` builds the optional `client` (`ip` <= 100, `userAgent` <= 2000) for jiku-docs' access audit (S-080).
- **parseTrustProxy** (`api/lib/utils/trust-proxy.ts`) - Turns `API_TRUST_PROXY` into the value for `app.set('trust proxy', ...)`: blank = `undefined`, digits = number of hops, `true`/`false` = boolean, anything else as a string (S-080).

## Types

Total: 8

- **DownloadTicket** (`api/lib/utils/bus/download-ticket.ts`) - The `data` of the `files.{fileId}.request-download` reply: `downloadUrl`, `expiresIn`, `fileName`, `mimeType`, `fileSize`.
- **UploadTicketReply** (`api/lib/utils/bus/upload-ticket.ts`) - The `data` of the `files.request-upload` reply: `id` (of `files`), `uploadUrl`, `expiresIn`.
- **UploadTicket** (`api/lib/utils/bus/upload-ticket.ts`) - The HTTP upload-permission contract: `fileId`, `uploadUrl`, `expiresIn`.
- **ModuleDownloadTicket** (`api/lib/modules/docs/download.ts`) - The `data` of `attachments.{id}.request-download`: `id`, `downloadUrl`, `expiresIn` (S-078).
- **ModuleTarget** (`api/lib/utils/bus/index.ts`) - `{ serviceName, protocol }` read from the module registry; the subject of a module call is built from it (S-077).
- **ModuleKv** (`api/lib/utils/bus/index.ts`) - Read-only view of the `JIKU_MODULES` bucket: `get(key)` and `watch(key, onEntry)`, plus `ModuleKvEntry` and `ModuleKvWatch` (S-077).
- **ModuleStatus** (`api/lib/modules/registry.ts`) - Internal state of a module, `not_installed | incompatible | unavailable | available`; `PublicModuleStatus` drops `incompatible` (S-077).
- **ModuleStatusEntry** (`api/lib/modules/registry.ts`) - One item of `GET /modules`: `{ module, status, features? }` (S-077).

## Test Helpers

Total: 9

- **dayOffset / HOY / HOY_M10 / HOY_M11 / MANANA** (`api/tests/helpers/dates.ts`) - Dates relative to today, never literals, for the time-tracking test suites. Mirrors `core/tests/helpers/dates.ts` so both halves of the S-031 parity test spell the same boundary the same way. Uses `setUTCDate` + `toISOString`, never millisecond arithmetic (S-031).
- **token_05_user_profile** (`api/tests/mocks/jsonwebtoken-mock.ts`) - The only mock token carrying the three OIDC profile claims (`name`, `preferred_username`, `email`). Use it to test what travels in the identity envelope when the Zitadel instance emits the profile scopes; the other four tokens cover the opposite case (S-029).
- **fakeBus.failWithNoResponders()** (`api/tests/mocks/bus.ts`) - Simulates that nobody is subscribed to the subject, so a test does not have to build the `NatsError` by hand. The api answers `503 service_unavailable`.
- **fakeBus.failWithTimeout()** (`api/tests/mocks/bus.ts`) - Simulates that the reply never arrived. The api answers `504 gateway_timeout`. A bare `new Error('timeout')` is **not** a timeout for the api: this is the only way to simulate one.
- **FakeBus — modules** (`api/tests/mocks/bus.ts`) - Simulated `JIKU_MODULES` KV (`kvPut` / `kvDelete` / `kvPurge`, `kvFailWith` / `kvHeal`, `kvCloseWatchers`), ping (`pingResponds`, `pings`) and module calls (`moduleReply`, `moduleFailWith*`, `moduleSent`, `lastModule`). `await fakeBus.kvPut(...)` settles the registry (S-077).
- **token_08_no_roles** (`api/tests/mocks/jsonwebtoken-mock.ts`) - A valid token with no roles at all, to prove `hasAnyRole` answers 403 even when authentication passes (S-077).
- **docs-module helper** (`api/tests/helpers/docs-module.ts`) - `docsAvailable()` / `docsUnavailable()` / `docsNotInstalled()` leave the registry settled in each state; `success(data)` / `failure(code, message, details?)` build a `Reply`; `DOC_ID` / `FOLDER_ID` / `ATT_ID` / `SESSION_ID` / `SHARE_ID` / `FOLDER2_ID` and the subject prefixes; `itRespectsModuleState(getApp, url, token, title?, { method?, body? })` registers the TS-45 test (404 / 503 with no module call) for a route of any method (S-078, S-079).
- **fakeBus.pingResponds before moduleFailWithNoResponders** (`api/tests/mocks/bus.ts`) - A `no responders` marks the module `unavailable` and re-pings; set `pingResponds(..., false)` first or the status goes back to `available` (S-078).
- **public-docs helper** (`api/tests/helpers/public-docs.ts`) - Shared by the public share route tests: `PUBLIC_URL` / `PUBLIC_HOST` / `TOKEN` / `UA` / `RESOLVED` constants, `publicGet(app, url)` (public `Host`, no session, no redirects followed), `shouldHavePublicHeaders(res)` (the five headers with exact values and no cookie) and `resetPublicRateLimit()` (S-080).
