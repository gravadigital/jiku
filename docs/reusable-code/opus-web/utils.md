# Utils — `opus-web`

## createDocsUrlTransform

**Location:** `opus-web/src/features/docs/utils/docsUrlTransform.ts`

**Description:** Factory of the `urlTransform` for markdown viewers. `/docs/attachments/{ULID}` (relative or
absolute, any host) becomes `/api/docs/documents/{documentId}/attachments/{ULID}`, always under the open
document; an invalid `documentId` blanks attachment links (fails closed). `http:`, `https:` and `mailto:`
pass; everything else becomes `''`.

**Signature:**

```ts
function createDocsUrlTransform(documentId: string): (url: string) => string;
```

**Usage:**

```tsx
<Markdown skipHtml urlTransform={createDocsUrlTransform(documentId)}>{text}</Markdown>
```

---

## stripFrontmatter

**Location:** `opus-web/src/features/docs/utils/frontmatter.ts`

**Description:** Removes a YAML block that starts on the first line (`---` ... `---`/`...`); otherwise
returns the content untouched.

**Signature:**

```ts
function stripFrontmatter(content: string): string;
```

**Usage:**

```ts
stripFrontmatter('---\na: 1\n---\n# T'); // '# T'
```

---

## formatDocDate

**Location:** `opus-web/src/features/docs/utils/dates.ts`

**Description:** ISO date to `DD/MM/AAAA`; invalid input gives `—`.

**Signature:**

```ts
function formatDocDate(iso: string): string;
```

**Usage:**

```ts
formatDocDate('2026-10-20T14:30:00.000Z'); // '20/10/2026'
```

---

## withModuleInvalidation

**Location:** `opus-web/src/features/docs/utils/moduleInvalidation.ts`

**Description:** Wraps a query function; on `code === 'module_unavailable'` it invalidates `['modules']`
and rethrows.

**Signature:**

```ts
function withModuleInvalidation<T>(queryClient: QueryClient, fn: () => Promise<T>): Promise<T>;
```

**Usage:**

```ts
queryFn: () => withModuleInvalidation(queryClient, () => docsApi.getById(id))
```

---

## classifyDocumentError

**Location:** `opus-web/src/features/docs/utils/classifyDocumentError.ts`

**Description:** 404/403 → `not_found`, 503 → `unavailable`, anything else → `system`.

**Signature:**

```ts
function classifyDocumentError(error: Pick<ApiError, 'status'> | null | undefined): 'not_found' | 'unavailable' | 'system';
```

**Usage:**

```ts
const kind = classifyDocumentError(document.error as ApiError);
```
