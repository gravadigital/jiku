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

## Table

**Location:** `web/src/shared/components/ui/Table/Table.tsx`

**Description:** The Design System's single data table (spec `Table` v1.0.0). Renders a real
`<table>` — never a `<div>` grid — with three density variants: `light` (mist header, navigable
listings), `dense` (dark-blue header, dense tracking tables), `matrix` (mist header with
small-caps groupers, two-dimension crossovers). Row height is fixed at 48px across all three
variants. Column headers carry `scope="col"`; `matrix` row headers (declared via
`column.scope: 'row'`) carry `scope="row"`. Sortable columns expose `aria-sort` and toggle
direction on click via `onSortChange`. `loading` renders a `role="status"` indicator instead of
rows; an empty `rows` array renders `emptyState` outside the `<table>` (so the header stays the
only `<tr>`, per its own test contract). A cell can be flagged `overdue` via the row's `_overdue`
array — the mark is textual (a CSS class + whatever text the consumer puts in the cell), never a
row-wide background fill.

Nine ad-hoc `<table>` implementations existed in the product before this component (`RequirementList`,
`ObjectivesTable`, `RequirementsReportTable`, etc.) — none of them are migrated to `Table` yet; that
is the job of stories S-056 to S-058.

**Interface:**

```tsx
interface TableColumn {
  readonly key: string;
  readonly label: string;
  readonly sortable?: boolean;
  readonly scope?: 'row'; // marks this column as a row header, `matrix` only
}
interface TableSort {
  readonly key: string;
  readonly direction: 'asc' | 'desc';
}
interface TableRow {
  readonly [key: string]: React.ReactNode;
  readonly _overdue?: readonly string[]; // column keys whose value in this row is overdue
}
interface TableProps {
  readonly variant?: 'light' | 'dense' | 'matrix'; // default 'light'
  readonly columns: readonly TableColumn[];
  readonly rows: readonly TableRow[];
  readonly sort?: TableSort;
  readonly onSortChange?: (sort: TableSort) => void;
  readonly emptyState?: React.ReactNode;
  readonly loading?: boolean;
  readonly ariaLabel?: string; // name of the horizontal-scroll region
}
```

**Usage:**

```tsx
import { Table } from '@/shared/components/ui';

<Table
  variant="dense"
  columns={[{ key: 'title', label: 'Tarea' }, { key: 'closeDate', label: 'Cierre', sortable: true }]}
  rows={[{ title: 'Migrar el formulario', closeDate: '25 ago' }]}
  sort={{ key: 'closeDate', direction: 'asc' }}
  onSortChange={(sort) => setSort(sort)}
  emptyState={<span>No se encontraron requisitos</span>}
/>
```

## Stepper

**Location:** `web/src/shared/components/ui/Stepper/Stepper.tsx`

**Description:** The Design System's single work-progress stepper (spec `Stepper` v1.1.0).
Informs the **five fixed** work steps of a requirement (Análisis, Planificación, En cola,
Desarrollo, Revisión) — `Resuelto`/`Cancelado` are never nodes. It only ever reads *where* the
requirement is; deciding *where it can go* is `Badge editable`'s job (offers the seven states),
and closing/reopening is the resolution card's job — Stepper never grows into a state selector.

Renders an `<ol>`; by default (`interactive=false`) no node is focusable and there is no
`role="button"` anywhere — pure information. With `interactive`, each node becomes a `<button>`
and `onStepChange` fires the chosen step's key. The current node carries `aria-current="step"`.
Each node's state (recorrido/actual/pendiente) is distinguished **by shape** (`✓`, ring, number),
never by color alone, and is also announced in an accessible text sentence per node
(`"{label}, {completada|etapa actual|pendiente}"`) — the `✓` glyph alone does not satisfy that.

`doneKeys`/`skippedKeys` exist specifically to let a consumer express the two cases the legacy
inline stepper in `RequirementStatusCard` already handles: a terminal state (`resuelto`/`cancelado`)
marks all five steps done even though `currentKey` is not one of the five (`doneKeys`), and a step
that was skipped on cancellation (no real activity in the history) renders `×` instead of `✓`
(`skippedKeys`) so it never claims to have been completed. `RequirementStatusCard` itself is not
migrated to this component yet — that is S-057's job; this component only had to prove it *can*
express the same behavior.

**Interface:**

```tsx
interface StepperStep {
  readonly key: string;
  readonly label: string;
}
interface StepperProps {
  readonly steps: readonly StepperStep[];
  readonly currentKey: string;
  readonly doneKeys?: readonly string[]; // explicit override, e.g. terminal states
  readonly skippedKeys?: readonly string[]; // of the done ones, which show × instead of ✓
  readonly interactive?: boolean; // default false
  readonly onStepChange?: (key: string) => void;
}
```

**Usage:**

```tsx
import { Stepper } from '@/shared/components/ui';

const STEPS = [
  { key: 'analisis', label: 'Análisis' },
  { key: 'planificacion', label: 'Planificación' },
  { key: 'en_cola', label: 'En cola' },
  { key: 'desarrollo', label: 'Desarrollo' },
  { key: 'revision', label: 'Revisión' },
];

<Stepper steps={STEPS} currentKey={requirement.state} />
```

## Avatar

**Location:** `web/src/shared/components/ui/Avatar/Avatar.tsx`

**Description:** The Design System's single avatar (spec `Avatar` v1.0.0). Two variants:
`person` renders exactly two uppercase initials derived from `name` (never a single letter, even
for a one-word name), `app` renders the Jiku symbol at 62% of the diameter — the two are never
interchangeable. The background/text color is fixed (`--avatar-bg`/`--avatar-text`, dark-blue on
mist) and **does not vary by person** — there is no per-user color assignment anywhere. When
`nameVisible` is set the avatar is `aria-hidden` (the visible name next to it already identifies
the person); without it, the avatar itself carries the full name as `aria-label`, since initials
alone don't identify anyone. `extraCount` renders an accessible "+N" suffix outside the avatar
node with a spelled-out screen-reader text (`"y N responsable(s) más"`), never the bare glyph.

This story also fixed a token bug it inherited from S-052: `--avatar-bg`/`--avatar-text` in
`web/src/styles/_component.scss` were pointing at the wrong semantics
(`--bg-tint-neutral`/`--text-primary`) instead of the spec's `--bg-inverse`/`--text-inverse`. That
is a correction to the service's token layer, not a Design System change.

**Interface:**

```tsx
interface AvatarProps {
  readonly variant?: 'person' | 'app'; // default 'person'
  readonly name: string;
  readonly size?: 'sm' | 'md'; // default 'sm' — 24px / 32px
  readonly nameVisible?: boolean;
  readonly extraCount?: number;
}
```

**Usage:**

```tsx
import { Avatar } from '@/shared/components/ui';

<Avatar name="Andrés Vandoni" size="md" nameVisible />
<Avatar name="Andrés Vandoni" /> {/* aria-label carries the full name */}
```

## SidebarNav

**Location:** `web/src/shared/components/ui/SidebarNav/SidebarNav.tsx`

**Description:** The Design System's single sidebar navigation (spec `SidebarNav` v1.0.0). Fixed
300px width, `<nav aria-label="Navegación principal">` with a real `<ul>/<li>` list; subitems
nest inside their parent's `<li>`, never as siblings. The active item (or subitem) carries
`aria-current="page"` and is marked with all three signals at once — white card background, 3px
aqua bar, and icon color `#12897A` (never the brand aqua itself, which fails contrast on light
backgrounds) — so activity is never conveyed by color alone. Icons render through `TintedIcon`
(color passed explicitly as `--nav-item-icon`/`--nav-item-active-icon`, never its magenta
default), wrapped in an `aria-hidden` `<span>` since the label is always visible. The footer shows
the user's `Avatar` + name and a logout control.

**Receives `activeKey` and `user` by prop and calls neither `usePathname` nor `useSession`** — the
consumer resolves those, which is what makes this component unit-testable without mounting a
session or a router. This is a **new** component, coexisting with the legacy `Navbar` /
`NavItem` / `NavSubItem` (which stay untouched, template-string class bug included); adopting it
in `(loggedin)/layout.tsx` is S-058's job.

**Interface:**

```tsx
interface SidebarNavSubItem {
  readonly key: string;
  readonly label: string;
  readonly href: string;
}
interface SidebarNavItem {
  readonly key: string;
  readonly label: string;
  readonly icon: string; // asset path
  readonly href: string;
  readonly children?: readonly SidebarNavSubItem[];
}
interface SidebarNavProps {
  readonly items: readonly SidebarNavItem[];
  readonly activeKey: string;
  readonly user: { readonly name: string; readonly initials: string };
  readonly onLogout: () => void;
}
```

**Usage:**

```tsx
import { SidebarNav } from '@/shared/components/ui';

<SidebarNav
  items={NAV_ITEMS}
  activeKey="projects"
  user={{ name: session.user.name, initials: getInitials(session.user.name) }}
  onLogout={() => signOut()}
/>
```

## ViewHeader

**Location:** `web/src/shared/components/ui/ViewHeader/ViewHeader.tsx`

**Description:** The Design System's single view header (spec `ViewHeader` v1.1.0). The title is
always the view's real `<h1>` (Sora 30/700) — never a styled `<div>`. Three variants: `list`
(plain title + optional action), `breadcrumb` (adds `<nav aria-label="Ruta">` with the parent
level as a link and the current level in **lowercase**, `aria-current="page"`), `detail` (renders
`badges` — typically `Badge` `editable`, which is where the seven domain states live; `ViewHeader`
only passes them through). `action` renders exactly one `Button` — never more than one primary
action in the header, even if the API were misused with more.

**Interface:**

```tsx
interface ViewHeaderProps {
  readonly variant?: 'list' | 'breadcrumb' | 'detail'; // default 'list'
  readonly title: string;
  readonly parent?: { readonly label: string; readonly href: string };
  readonly badges?: readonly { variant?: BadgeVariant; family?: BadgeFamily; label: string }[];
  readonly action?: Pick<ButtonProps, 'children' | 'onClick' | 'variant' | 'disabled' | 'loading'>;
}
```

**Usage:**

```tsx
import { ViewHeader } from '@/shared/components/ui';

<ViewHeader
  variant="breadcrumb"
  title="crear"
  parent={{ label: 'Tareas', href: '/objectives' }}
  action={{ children: 'Guardar', onClick: handleSave }}
/>
```

## Tabs

**Location:** `web/src/shared/components/ui/Tabs/Tabs.tsx`

**Description:** The Design System's single tabs component (spec `Tabs` v1.0.0). Implements the
full ARIA tablist pattern: `role="tablist"`/`role="tab"` with `aria-selected`, roving tabindex
(only the active tab has `tabIndex=0`), arrow keys move focus and selection between tabs,
`Home`/`End` jump to the extremes, and a single `Tab` press enters or exits the tablist rather
than stepping through every tab. The count is part of each tab's accessible name (`"En curso, 3
elementos"`) and **a tab with count 0 is never hidden or disabled** — it's information. The
active tab is distinguished by both the 2px aqua indicator and font weight, never the indicator
alone. `children`, when provided, render inside a `role="tabpanel"` associated via
`aria-labelledby` to the active tab.

**Interface:**

```tsx
interface TabItem {
  readonly key: string;
  readonly label: string;
  readonly count: number;
}
interface TabsProps {
  readonly tabs: readonly TabItem[];
  readonly activeKey: string;
  readonly onChange: (key: string) => void;
  readonly children?: React.ReactNode; // optional tabpanel content
}
```

**Usage:**

```tsx
import { Tabs } from '@/shared/components/ui';

<Tabs
  tabs={[{ key: 'backlog', label: 'Backlog', count: 0 }, { key: 'curso', label: 'En curso', count: 3 }]}
  activeKey={activeTab}
  onChange={setActiveTab}
/>
```

## Pagination

**Location:** `web/src/shared/components/ui/Pagination/Pagination.tsx`

**Description:** The Design System's single pagination control (spec `Pagination` v1.0.0),
extended in S-054 on top of the route-agnostic rewrite S-037 already did. Two invocation modes,
discriminated by props: **URL mode** (`basePath`) navigates via `next/navigation`'s `useRouter`/
`useSearchParams`, preserving every other search param; **controlled mode** (`currentPage` +
`onPageChange`) just calls back with the new page number — no route knowledge at all. It **never
hardcodes a route** (that was the S-037 bug this component exists to prevent regressing).

**Never hides.** A single page, or 0 items, still renders the `<nav>` with both arrows genuinely
`disabled` (not just visually dimmed) — this is an intentional behavior change from before S-054,
when 0 items returned `null`. An optional page-size selector (`pageSizeOptions` /
`onPageSizeChange`, only rendered when both are given) uses `Select` `variant="inline"` with an
explicit unit ("5 por página", never a bare "5"). Page changes are announced through a
`sr-only` `aria-live="polite"` region ("Página 2 de 4"). The sliding page-number window
(`getPageWindow`, see Utils) and its accessibility (`aria-current`, named arrows) are unchanged.

Note the spec/implementation divergence, kept intentionally: the spec's API is `page`/`totalPages`,
but this component keeps `totalItems`/`limit` (deriving `totalPages` internally) because changing
it would break every existing screen consumer — that migration is explicitly out of scope for the
story that extended this component (S-054) and belongs to S-056–S-058.

**Interface:**

```tsx
type PaginationProps =
  | {
      readonly totalItems: number;
      readonly limit: number;
      readonly basePath: string; // URL mode
      readonly pageSizeOptions?: readonly number[]; // default [5, 10, 25]
      readonly onPageSizeChange?: (pageSize: number) => void;
    }
  | {
      readonly totalItems: number;
      readonly limit: number;
      readonly currentPage: number; // controlled mode
      readonly onPageChange: (page: number) => void;
      readonly pageSizeOptions?: readonly number[];
      readonly onPageSizeChange?: (pageSize: number) => void;
    };
```

**Usage:**

```tsx
import { Pagination } from '@/shared/components/ui';

// URL mode
<Pagination totalItems={count} limit={limit} basePath="/requirements" />

// Controlled mode, with page-size selector
<Pagination
  totalItems={count}
  limit={limit}
  currentPage={page}
  onPageChange={setPage}
  pageSizeOptions={[5, 10, 25]}
  onPageSizeChange={setLimit}
/>
```

## WeekNav

**Location:** `web/src/shared/components/ui/WeekNav/WeekNav.tsx`

**Description:** The Design System's single week navigator (spec `WeekNav` v1.0.0). Takes and
returns real `Date` objects (Monday of the target week), unlike the legacy `WeekNavigator` it
supersedes (which used `YYYY-MM-DD` strings). `<nav aria-label="Navegación de semana">`; the range
is always written in full with month and year ("Semana del 24 al 28 de agosto 2026") and resolves
month and year crossovers correctly. "Esta semana" is **always visible** — it marks itself
disabled when `isCurrentWeek` is true, it never disappears. A change of week is announced via an
`aria-live="polite"` region. Built with `Button` `variant="secondary-nav"`, same as the legacy
component.

The range-formatting math (`addDays`, `getMonday`, `formatWeekRange`) was **ported**, not
rewritten, from `features/time-allocation/components/WeekNavigator/WeekNavigator.tsx` into
`WeekNav/weekFormat.ts` — see the Utils section. The legacy `WeekNavigator` stays in place and
in use by `/time-allocation`; migrating that screen to `WeekNav` is S-058's job.

**Interface:**

```tsx
interface WeekNavProps {
  readonly weekStart: Date;
  readonly onChange: (weekStart: Date) => void;
  readonly isCurrentWeek: boolean;
}
```

**Usage:**

```tsx
import { WeekNav } from '@/shared/components/ui';

<WeekNav weekStart={weekStart} onChange={setWeekStart} isCurrentWeek={isSameWeek(weekStart, new Date())} />
```
