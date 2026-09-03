# Types — `web`

> Partial catalog seeded by S-006. Run `/service-update-reusable-code web` for a full scan.

## UploadTicket

**Location:** `web/src/features/attachments/types/attachment.types.ts`

**Description:** Permission to upload a single object. `uploadUrl` is the declared exception to
ADR-009: it reaches the browser because the browser performs the `PUT`, and it arrives in the api's
response body — never through a `NEXT_PUBLIC_*` variable, so the bucket topology stays out of the
bundle.

**Interface:**

```ts
interface UploadTicket {
  readonly fileId: number;
  readonly uploadUrl: string;
  readonly expiresIn: number;
}
```

---

## UploadTicketRequest

**Location:** `web/src/features/attachments/types/attachment.types.ts`

**Description:** What the client declares to ask for a ticket. It does **not** mention the entity:
uploading and linking are two separate operations since REQ-001. `checksum` is optional and is
always sent as `null` for now — nobody verifies it (D-25), and computing it would mean reading the
whole file in the browser before uploading it.

**Interface:**

```ts
interface UploadTicketRequest {
  readonly fileName: string;
  readonly mimeType: string;
  readonly fileSize: number;
  readonly checksum?: string | null;
}
```

---

## AttachmentResource

**Location:** `web/src/features/attachments/types/attachment.types.ts`

**Description:** Discriminates the two identifier spaces a file-ish component may receive.
`'attachment'` is a saved link (`attachments.id`); `'file'` is a file that exists with no link
(`files.id`). Every component that renders a preview takes it, because the id alone does not say
which route can resolve it.

**Interface:**

```ts
type AttachmentResource = 'attachment' | 'file';
```

---

## UploadQueueError

**Location:** `web/src/features/attachments/hooks/useUploadAttachment.ts`

**Description:** One failed file inside an upload queue. It is per file, not per batch, because the
failure of one upload does not cancel the others.

**Interface:**

```ts
interface UploadQueueError {
  readonly fileName: string;
  readonly message: string;
  readonly retryable: boolean;
}
```

---

## IdentityType

**Location:** `web/src/features/auth/types/auth.types.ts`

**Description:** The two kinds of identity a `users` row can have. The values are in English
because the product does not choose them: they are the `type` of
`deploy/nats/auth-callout/rules.yaml`. The word the user reads is chosen by the front, not by this
type.

**Interface:**

```ts
type IdentityType = 'person' | 'service';
```

---

## AuthorUser

**Location:** `web/src/features/auth/types/auth.types.ts`

**Description:** A user as it appears when it is the **author** of something — creator of a project,
requirement or task; author of an activity entry or a comment. It mirrors the api's `AuthorUser`
schema, so it does **not** carry `username` (the api never returns it in an authorship payload) and
it never carries `roles` (that field is not exposed in any HTTP response).

`identityType` is optional on purpose: it is the deployment compatibility contract — an old api does
not send it, and every read is `=== 'service'`, so its absence marks nothing. It fails on the safe
side: a mark is lost, a person is never marked.

Do **not** use it for a person selector payload (`GET /api/opus/projects/{projid}/users`): that one
is already filtered to `person`, so the field would be constant. Use `User` there.

**Interface:**

```ts
interface AuthorUser {
  id?: string;
  name: string;
  email: string;
  identityType?: IdentityType;
}
```

## Theme / THEME_STORAGE_KEY

**Location:** `web/src/features/theme/types/theme.types.ts`

**Description:** `Theme` is the whole type surface of the theme module (S-059): exactly two
values, no `'system'`/`'auto'` — the story fixes light as the default and does not read
`prefers-color-scheme`. `THEME_STORAGE_KEY` is the single constant naming both the `localStorage`
key and the cookie (`'jiku.theme'`), declared once so client and server never desync on a
duplicated string literal.

**Interface:**

```ts
type Theme = 'light' | 'dark';
const THEME_STORAGE_KEY = 'jiku.theme';
```
