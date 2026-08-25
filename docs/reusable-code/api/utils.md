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
api publishes — `runCommand` included. `bus().query()` deliberately does **not** use it: the query
plane resolves identity from the subject and only from there.
