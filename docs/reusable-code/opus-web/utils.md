# Utils — `opus-web`

## createDocsUrlTransform

**Location:** `opus-web/src/features/docs/utils/docsUrlTransform.ts`

**Description:** Factory of the `urlTransform` for markdown viewers. `/docs/attachments/{ULID}` (relative or
absolute, any host) becomes `/api/docs/documents/{documentId}/attachments/{ULID}`, always under the open
document; an invalid `documentId` blanks attachment links (fails closed). `/docs/{ULID}` (relative or any
host, with optional `?`/`#`) becomes `''`, evaluated after attachments: it points to the internal web app.
`http:`, `https:` and `mailto:` pass; everything else becomes `''`.

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

---

## classifyRequirementError

**Location:** `opus-web/src/features/requirements/utils/classifyRequirementError.ts`

**Description:** Classifies the error of loading a requirement (REQ-020 DD-7). `status` 403 or 404, or `code`
`requirement_not_found` / `access_denied` → `not_found`; anything else → `system`: 5xx, a network failure (the
interceptor turns it into `status: 500` / `unknown_error`) and `null` / `undefined`. Unlike
`classifyDocumentError` there is no `unavailable` kind and it also looks at `code`. It does not tell "does
not exist" from "no permission" on purpose: the api equates them.

**Signature:**

```ts
type RequirementErrorKind = 'not_found' | 'system';
function classifyRequirementError(error: Partial<Pick<ApiError, 'status' | 'code'>> | null | undefined): RequirementErrorKind;
```

**Usage:**

```ts
if (error && classifyRequirementError(error as unknown as ApiError) === 'system') { /* error + "Reintentar" */ }
// useRequirement (REQ-020 DD-9): 403/404 are not retried
retry: (failureCount, error) =>
  classifyRequirementError(error as unknown as ApiError) === 'system' && failureCount < 1,
```
