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

## useTheme / useThemeOptional

**Location:** `web/src/features/theme/context/ThemeProvider.tsx`

**Description:** Reads and writes the current theme (S-059). `useTheme()` throws
(`"useTheme debe usarse dentro de ThemeProvider"`) when used outside `ThemeProvider`;
`useThemeOptional()` returns `null` instead, for consumers that can render without a theme
opinion. `setTheme` is the **only** way the theme changes: it stamps
`document.documentElement.dataset.theme`, persists to `localStorage` + a reflected cookie via
`persistTheme`, and does not touch `fetch`, Server Actions, or TanStack Query — the theme is UI
state, never domain state. Follows the same context pattern as `useActiveProject`/`useSidebar`
(`src/contexts/`): `createContext<T | null>(null)`, actions in `useCallback`, value in `useMemo`.

**Signature:**

```ts
type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

function useTheme(): ThemeContextValue; // throws outside ThemeProvider
function useThemeOptional(): ThemeContextValue | null; // never throws
```

**Usage:**

```tsx
import { useTheme } from '@/features/theme';

const { theme, setTheme } = useTheme();
setTheme(theme === 'dark' ? 'light' : 'dark');
```

## useModules / useModule

**Location:** `web/src/features/docs/hooks/useModules.ts`

**Description:** Polls `GET /modules` every 60 s. `useModule(name)` returns `{ status, sharing, isKnown }`; while loading or on error it reports `not_installed` with `isKnown: false`.

**Signature:**

```ts
function useModules(options?: { enabled?: boolean }): UseQueryResult<ModuleState[]>;
function useModule(name: string): { status: ModuleStatus; sharing: boolean; isKnown: boolean };
```

**Usage:** `const { status } = useModule('docs');`

## useDocuments

**Location:** `web/src/features/docs/hooks/useDocuments.ts`

**Description:** Cursor-paginated list (10 per page) filtered by project, requirement or task; `module_unavailable` invalidates `['modules']`.

**Signature:** `useDocuments({ filters, enabled? })` → `useInfiniteQuery` result

**Usage:** `useDocuments({ filters: { projectId: 12 }, enabled: status === 'available' })`

## useDocument

**Location:** `web/src/features/docs/hooks/useDocument.ts`

**Description:** Document detail by ULID; no retry on 404 or `module_unavailable`.

**Signature:** `useDocument({ id, version?, enabled?, refetchInterval? })` → `useQuery` result of `DocsDocumentDetail`

**Usage:** `const { data } = useDocument({ id });`

## useDocumentVersions

**Location:** `web/src/features/docs/hooks/useDocumentVersions.ts`

**Description:** Infinite query of the document history (`['docs','versions',id]`), cursor-paginated.

**Signature:** `useDocumentVersions({ id, enabled? })`

**Usage:** `const { data, hasNextPage, fetchNextPage } = useDocumentVersions({ id, enabled: open });`

## useRestoreVersion

**Location:** `web/src/features/docs/hooks/useRestoreVersion.ts`

**Description:** Restore mutation (`retry: 0`); invalidates the document, versions and lists in `onSettled`. No toasts or navigation.

**Signature:** `useRestoreVersion(id)` → mutation of `{ fromVersion, baseVersion }`

**Usage:** `restore.mutate({ fromVersion: 5, baseVersion: doc.version })`

## useCreateDocument

**Location:** `web/src/features/docs/hooks/useCreateDocument.ts`

**Description:** Create mutation; invalidates the folder contents and `['docs-documents']`.

**Signature:** `useCreateDocument()`

**Usage:** `useCreateDocument()`

## useSaveDocument

**Location:** `web/src/features/docs/hooks/useSaveDocument.ts`

**Description:** Save mutation (`retry: 0`); invalidates the document, listings and `['docs-folder-contents']` by prefix.

**Signature:** `useSaveDocument(id)`

**Usage:** `useSaveDocument(id)`

## useUploadDocAttachment

**Location:** `web/src/features/docs/hooks/useUploadDocAttachment.ts`

**Description:** Attachment upload mutation; invalidates the document.

**Signature:** `useUploadDocAttachment(documentId)`

**Usage:** `useUploadDocAttachment(documentId)`

## useEditSession

**Location:** `web/src/features/docs/hooks/useEditSession.ts`

**Description:** Lifecycle of the edit lock: acquire with a new `sessionId`, renew every 60 s, `lost`/blocked detection, `release()` and keepalive release on `pagehide`/unmount.

**Signature:** `useEditSession({ documentId }) → { phase, sessionId, blockedBy, start, release, markBlocked, clearBlocked }`

**Usage:** `useEditSession({ documentId }) → { phase, sessionId, blockedBy, start, release, markBlocked, clearBlocked }`

## useDocumentShares

**Location:** `web/src/features/docs/hooks/useDocumentShares.ts`

**Description:** Shared links of a document, one page of 200; key `['docs-shares', documentId]`; never contains URL or token.

**Signature:** `useDocumentShares({ documentId, enabled? })`

**Usage:** `useDocumentShares({ documentId: doc.id, enabled: open })`

## useCreateShare

**Location:** `web/src/features/docs/hooks/useCreateShare.ts`

**Description:** Create-link mutation: no retry, `gcTime: 0` (the URL is not retained by the mutation cache), invalidates the list on settle (a 504 may have created the link), invalidates `['modules']` on `sharing_not_configured`.

**Signature:** `useCreateShare(documentId)` → mutation of `CreateShareInput`

**Usage:** `create.mutate({ expiresInDays: 15, includeAttachments: true }, { onSuccess, onError })`

## useRevokeShare

**Location:** `web/src/features/docs/hooks/useRevokeShare.ts`

**Description:** Revoke mutation: after the 200 the row is marked `revoked` with the response `revokedAt` (no optimistic update) and the list is invalidated; `share_not_found` also invalidates.

**Signature:** `useRevokeShare(documentId)` → mutation of `shareId`

**Usage:** `revoke.mutate(share.id, { onSuccess, onError })`

## useDocsList

**Location:** `web/src/features/docs/hooks/useDocsList.ts`

**Description:** Cursor-chained `useInfiniteQuery` of documents (20 per page, `count=true`), rebuilds page N from the URL; exposes `lastAvailablePage`.

**Signature:** ``useDocsList({ filters, pagina, enabled? })``

**Usage:** `useDocsList({ filters, pagina, enabled? })`

## useDocsTextSearch

**Location:** `web/src/features/docs/hooks/useDocsTextSearch.ts`

**Description:** Text search (limit 50) with the same filters.

**Signature:** ``useDocsTextSearch({ query, enabled? })``

**Usage:** `useDocsTextSearch({ query, enabled? })`

## useDocsHome

**Location:** `web/src/features/docs/hooks/useDocsHome.ts`

**Description:** "En mis proyectos activos" and "Editados recientemente" groups of the home state.

**Signature:** ``useDocsHome({ sort, enabled? })``

**Usage:** `useDocsHome({ sort, enabled? })`

## useDocsSuggestions

**Location:** `web/src/features/docs/hooks/useDocsSuggestions.ts`

**Description:** Grouped suggestions for the search bar (`['docs','suggestions',q,clientId]`).

**Signature:** ``useDocsSuggestions({ q, clientId?, enabled? })``

**Usage:** `useDocsSuggestions({ q, clientId?, enabled? })`

## useSuggestedRelations

**Location:** `web/src/features/docs/hooks/useSuggestedRelations.ts`

**Description:** Project candidates for a document (5 min staleTime).

**Signature:** ``useSuggestedRelations({ id, enabled? })``

**Usage:** `useSuggestedRelations({ id, enabled? })`

## useAssignProject

**Location:** `web/src/features/docs/hooks/useAssignProject.ts`

**Description:** Mutation that adds a project relation and invalidates the document lists.

**Signature:** ``useAssignProject()``

**Usage:** `useAssignProject()`
