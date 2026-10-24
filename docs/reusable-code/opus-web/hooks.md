# Hooks — `opus-web`

## useModules / useModule

**Location:** `opus-web/src/features/docs/hooks/useModules.ts`

**Description:** `useModules` is the query of `GET /api/opus/modules` (key `['modules']`, refetch every
60 s). `useModule(name)` projects it to `{ status, isKnown }`; while loading or on error it returns
`{ status: 'not_installed', isKnown: false }` so optional UI never flickers.

**Signature:**

```ts
useModules({ enabled }?: { enabled?: boolean }): UseQueryResult<ModuleEntry[]>;
useModule(name: string): { status: ModuleStatus; isKnown: boolean };
```

**Usage:**

```ts
const { status, isKnown } = useModule('docs');
```

---

## useDocuments

**Location:** `opus-web/src/features/docs/hooks/useDocuments.ts`

**Description:** Infinite query of public documents by `projectId` or `requirementId`
(key `['docs-documents', { projectId | requirementId }]`). Disabled without a positive id.

**Signature:**

```ts
useDocuments(params: { projectId?: number; requirementId?: number; enabled?: boolean })
```

**Usage:**

```ts
const query = useDocuments({ projectId, enabled: status === 'available' });
```

---

## useDocument

**Location:** `opus-web/src/features/docs/hooks/useDocument.ts`

**Description:** One document by ULID (key `['docs-document', documentId]`).

**Signature:**

```ts
useDocument(params: { documentId: string; enabled?: boolean }): UseQueryResult<DocsDocument>
```

**Usage:**

```ts
const doc = useDocument({ documentId, enabled: isAvailable });
```
