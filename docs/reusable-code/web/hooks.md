# Hooks — `web`

> Partial catalog seeded by S-006. Run `/service-update-reusable-code web` for a full scan.

## useUploadAttachment

**Location:** `web/src/features/attachments/hooks/useUploadAttachment.ts`

**Description:** Uploads files **one at a time** (RF-7). Each file asks for its own ticket and does
its own `PUT`, so one failure does not cancel the rest — the queue keeps going and the failed ones
are collected for retry.

The state describes the queue — file in flight, its percentage, accumulated errors — rather than a
bare `progress` number. That is what lets a component name the file that is currently uploading
without guessing.

On completion it invalidates `['attachments', entityType, entityId]`, following ADR-011:
invalidation happens in the hook, not in the component.

**Signature:**

```ts
function useUploadAttachment(options: {
  entityType: EntityType;
  entityId: number | null;
  onFileUploaded?: (fileId: number, file: File) => void;
  onSettled?: () => void;
  onError?: (error: UploadQueueError) => void;
}): {
  currentFileName: string | null;
  progress: number;
  isUploading: boolean;
  errors: readonly UploadQueueError[];
  retryableFiles: readonly File[];
  uploadFiles: (files: readonly File[]) => Promise<void>;
  retryFailed: () => void;
  clearErrors: () => void;
};
```

**Usage:**

```tsx
const { uploadFiles, retryFailed, currentFileName, progress, isUploading, errors } =
  useUploadAttachment({ entityType: 'project', entityId });

// ...
{isUploading && <p>Subiendo {currentFileName}... {progress}%</p>}
```

---

## useAttachmentMeta

**Location:** `web/src/features/attachments/hooks/useAttachmentMeta.ts`

**Description:** Resolves name, size and mime type by issuing a `HEAD` to the preview endpoint. The
second argument picks which identifier space the id belongs to, and therefore which route answers.

It exposes the error's `status` and `code`, which is what lets a caller tell **403 permissions**
apart from **404 file not available** — two states that must be said differently to the user. A
`HEAD` carries no body, so a 404 without an `X-Error-Code` header is read as "not available": it is
the likely case and the only one with a useful action attached (delete the attachment).

`retry: false` and `staleTime: Infinity` are deliberate: retrying a file that is not there does not
make it appear, and every read costs a command over the bus.

**Signature:**

```ts
function useAttachmentMeta(
  id: number,
  resource?: AttachmentResource // 'attachment' (default) | 'file'
): UseQueryResult<AttachmentMeta, AttachmentMetaError>;
```

**Usage:**

```ts
// A saved link
const { data, error } = useAttachmentMeta(attachmentId);
const isUnavailable = error?.status === 404;

// A file with no link yet
const { data } = useAttachmentMeta(fileId, 'file');
```

---

## useUpdateRequirementComment

**Location:** `web/src/features/requirements/hooks/useUpdateRequirementComment.ts`

**Description:** Wraps `updateRequirementComment` in `useMutation` (S-048). On success it
invalidates **two** query keys: `['requirement', reqid]` (so the feed shows the edited text and the
new `editedAt`/`editedBy`) and `['attachments', 'requirement_comment', cid]` (so the comment's
attachment list reflects what was just saved). It does not toast or navigate — that stays with the
component, which has the screen context. Mirrors the pattern of `useAddRequirementActivity`.

**Signature:**

```ts
function useUpdateRequirementComment(reqid: number): UseMutationResult<
  void,
  unknown,
  { cid: number; comment: string; fileIds?: number[] }
>;
```

**Usage:**

```ts
const { mutate, isPending } = useUpdateRequirementComment(reqid);

mutate(
  { cid: entry.id, comment: comment.trim(), fileIds: [3, 9] },
  { onSuccess: () => toast.success('Comentario editado'), onError: (error) => toast.error(...) }
);
```
