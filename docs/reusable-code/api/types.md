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
