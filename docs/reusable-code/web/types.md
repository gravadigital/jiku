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
