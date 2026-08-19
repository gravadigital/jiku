# Types — `opus-web`

> Partial catalog seeded by S-007. Run `/service-update-reusable-code opus-web` for a full scan.

## UploadTicket

**Location:** `opus-web/src/features/attachments/types/attachment.types.ts`

**Description:** Upload permission for a single object, as returned by
`POST /api/opus/attachments`. `fileId` is the id of `files` — the one that travels in `fileIds` when
saving an entity — and is a **different identifier space** from `attachments.id`, which identifies
the link.

**Interface:**

```ts
interface UploadTicket {
  fileId: number;
  uploadUrl: string;
  expiresIn: number;
}
```

---

## UploadTicketInput

**Location:** `opus-web/src/features/attachments/types/attachment.types.ts`

**Description:** What the client declares to ask for a ticket. It carries no entity: uploading no
longer mentions what the file will be attached to.

**Interface:**

```ts
interface UploadTicketInput {
  fileName: string;
  mimeType: string;
  fileSize: number;
  checksum?: string | null;
}
```

---

## UploadedFile

**Location:** `opus-web/src/features/attachments/types/attachment.types.ts`

**Description:** Result of a finished upload. The three metadata fields are read from the browser
`File` rather than from a response, because the api never sees the byte.

**Interface:**

```ts
interface UploadedFile {
  fileId: number;
  fileName: string;
  mimeType: string;
  fileSize: number;
}
```
