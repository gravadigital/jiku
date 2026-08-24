# Components — `web`

> Partial catalog seeded by S-019. Run `/service-update-reusable-code web` for a full scan.

## AutomatedIdentityBadge

**Location:** `web/src/shared/components/ui/AutomatedIdentityBadge/AutomatedIdentityBadge.tsx`

**Description:** The mark that tells the reader an author is **not a person** but a service
identity — a badge reading `"Automático"`, with the accessible name
`"Identidad automática: no es una persona"`. Both texts are approved by the UX review of REQ-005 and
are not changed without going through UX review again.

It is the **only** implementation of the mark in the surface, reused at all six authorship points
(`RequirementDetail`, `RequirementActivityFeed`, `ProjectGeneralInfo`, `ObjectiveDetails`,
`ObjectiveHistoryList`, `ObjectiveComment`). Concentrating the condition here is what keeps those six
points from diverging: there is a single place where the operator or the wording could be wrong.

Three properties matter when reusing it:

- **It renders `null` unless `identityType === 'service'`** — for a person there is no node and no
  reserved space, and an absent or unexpected value marks nothing. A lost mark is acceptable;
  marking a person is not.
- **It takes the identity type, not the user object.** So it adds no new read over a possibly-null
  `creator`, and behaviour around a null author is unchanged.
- **It is not interactive** — no role, no `tabIndex`, no handlers, no `title` and no tooltip. It is
  read-only content and enables no action.

It is an inline-flex element (via the `tag-base` mixin) that does not alter the layout of the row
containing it. It is not a Server/Client concern: it has no state or effects, so it needs no
`'use client'`.

**Interface:**

```tsx
interface AutomatedIdentityBadgeProps {
  readonly identityType?: IdentityType;
}

function AutomatedIdentityBadge(props: AutomatedIdentityBadgeProps): React.ReactNode;
```

**Usage:**

```tsx
import { AutomatedIdentityBadge } from '@/shared/components/ui/AutomatedIdentityBadge';

// The mark accompanies the name, it never replaces it.
<dd>
  <span className={styles.authorValue}>
    {requirement.creator.name}
    <AutomatedIdentityBadge identityType={requirement.creator.identityType} />
  </span>
</dd>
```

> Import it from its own folder (`@/shared/components/ui/AutomatedIdentityBadge`) rather than from
> the `@/shared/components/ui` barrel when the consumer is covered by a jsdom test: the barrel pulls
> in components that depend on `next-auth`, which does not resolve in that environment. It is
> exported from the barrel too, for consumers that already import from it.
