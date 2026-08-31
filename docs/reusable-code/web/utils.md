# Utils — `web`

> Partial catalog seeded by S-006. Run `/service-update-reusable-code web` for a full scan.

## extractFileIds

**Location:** `web/src/features/attachments/utils/extractFileIds.ts`

**Description:** Pulls the ids out of the `[file:N]` / `![file:N]` placeholders embedded in
markdown. Those N are `files.id` values, which is exactly what `fileIds` carries when saving the
entity.

The prefix is the whole point of this module. Embedded markdown handles **two identifier spaces**
that must never be mixed: `attach:N` is a link id (already-saved content) and `file:N` is a file id
(just uploaded, not linked yet). Confusing them does not break compilation — `web`'s types are
hand-written — and shows up as an empty preview, or as the preview of someone else's attachment.

**Signature:**

```ts
function extractFileIds(value: string): number[];
```

**Usage:**

```ts
const payload = { title, description, fileIds: extractFileIds(description) };
```

---

## extractAttachmentIds

**Location:** `web/src/features/attachments/utils/extractFileIds.ts`

**Description:** The counterpart: pulls the ids out of `[attach:N]` / `![attach:N]`, which are ids
of **links**. It is what an editor needs to translate already-linked attachments back to their
`fileId` when building the complete set for an update.

**Signature:**

```ts
function extractAttachmentIds(value: string): number[];
```

---

## fileErrorMessage

**Location:** `web/src/features/attachments/utils/fileErrorMessages.ts`

**Description:** Maps the file domain error codes to the message the interface shows, falling back
to the api's own message and then to a caller-supplied text. It exists so the four codes are said
the same way everywhere.

The important one is `file_not_owned`: it is phrased as a **permissions** problem, not as an
invalid file — the file is fine, what is missing is the right to link it. And it has no exception
by role: an admin gets the same message (RF-13).

**Signature:**

```ts
function fileErrorMessage(error: unknown, fallback: string): string;
```

**Usage:**

```ts
onError: (error) => toast.error(fileErrorMessage(error, 'Hubo un error al crear el requisito'));
```

---

## getPageWindow

**Location:** `web/src/shared/components/ui/Pagination/getPageWindow.ts`

**Description:** Computes the range of page numbers a paginator should render: a window of at
most 10 numbers (the `PAGE_WINDOW_SIZE` constant), centered on `currentPage` and clamped to
`[1, totalPages]` when the ideal window would fall outside that range. When `totalPages` is 10 or
fewer it returns `[1..totalPages]` with no padding. Returns `[]` for `totalPages <= 0` instead of
throwing. Pure function, no React dependency — safe to unit test without `jsdom`. Used by
`Pagination` (`web/src/shared/components/ui/Pagination/Pagination.tsx`).

**Signature:**

```ts
function getPageWindow(params: { currentPage: number; totalPages: number }): number[];
```

**Usage:**

```ts
const pageNumbers = getPageWindow({ currentPage, totalPages });
// currentPage=15, totalPages=30 -> [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]
```
