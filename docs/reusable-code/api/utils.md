# Utils — `api`

> Partial catalog seeded by S-005. Run `/service-update-reusable-code api` for a full scan.

## bus().query()

**Location:** `api/lib/utils/bus/index.ts`

**Description:** The query side of the bus client. Mirrors `request()` with two differences and only
two: the `{svc}` token of the subject (`jiku-queries` instead of `jiku-commands`, built with
`querySubject()` from `@jiku/nats-protocol` — nothing is concatenated by hand) and the timeout,
which is its own and longer.

**It runs over the same connection, the same inbox and the same service user as commands.** What is
separated is the timeout and the subject, not the transport: a second connection would ask the
auth-callout for a new identity and widen the authentication surface for nothing.

The timeout is separate because the profile is the opposite one: a read is long joins, a write is a
short transaction. Sharing one value would force a choice between cutting legitimate reads short and
handing every write five extra seconds. There is also an operational invariant behind it — core's
`POSTGRESQL_STATEMENT_TIMEOUT_MS` (8000) must stay strictly below `NATS_QUERY_TIMEOUT_MS` (10000),
so the database cuts first and the error is explainable instead of a mute bus timeout.

**It has no callers, deliberately** (S-014, CA-7). The api's read endpoints keep reading PostgreSQL
directly (ADR-001) and do not migrate to the bus; the client is delivered ahead of the requirement
that will define the query contract. Until `jiku-queries` is deployed, a query gets the server's
*no responders* — which is exactly the correct answer.

**Inherited constraint for whoever writes the first caller:** `opus-web` pins a 10 s timeout in its
own HTTP client. With commands (5000 ms) the 504 arrives comfortably and its message is shown; with
`NATS_QUERY_TIMEOUT_MS` (10000) the two tie, and the portal would show axios' generic error
*instead* of the body's message.

**Signature:**

```ts
interface Bus {
  request<T = any>(command: string, payload: unknown): Promise<Reply<T>>;
  query<T = any>(query: string, payload: unknown): Promise<Reply<T>>;
}
```

**Usage example:**

```ts
// The subject ends up as `{instance}.{userId}.jiku-queries.v1.tasks.list`.
const reply = await bus().query('tasks.list', { projectId: 1 });
```

**Used by:** nobody yet, and that is the point (CA-7).

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
  uploader: actorId(req),
  fileName,
  mimeType,
  fileSize,
  ...(checksum !== undefined ? { checksum } : {}),
});
if (!data) return;

return res.status(201).json(toUploadTicket(data));
```

**Used by:** `attachments-post.ts` and `opus-attachments-post.ts`.

## buildActor

**Location:** `api/lib/utils/bus/actor.ts`

**Description:** Builds the `Actor` envelope — the reserved top-level key of every command message
— out of the JWT the api **already verified against Zitadel**: `id` from `decodedToken.sub`,
`roles` from `decodedTokenRoles` (the `urn:zitadel:iam:org:project:roles` claim), plus the three
optional profile claims.

**It does not read `req.user`, and that is not an oversight.** The row is right there, loaded by
`validateToken`, with all five fields and even with `roles`. Using it is a one-line change that
*looks* like an improvement and introduces two sources of identity for the same thing, with the
worse of the two deciding. ADR-007 forbids it verbatim: *"roles MUST NOT be stored in the database
nor derived from another source"*. The claim is also **fresher** than the row — and it is core's
identity mirror that makes the two converge.

Two shape rules matter to the consumer:

- A profile claim travels **only if it is a non-empty string**. An absent, empty or non-string
  claim produces **no key at all** — not a key set to `undefined`: core's mirror distinguishes "it
  was not sent" from "it was sent empty", and that is what keeps an envelope without `name` from
  wiping the name the row already had.
- `roles` is **mandatory** in the contract: with no claim it is `[]`, never `undefined`.

It returns `undefined` when there is no verified token, which publishes the command **exactly as it
behaved before the envelope existed** rather than failing. Unreachable today — the four lists in
`config/public.ts` are empty — but it is the safe direction.

`identityType` is deliberately **not** part of the envelope: core writes `'person'` as a literal.
Sending it would give the api the ability to declare that a person is a service.

**Signature:**

```ts
function buildActor(req: Request | undefined): Actor | undefined
```

**Usage example:**

```ts
// It is injected ONCE, in the funnel — never at the call sites.
function withActor(res: Response, command: string, payload: unknown): unknown {
  const actor = buildActor(res.req);
  if (!actor) return payload;
  return { ...payload, actor };   // the envelope goes AFTER the spread: the token always wins
}
```

**Used by:** `sendCommand` (`api/lib/utils/bus/send-command.ts`), and through it every command the
api publishes — `runCommand` included — and `call()` in `api/lib/modules/client.ts`, which sends the same envelope, unchanged, to jiku-docs (REQ-019; fails closed with 401 when it returns `undefined`). `bus().query()` deliberately does **not** use it: the query
plane resolves identity from the subject and only from there.

## moduleQuery / moduleCommand / runModuleCommand

**Location:** `api/lib/modules/client.ts`

**Description:** The funnel for talking to an optional module (jiku-docs). Checks the registry state
(404/503 without publishing), injects the full `actor` from `buildActor(res.req)` — `{ id, roles, name?, username?, email? }`, the same envelope core receives (REQ-019) — after the payload spread (the token wins, whole; 401
without a verified identity, failing closed because a call without `actor` is treated by jiku-docs as
the `service` class), builds the subject from the registry's `serviceName` and translates errors with
the docs map. Never logs the payload.

**Signature:**

```ts
function moduleQuery<T = any>(res: Response, module: ModuleName, method: string, payload: Record<string, unknown>, options?: { anonymous?: boolean }): Promise<T | null>
function moduleCommand<T = any>(/* same */): Promise<T | null>
function runModuleCommand(/* same */): Promise<boolean>
```

**Usage example:**

```ts
const data = await moduleQuery(res, 'docs', 'documents.list', { filter: { projectId } });
if (!data) return;
res.status(200).json(data);
```

## docsModule / listModules

**Location:** `api/lib/modules/registry.ts`

**Description:** In-memory state of the `docs` module per replica (replicas may disagree for up to
30 s). Reads `JIKU_MODULES` at startup, watches the key and pings every 30 s; `no responders` on a call
marks it `unavailable` at once. `start()` is idempotent and never rejects.

**Usage example:**

```ts
docsModule.status();   // 'available'
listModules();         // [{ module: 'docs', status: 'available', features: { sharing: false } }]
```

## DOCS_STATUS_BY_ERROR_CODE / docsErrorBody

**Location:** `api/lib/modules/docs/errors.ts`

**Description:** Own map of the 30 jiku-docs error codes to HTTP; unknown codes are 500 keeping the
original `code`. `docsErrorBody(reply)` returns `{ code, message, details? }`, `details` only when the
reply carries `errorDetails`. Not merged with core's `STATUS_BY_ERROR_CODE` on purpose.

## bus().queryModule / commandModule / pingModule / openModuleKv

**Location:** `api/lib/utils/bus/index.ts`

**Description:** Module-facing methods of the bus client, over the same connection, inbox and service
user. `openModuleKv()` uses `bindOnly` plus `allow_direct: true`: `allow_direct` is mandatory because
with `bindOnly` nats.js does not query the stream and would use `STREAM.MSG.GET`, which the
auth-callout does not authorise. `pingModule` is `true` on any reply and `false` on no-responders or
timeout.

## buildDocumentsFilter / joiIntList / joiStrList

**Location:** `api/lib/modules/docs/query.ts`

**Description:** Translates the validated query of `GET /docs/documents` and `GET /docs/search` to the jiku-docs
`DocumentsFilter`. Only present keys; `person` becomes `or: [{ createdBy }, { updatedBy }]` ("created by or last editor").
`joiIntList(max?)` / `joiStrList(max?)` accept a value or a repeated parameter (`.single()`), always an array.

**Signature:**

```ts
buildDocumentsFilter(query: Record<string, any>): Record<string, unknown>;
```

**Usage example:**

```ts
filter: buildDocumentsFilter(SCHEMA.validate(req.query).value)
```

## withListRefs / withDocumentRefs

**Location:** `api/lib/modules/docs/relation-refs.ts`

**Description:** Names from the api database for the ids jiku-docs returns: `clientRefs`, `projectRefs`
(+ `requirementRefs`, `taskRefs` in the detail). One `IN` query per type per response, none if there are no ids.

**Signature:**

```ts
withListRefs<T extends { clients?: number[]; projects?: number[] }>(items: T[]): Promise<Array<T & { clientRefs; projectRefs }>>;
withDocumentRefs(document): Promise<typeof document & { clientRefs; projectRefs; requirementRefs; taskRefs }>;
```

**Usage example:**

```ts
return res.status(200).json({ ...data, items: await withListRefs(data.items ?? []) });
```

## activeProjectIdsOf

**Location:** `api/lib/modules/docs/active-projects.ts`

**Description:** Ids of the `activo` projects in which the person with `people.user_id = sub` participates (max 200).

**Signature:**

```ts
activeProjectIdsOf(sub: string): Promise<number[]>;
```

## isUlid / joiUlid / respondDocsNotFound

**Location:** `api/lib/modules/docs/ids.ts`

**Description:** Format of the jiku-docs ids (`ULID_PATTERN`, `^[0-9A-HJKMNP-TV-Z]{26}$`). A path id is
validated with `isUlid` before the bus because it enters the NATS subject of
`attachments.{id}.request-download`. A malformed id answers the same 404 as a missing one, without a bus call.

**Signature:**

```ts
isUlid(value: unknown): boolean;
joiUlid(): joi.StringSchema;
respondDocsNotFound(res: Response, code: 'document_not_found' | 'folder_not_found' | 'attachment_not_found' | 'share_not_found'): Response;
```

**Usage example:**

```ts
if (!isUlid(req.params.id)) return respondDocsNotFound(res, 'document_not_found');
```

## contentChecksum

**Location:** `api/lib/modules/docs/checksum.ts`

**Description:** The jiku-docs `Checksum` (`^sha256:[0-9a-f]{64}$`) of the text the api sends as
`content`: `"sha256:" + hex(sha256(utf8(content)))`, over the same string, without normalizing line endings
(DD-8). It is NOT the checksum of the `storage` convention, which hashes an uploaded binary.

**Signature:**

```ts
contentChecksum(content: string): string;
```

**Usage example:**

```ts
checksum: contentChecksum(req.body.content),
```

## redirectToModuleDownload

**Location:** `api/lib/modules/docs/download.ts`

**Description:** 302 to the jiku-docs `downloadUrl`, `X-Content-Type-Options: nosniff`, empty body. Sets no
`Content-Type`, `Content-Disposition` or `Content-Length`. Never logs the URL.

**Usage example:**

```ts
const data = await moduleCommand<ModuleDownloadTicket>(res, 'docs', `attachments.${id}.request-download`, {});
if (!data) return;
return redirectToModuleDownload(res, data);
```

## pickDefined / buildPage

**Location:** `api/lib/modules/docs/query.ts`

**Description:** `pickDefined(query, keys, rename?)` builds a `filter` with only the keys that came;
`buildPage({ limit, cursor? })` builds `page` with `cursor` only when present. `PAGE_LIMIT_MAX` is 200.

**Usage example:**

```ts
{ filter: pickDefined(query, ['projectId', 'topic']), page: buildPage(query) }
```

## sendToModule

**Location:** `api/lib/modules/client.ts`

**Description:** Publishes `body` to a module as is and classifies the result as `ModuleOutcome<T>`
(`{ kind: 'data', data }`, `{ kind: 'failure', reply }`, `{ kind: 'timeout' }`, `{ kind: 'unreachable' }`)
instead of answering HTTP. It does not add or remove `actor`, does not check the module state and never logs
`body`. A `no responders` marks the module `unavailable`.

**Usage example:**

```ts
const outcome = await sendToModule<SharedDocument>('query', 'docs', 'shares.resolve', { token });
if (outcome.kind === 'data') { /* outcome.data */ }
```

## Public host: publicDocsHost / isPublicHostRequest / assertPublicUrlConfig / maskPublicDocsUrl

**Location:** `api/lib/modules/docs/public-url.ts`

**Description:** `publicDocsHost()` is the host of `JIKU_PUBLIC_URL` (lowercase, `null` when blank);
`isPublicHostRequest(req)` compares it with the raw `Host` header (never `X-Forwarded-Host`);
`assertPublicUrlConfig()` throws at startup when the URL is set but unusable; `maskPublicDocsUrl(url)` replaces
the token and drops the query so the URL can be logged; `PUBLIC_DOCS_PATH` matches `/p/docs/<something>`.

**Usage example:**

```ts
if (!isPublicHostRequest(req)) return sendPublicNotice(res, 404);
```

## Public page: sendPublicNotice / sendSharedDocument / renderSharedDocument / escapeHtml

**Location:** `api/lib/modules/docs/public-page.ts`

**Description:** The HTML template of the public share page (escaped title + the already sanitized `html`,
as is) and the exception pages `PUBLIC_NOTICES` (404 / 429 / 503). Both senders set `PUBLIC_DOCS_HEADERS` (CSP,
`X-Robots-Tag: noindex`, `Referrer-Policy: no-referrer`, `Cache-Control: private, no-store`, nosniff). The pages
carry no request data and no product branding, so every 404 is identical.

**Usage example:**

```ts
return sendSharedDocument(res, title, html);
return sendPublicNotice(res, 404);
```

## fetchSharedHtml

**Location:** `api/lib/modules/docs/public-html.ts`

**Description:** Downloads the presigned `htmlUrl` (documents over 256 KiB) as text: at most 5 MiB, 10 s, no
redirects, only status 200. Throws on any failure. The URL is a credential and is never logged.

**Usage example:**

```ts
const html = await fetchSharedHtml(htmlUrl);
```

## queryShare / clientInfo

**Location:** `api/lib/modules/docs/public-share.ts`

**Description:** `queryShare(method, req, payload)` checks the module state and calls `shares.resolve` or
`shares.attachment` without `actor`, adding the optional `client` (`clientInfo(req)`: `ip` <= 100,
`userAgent` <= 2000). Returns `{ ok: true, data }` or `{ ok: false, status: 404 | 503 }`; any jiku-docs error
becomes the same 404 and only its code is logged. `SHARE_TOKEN_PATTERN` is `^jds_[A-Za-z0-9_-]{43}$`.

**Usage example:**

```ts
const result = await queryShare<SharedDocument>('shares.resolve', req, { token });
if (!result.ok) return sendPublicNotice(res, result.status);
```

## parseTrustProxy

**Location:** `api/lib/utils/trust-proxy.ts`

**Description:** Value for `app.set('trust proxy', ...)` from `API_TRUST_PROXY`: blank -> `undefined` (not set),
digits -> number of hops, `true` / `false` -> boolean, anything else -> the string as is.

**Usage example:**

```ts
const trustProxy = parseTrustProxy(process.env.API_TRUST_PROXY);
if (trustProxy !== undefined) app.set('trust proxy', trustProxy);
```
