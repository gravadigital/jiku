# Types — `api`

> Partial catalog seeded by S-005. Run `/service-update-reusable-code api` for a full scan.

## DownloadTicket

**Location:** `api/lib/utils/bus/download-ticket.ts`

**Description:** The `data` of a successful `files.{fileId}.request-download` reply. It lives in
`lib/utils/bus/` —the folder the convention reserves for bus contract translations— rather than in
each route file, because the five read paths consume exactly the same contract.

The three metadata fields travel in the reply **on purpose**: the `api` needs them to build its
response headers without querying the database again, so the `HEAD` the frontends use to resolve
name and size keeps working.

**Interface:**

```ts
interface DownloadTicket {
  downloadUrl: string;   // presigned GetObject URL, with the Content-Disposition signed in
  expiresIn: number;     // TTL in seconds (`download-url-ttl-seconds`, default 300)
  fileName: string;
  mimeType: string;
  fileSize: number;
}
```

**Usage example:**

```ts
const data = await sendCommand<DownloadTicket>(
  res, `files.${fileId}.request-download`, { disposition: 'attachment' }
);
if (!data) return;
```

## UploadTicketReply

**Location:** `api/lib/utils/bus/upload-ticket.ts`

**Description:** The `data` of a successful `files.request-upload` reply (core, S-002).

`id` is the id of `files` — the **file**, not the link. The link does not exist yet at this point:
since REQ-001 (D-12) requesting upload permission no longer mentions any entity, and the
`Attachment` row is created later, when the entity is saved with `fileIds` (S-003).

**Interface:**

```ts
interface UploadTicketReply {
  id: number;          // id of `files`
  uploadUrl: string;   // presigned PutObject URL, single object, short TTL (D-10)
  expiresIn: number;   // TTL in seconds (`upload-url-ttl-seconds`, default 300)
}
```

## UploadTicket

**Location:** `api/lib/utils/bus/upload-ticket.ts`

**Description:** The upload-permission contract as the frontends see it
(`docs/apis/api.yaml`, schema `UploadTicket`). Produced from `UploadTicketReply` by
`toUploadTicket`.

`uploadUrl` is a presigned **PUT** for a single object with a short TTL: the browser uses it
straight against the storage, so neither the `api` nor the bus ever sees the byte.

**Interface:**

```ts
interface UploadTicket {
  fileId: number;      // id of `files`; this is what travels in `fileIds` when saving the entity
  uploadUrl: string;
  expiresIn: number;
}
```

**Usage example:**

```ts
const data = await sendCommand<UploadTicketReply>(res, 'files.request-upload', payload);
if (!data) return;

return res.status(201).json(toUploadTicket(data));
```
