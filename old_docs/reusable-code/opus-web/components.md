# Components — `opus-web`

> Partial catalog. Seeded by S-019 with the reusable UI created and extended by that story; it is
> **not** a full scan of `src/shared/components/ui/`. Run `/service-update-reusable-code opus-web`
> for a full scan.

## AutomatedIdentityBadge

**Location:** `opus-web/src/shared/components/ui/AutomatedIdentityBadge/AutomatedIdentityBadge.tsx`

**Description:** The automated-identity mark (`marca-identidad-automatica`, REQ-005 / S-019). It
accompanies an author's name when that author is **not** a person: it says what *class* of author it
is, without replacing the `name`.

It owns its own visibility condition, which is the point of the component: the mark appears in four
insertion points across two screens plus an overlay, and concentrating the `=== 'service'` check here
is what keeps those four points from diverging. It renders **nothing at all** — no node, no reserved
space — for a person, for an absent value, or for any unexpected value.

Both strings are approved by the REQ-005 UX review and are not changed without going back through UX
review.

It composes `Badge` with the neutral variant and writes **no CSS of its own**. The mark is not
success, error, warning or an action — it is a classification of the author, so it goes neutral. A
brand-coloured mark would read as something clickable.

It is not interactive: no `tabIndex`, no handlers, no `title`. It carries `role="img"` so that its
`aria-label` is a real accessible name — on a `span` without a role (`generic`) screen readers ignore
the `aria-label` and read the text, which would announce a bare `"Automático"`.

**Interface:**

```ts
interface AutomatedIdentityBadgeProps {
  readonly identityType?: IdentityType;
  /** Class of the insertion point, for that row's layout adjustment (e.g. `flex-shrink: 0`). */
  readonly className?: string;
}
```

**Usage:**

```tsx
import { AutomatedIdentityBadge } from '@/shared/components/ui';

// It takes the identity type, not the user object, and it decides on its own whether to render.
<span className={styles.creator}>{requirement.creator?.name ?? '—'}</span>
<AutomatedIdentityBadge
  identityType={requirement.creator?.identityType}
  className={styles.identityBadge}
/>
```

`className` is forwarded to `Badge` so each insertion point keeps its one-line layout adjustment
(`flex-shrink: 0`, `margin-left`) in **its own** stylesheet, where the layout is decided — not in the
badge, which does not know where it will be placed.

**Visible text:** `"Automático"` · **Accessible name:** `"Identidad automática: no es una persona"`

---

## Badge

**Location:** `opus-web/src/shared/components/ui/Badge/Badge.tsx`

**Description:** A pill-shaped label, built **entirely from tokens** (no hex, no loose px): `radius-full`,
`font-size-xs`, `font-weight-medium`, `line-height: 1`. The `default` variant is the neutral one
(`--color-text-secondary` on `--color-surface` with a `--color-border` border, ~4.9:1 contrast — the
combination the product already uses for metadata); the other four are solid semantic colours with
white text.

Variants are expressed with a `data-variant` attribute rather than composed class names, which is the
distinctive pattern of this service's `shared/ui/`.

Since S-019 it also forwards `role` and `aria-label`, so a caller that needs a real accessible name
can declare one. Both are optional and React omits `undefined` attributes, so a `Badge` without them
renders exactly the DOM it always did.

**Interface:**

```ts
interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  children: React.ReactNode;
  className?: string;
  /** Explicit ARIA role. Without a role a `span` is `generic` and screen readers ignore its
   *  `aria-label`: whoever needs an accessible name has to declare the role. */
  role?: string;
  'aria-label'?: string;
}
```

**Usage:**

```tsx
import { Badge } from '@/shared/components/ui';

<Badge variant="default">Sin tipo</Badge>

// With an accessible name, which is what `AutomatedIdentityBadge` does:
<Badge variant="default" role="img" aria-label="Identidad automática: no es una persona">
  Automático
</Badge>
```

---

## DocsSection

**Location:** `opus-web/src/features/docs/components/DocsSection/DocsSection.tsx`

**Description:** Collapsible "Documentación (n)" section. With `requirementId` it lists the public
documents linked to the requirement, otherwise those of the project. Renders nothing while the module
state is unknown, when it is `not_installed` or when there are no documents; with the module down (or
a query error) it shows `DocsAlert`: a 403 or `caller_not_authorized` shows `MSG_DOCS_FORBIDDEN`, any
other error `MSG_DOCS_UNAVAILABLE`, and `module_not_installed` renders nothing. Paginates 5 at a time ("n+" while more exist).

**Interface:**

```ts
interface DocsSectionProps { projectId: number; requirementId?: number }
```

**Usage:**

```tsx
<DocsSection projectId={projectId} requirementId={requirement.id} />
```

---

## DocsAlert

**Location:** `opus-web/src/features/docs/components/DocsAlert/DocsAlert.tsx`

**Description:** Inline notice for the docs module. `error` uses `role="alert"`, `warning` uses
`role="status"`; the state is carried by icon and text, not color alone.

**Interface:**

```ts
interface DocsAlertProps { variant: 'warning' | 'error'; children: ReactNode }
```

**Usage:**

```tsx
<DocsAlert variant="warning">{MSG_DOCS_UNAVAILABLE}</DocsAlert>
<DocsAlert variant="warning">{MSG_DOCS_FORBIDDEN}</DocsAlert>
```

---

## DocumentMarkdown

**Location:** `opus-web/src/features/docs/components/DocumentMarkdown/DocumentMarkdown.tsx`

**Description:** Read-only markdown viewer. `skipHtml`, no rehype plugins, `createDocsUrlTransform(documentId)` on every
URL, frontmatter stripped, headings shifted one level (`#` renders as `h2`), links in a new tab (a link without destination, such as a
link to another document, renders as plain text with no `<a>`), images
at column width. Independent of the shared `MarkdownRenderer` on purpose.

**Interface:**

```ts
interface DocumentMarkdownProps { content: string; documentId: string }
```

**Usage:**

```tsx
<DocumentMarkdown documentId={doc.id} content={doc.content ?? ''} />
```

---

## DocumentAttachments

**Location:** `opus-web/src/features/docs/components/DocumentAttachments/DocumentAttachments.tsx`

**Description:** Attachment list of a document. One link per attachment to
`/api/docs/documents/{documentId}/attachments/{id}` (the attachment's own `documentId`, or the open
document's if missing), in a new tab. Never uses `link`. Renders nothing without attachments.

**Interface:**

```ts
interface DocumentAttachmentsProps { attachments?: DocsAttachment[]; documentId: string }
```

**Usage:**

```tsx
<DocumentAttachments documentId={doc.id} attachments={doc.attachments} />
```

---

## RequirementUnavailable

**Location:** `opus-web/src/features/requirements/components/RequirementUnavailable/RequirementUnavailable.tsx`

**Description:** State "requirement not available or no access", shared by the detail page and the O-01 modal.
A `<section>` with a decorative (`aria-hidden`) `FileQuestion` icon, an `<h1>` "El requisito no está disponible o no
tenés acceso", an explanation and a primary "Volver al tablero" button. No `role="alert"`, no "Reintentar",
and it does not tell "does not exist" from "no permission". Desktop: centered column, max 480px; mobile:
full-width, full-width button. It is the accepted design-system gap `empty-state` (`aviso-no-disponible`,
REQ-020). It is not exported from the `features/requirements` barrel.

**Interface:**

```ts
interface RequirementUnavailableProps { onBack: () => void }
```

**Usage:**

```tsx
// Page: minimal header + state
<BoardHeader projectName={projectName} projectId={projectId} minimal />
<RequirementUnavailable onBack={() => router.push(`/projects/${projectId}/requirements`)} />
// Modal O-01: "Volver al tablero" closes the modal
<RequirementUnavailable onBack={onClose} />
```
