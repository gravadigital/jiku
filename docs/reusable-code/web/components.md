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

## Button

**Location:** `web/src/shared/components/ui/Button/Button.tsx`

**Description:** The single button component of the Design System (`web` v2.4.1, spec `Button`
v2.0.1) — five semantic variants (`primary`, `secondary-nav`, `secondary-dismiss`, `session`,
`flow`) plus a `fab` mode, all deriving their look from the component tokens `--button-*`. Renders
`children` as the label (no `label: string` prop), has no `size` prop, and has no `type` prop (it
is never a native form submit).

- **`variant` is semantic, not decorative** — `secondary-nav` navigates (aqua border),
  `secondary-dismiss` discards (light border). They are not interchangeable; the JSDoc above the
  component carries the full classification table used to pick one when migrating an existing use.
- **`loading`** replaces the label with `<Loader variant="inline" size="sm" />` and sets
  `aria-busy="true"`; it does not fire `onClick`.
- **`disabled`** sets `aria-disabled="true"` and does not fire `onClick` (the `<button>` itself is
  also natively `disabled`).
- **`href`** is a local extension outside the spec: without an `onClick`, clicking navigates via
  `useRouter().push`. Exists only so `secondary-nav` uses ("Volver") keep working before their
  screen migration.
- **`fab`** requires `aria-label` (enforced by the type: `ButtonFabProps` extends the base props
  with a mandatory `'aria-label'`) and renders no visible label.

**Interface:**

```tsx
type ButtonVariant = 'primary' | 'secondary-nav' | 'secondary-dismiss' | 'session' | 'flow';

interface ButtonProps {
  readonly children?: React.ReactNode; // required in practice, except on `fab`
  readonly variant?: ButtonVariant;
  readonly disabled?: boolean;
  readonly loading?: boolean;
  readonly icon?: string;
  readonly iconTrailing?: boolean;
  readonly onClick?: MouseEventHandler<HTMLButtonElement>;
  readonly href?: string; // local extension, not in the DS spec
  readonly ariaDescribedBy?: string;
  readonly fab?: boolean; // when true, 'aria-label' is required
}
```

**Usage:**

```tsx
import { Button } from '@/shared/components/ui';

<Button variant="primary" onClick={handleSave} loading={isSaving}>
  Guardar
</Button>

<Button variant="secondary-nav" href="/objectives">
  Volver
</Button>

<Button fab aria-label="Agregar requisito" icon="mas" onClick={openCreate} />
```

## Input

**Location:** `web/src/shared/components/ui/Input/Input.tsx`

**Description:** The single text-field component of the Design System (spec `Input` v1.0.0) — five
variants (`text`, `textarea`, `date`, `search`, `locked`) sharing one 44px/radius-10 box. Always
renders a real `<label htmlFor>` (the placeholder never substitutes for it), and `error` is a
**string** (not a boolean): its presence both paints the error state and supplies the text that
`aria-describedby` points to.

- `date` and `search` carry their own inline SVG leading icon (calendar / magnifying glass, both
  stroke-only `currentColor`, decorative `aria-hidden="true"`); `date` still accepts typed input.
- `locked` renders `readOnly`, on a niebla (`--bg-surface-sunken`) background, with no focus ring.
- Ids are generated with `useId()` — the consumer never has to pass a `code`/id itself.

**Interface:**

```tsx
type InputVariant = 'text' | 'textarea' | 'date' | 'search' | 'locked';

interface InputProps {
  readonly variant?: InputVariant;
  readonly label: string; // required — no placeholder-only fields
  readonly required?: boolean;
  readonly placeholder?: string;
  readonly error?: string; // presence activates the error state
  readonly disabled?: boolean;
  readonly icon?: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
}
```

**Usage:**

```tsx
import { Input } from '@/shared/components/ui';

<Input
  label="Email"
  value={email}
  onChange={setEmail}
  error={emailError}
/>

<Input variant="search" label="Buscar" placeholder="Buscar proyecto" value={q} onChange={setQ} />
```

## Select

**Location:** `web/src/shared/components/ui/Select/Select.tsx`

**Description:** The single selector of the Design System (spec `Select` v1.0.0) — a hand-rolled
combobox (no `react-select` dependency, no duplicated `selectStyles`) with four variants (`single`,
`multiple` with removable chips, `locked`, `inline`). Fully keyboard-operable: `Enter`/`Space`
opens, arrow keys move through options, `Enter` selects, `Esc` closes and returns focus,
`Backspace` pops the last chip in `multiple`.

- **`variant="multiple"`** renders the trigger as a `<div role="combobox" tabIndex={0}>` instead of
  a `<button>`, because it hosts a real `<button>` per chip (removal) and a `<button>` cannot
  legally nest interactive content. `single`/`locked`/`inline` render a plain `<button>`.
  `onChange` receives `string[]`.
- **`variant="single" | "locked" | "inline"`** render a `<button role="combobox">`; `onChange`
  receives a single `string`.
  `inline` drops the visible `<label>` but keeps an accessible name via `aria-label`.
  `locked` never opens the menu.
- Each chip's remove control has `aria-label="Quitar {label}"`.
- `error` is a string, same contract as `Input`.

**Interface:**

```tsx
interface SelectOption {
  readonly value: string;
  readonly label: string;
}

// single | locked | inline
interface SelectSingleProps {
  readonly variant?: 'single' | 'locked' | 'inline';
  readonly value: string;
  readonly onChange: (value: string) => void;
}

// multiple
interface SelectMultipleProps {
  readonly variant: 'multiple';
  readonly value: string[];
  readonly onChange: (value: string[]) => void;
}

type SelectProps = (SelectSingleProps | SelectMultipleProps) & {
  readonly label?: string; // required except in `inline`
  readonly options: SelectOption[];
  readonly placeholder?: string;
  readonly required?: boolean;
  readonly error?: string;
  readonly disabled?: boolean;
};
```

**Usage:**

```tsx
import { Select } from '@/shared/components/ui';

<Select label="Cliente" options={clientOptions} value={clientId} onChange={setClientId} />

<Select
  variant="multiple"
  label="Estado"
  options={stateOptions}
  value={selectedStates}
  onChange={setSelectedStates}
/>
```

## Loader

**Location:** `web/src/shared/components/ui/Loader/Loader.tsx`

**Description:** The single loading indicator of the Design System (spec `Loader` v2.0.0),
absorbing what used to be two separate components (`Loader` and `Spinner`). Two variants: `block`
(occupies the place of the content, shows the label — 24px) and `inline` (accompanies content
already on screen, no visible label — 16px). The single default label across the whole app is
`"Cargando…"` (typographic ellipsis); pass a different `label` only for a long, nameable operation
("Subiendo archivo…").

- The container always carries `role="status"` and `aria-live="polite"`; the spinning graphic is
  `aria-hidden="true"`. `inline` exposes `aria-label="Cargando"` since it has no visible text.
- `prefers-reduced-motion: reduce` stops the rotation and leaves a static ring with the same token
  color — handled entirely in the component's own `.module.scss`, no JS branch.
- **`label` is backward-compatible** with the old `Loader`'s required `{ label }` prop: existing
  `<Loader label="Cargando..." />` call sites across the app keep compiling and rendering
  unchanged, since `variant` defaults to `block`.

**Interface:**

```tsx
interface LoaderProps {
  readonly variant?: 'block' | 'inline'; // default: 'block'
  readonly size?: 'md' | 'sm'; // default: 'md' on block, 'sm' on inline
  readonly label?: string; // default: 'Cargando…'; only visible in `block`
}
```

**Usage:**

```tsx
import { Loader } from '@/shared/components/ui';

<Suspense fallback={<Loader label="Cargando..." />}>...</Suspense>

// Inside a Button's loading state:
<Loader variant="inline" size="sm" />
```

## Badge

**Location:** `web/src/shared/components/ui/Badge/Badge.tsx`

**Description:** The single status/tag pill of the Design System (spec `Badge` v1.1.0). Four
variants are read-only presentation (`state`, `outline`, `area`, `card-tag`); `editable` is a real
control — the state-change dropdown that S-050 established must always offer **all seven states**,
uncut, even when the current state is `resuelto` or `cancelado` (they are not terminal).

- The component receives a **`family`** (one of the six system color families), never a domain
  state string. `STATE_TO_FAMILY` — exported alongside `Badge` — is the spec's
  state→family mapping table, for screens to reuse instead of reimplementing it.
- Color always doubles with text: the colored dot (`aria-hidden="true"`) never carries the state
  alone.
- `editable` is a `<button aria-haspopup="listbox" aria-expanded>` whose accessible name states
  what it changes ("Estado: Desarrollo"), not just the value.

**Interface:**

```tsx
type BadgeVariant = 'state' | 'outline' | 'area' | 'editable' | 'card-tag';
type BadgeFamily = 'resolved' | 'in-progress' | 'review' | 'urgent' | 'analysis' | 'neutral';

interface BadgeOption {
  readonly value: string;
  readonly label: string;
}

// state | outline | area | card-tag
interface BadgePresentationalProps {
  readonly variant?: Exclude<BadgeVariant, 'editable'>;
  readonly family?: BadgeFamily;
  readonly label: string;
}

// editable
interface BadgeEditableProps {
  readonly variant: 'editable';
  readonly family?: BadgeFamily;
  readonly label: string;
  readonly options: BadgeOption[];
  readonly onChange: (value: string) => void;
}

declare const STATE_TO_FAMILY: Record<string, BadgeFamily>;
```

**Usage:**

```tsx
import { Badge, STATE_TO_FAMILY } from '@/shared/components/ui';

<Badge variant="state" family={STATE_TO_FAMILY[requirement.state]} label={stateLabel} />

<Badge
  variant="editable"
  family={STATE_TO_FAMILY[requirement.state]}
  label={stateLabel}
  options={SEVEN_STATES}
  onChange={handleStateChange}
/>
```

## Card

**Location:** `web/src/shared/components/ui/Card/Card.tsx`

**Description:** The single card container of the Design System (spec `Card` v1.0.0) — five
variants (`project`, `task`, `task-overdue`, `panel` default, `metric`). A navigable card
(`href` set) exposes **exactly one** accessible destination: the title renders as a real heading
wrapping a `<Link>`, expanded to the full card surface via `::after`; no other control is nested
inside it. Width and per-row height equalization are the caller's grid's job, not the card's — it
is 100% fluid.

- `task-overdue` is not a separate visual variant so much as `task` with its metrics footer tinted
  red; the same tinting also triggers on any `task`/`project` card whose `metrics` include one
  entry with `overdue: true`.
- `headingLevel` (`h2 | h3 | h4`, default `h3`) lets the caller pick the right heading level for the
  page's outline — never hardcode `<h2>`.
- Dark mode follows the project's `:root[data-theme='dark']` attribute convention (not
  `prefers-color-scheme`), matching how `_semantic.scss` (S-052) implements it elsewhere.

**Interface:**

```tsx
type CardVariant = 'project' | 'task' | 'task-overdue' | 'panel' | 'metric';

interface CardProps {
  readonly variant?: CardVariant; // default: 'panel'
  readonly title?: string;
  readonly href?: string; // presence makes the card navigable
  readonly status?: { family: BadgeFamily; label: string };
  readonly tags?: { label: string; family?: BadgeFamily }[];
  readonly metrics?: { label: string; value: string; overdue?: boolean }[];
  readonly headingLevel?: 'h2' | 'h3' | 'h4'; // default: 'h3'
  readonly children?: React.ReactNode; // `panel` content slot
  readonly header?: React.ReactNode;
  readonly footer?: React.ReactNode;
}
```

**Usage:**

```tsx
import { Card } from '@/shared/components/ui';

<Card variant="project" title="EXO · WashMach" href="/projects/1" status={{ family: 'in-progress', label: 'Activo' }} />

<Card title="Información general">
  <dl>...</dl>
</Card>
```
