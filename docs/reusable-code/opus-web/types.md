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

---

## IdentityType

**Location:** `opus-web/src/shared/types/identity.types.ts`

**Description:** Whether an identity is a person or an automated service. The two values are in
English because the product does not choose them: they are the `type` of
`deploy/nats/auth-callout/rules.yaml`. The word the user reads (`"Automático"`) is chosen by the
front, in `AutomatedIdentityBadge`.

**Interface:**

```ts
type IdentityType = 'person' | 'service';
```

**Usage:**

```ts
import type { IdentityType } from '@/shared/types';
```

---

## AuthorUser

**Location:** `opus-web/src/shared/types/identity.types.ts`

**Description:** A user when it appears as the **author** of something: the creator of a requirement,
or the author of an activity entry. Mirrors the `AuthorUser` schema of `docs/apis/api.yaml`.

`identityType` is optional on purpose: an older api does not send it, and the front's condition is
`=== 'service'`, so its absence marks nothing. It fails on the safe side — a mark is lost, a person
is never marked.

It is **not** the type of the subscribers' `user`: that one is a selector of people, the api keeps it
at three fields on purpose, and declaring `identityType` there would lie (S-019, CA-1/CA-2).

`roles` does not appear in any HTTP response of the api, on any endpoint.

**Interface:**

```ts
interface AuthorUser {
  id: string;
  name: string;
  email: string;
  identityType?: IdentityType;
}
```

**Usage:**

```ts
import type { AuthorUser } from '@/shared/types';

// The three authorship payloads of `requirement.types.ts` use it:
interface Requirement {
  creator: AuthorUser | null;
}
```

