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
