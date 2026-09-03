# Utils — `web`

> Partial catalog seeded by S-006. Run `/service-update-reusable-code web` for a full scan.

## extractFileIds

**Location:** `web/src/features/attachments/utils/extractFileIds.ts`

**Description:** Pulls the ids out of the `[file:N]` / `![file:N]` placeholders embedded in
markdown. Those N are `files.id` values, which is exactly what `fileIds` carries when saving the
entity.

The prefix is the whole point of this module. Embedded markdown handles **two identifier spaces**
that must never be mixed: `attach:N` is a link id (already-saved content) and `file:N` is a file id
(just uploaded, not linked yet). Confusing them does not break compilation — `web`'s types are
hand-written — and shows up as an empty preview, or as the preview of someone else's attachment.

**Signature:**

```ts
function extractFileIds(value: string): number[];
```

**Usage:**

```ts
const payload = { title, description, fileIds: extractFileIds(description) };
```

---

## extractAttachmentIds

**Location:** `web/src/features/attachments/utils/extractFileIds.ts`

**Description:** The counterpart: pulls the ids out of `[attach:N]` / `![attach:N]`, which are ids
of **links**. It is what an editor needs to translate already-linked attachments back to their
`fileId` when building the complete set for an update.

**Signature:**

```ts
function extractAttachmentIds(value: string): number[];
```

---

## fileErrorMessage

**Location:** `web/src/features/attachments/utils/fileErrorMessages.ts`

**Description:** Maps the file domain error codes to the message the interface shows, falling back
to the api's own message and then to a caller-supplied text. It exists so the four codes are said
the same way everywhere.

The important one is `file_not_owned`: it is phrased as a **permissions** problem, not as an
invalid file — the file is fine, what is missing is the right to link it. And it has no exception
by role: an admin gets the same message (RF-13).

**Signature:**

```ts
function fileErrorMessage(error: unknown, fallback: string): string;
```

**Usage:**

```ts
onError: (error) => toast.error(fileErrorMessage(error, 'Hubo un error al crear el requisito'));
```

---

## commentErrorMessage

**Location:** `web/src/features/attachments/utils/fileErrorMessages.ts`

**Description:** Maps the domain error codes the api returns when editing a comment (S-048) to the
Spanish message the interface shows. Delegates `file_not_owned` to `FILE_ERROR_MESSAGES` instead of
duplicating it — the two texts share one source and cannot diverge. Unlike `fileErrorMessage`, it
does **not** fall back to the api's own `error.message`: an unrecognized code always resolves to the
caller-supplied fallback, because the api's raw text is not written for people.

**Signature:**

```ts
function commentErrorMessage(error: unknown, fallback: string): string;
```

**Usage:**

```ts
onError: (error) =>
  toast.error(commentErrorMessage(error, 'Hubo un error al editar el comentario'));
```

---

## getPageWindow

**Location:** `web/src/shared/components/ui/Pagination/getPageWindow.ts`

**Description:** Computes the range of page numbers a paginator should render: a window of at
most 10 numbers (the `PAGE_WINDOW_SIZE` constant), centered on `currentPage` and clamped to
`[1, totalPages]` when the ideal window would fall outside that range. When `totalPages` is 10 or
fewer it returns `[1..totalPages]` with no padding. Returns `[]` for `totalPages <= 0` instead of
throwing. Pure function, no React dependency — safe to unit test without `jsdom`. Used by
`Pagination` (`web/src/shared/components/ui/Pagination/Pagination.tsx`).

**Signature:**

```ts
function getPageWindow(params: { currentPage: number; totalPages: number }): number[];
```

**Usage:**

```ts
const pageNumbers = getPageWindow({ currentPage, totalPages });
// currentPage=15, totalPages=30 -> [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]
```

---

## weekFormat (addDays, getMonday, formatWeekRange, isSameWeek)

**Location:** `web/src/shared/components/ui/WeekNav/weekFormat.ts`

**Description:** Pure `Date`-based week arithmetic, ported (not rewritten) from the legacy
`features/time-allocation/components/WeekNavigator/WeekNavigator.tsx`, which already resolved
month- and year-crossover cases in production. Adapted from `YYYY-MM-DD` strings to `Date`, using
UTC accessors throughout (`getUTCDate`, `setUTCDate`, etc.) so results are stable under the
project's fixed `TZ=UTC` test environment regardless of the host machine's local timezone.

- `addDays(date, days)` — returns a new `Date` shifted by `days` (negative to go back).
- `getMonday(date)` — returns the Monday (00:00 UTC) of the week containing `date`.
- `formatWeekRange(weekStart)` — formats "Semana del D al D de mes[ AL D de mes] AAAA[ al AAAA]",
  spelling out both months when the week crosses a month boundary and both years when it crosses
  a year boundary. The week is Monday-to-Friday (adds 4 days to the Monday).
- `isSameWeek(a, b)` — compares the Monday of each date's week.

No React dependency; used by `WeekNav` (`web/src/shared/components/ui/WeekNav/WeekNav.tsx`).

**Signature:**

```ts
function addDays(date: Date, days: number): Date;
function getMonday(date: Date): Date;
function formatWeekRange(weekStart: Date): string;
function isSameWeek(a: Date, b: Date): boolean;
```

**Usage:**

```ts
import { formatWeekRange, getMonday, isSameWeek, addDays } from './weekFormat';

const monday = getMonday(new Date());
formatWeekRange(monday); // "Semana del 1 al 5 de septiembre 2026"
isSameWeek(monday, weekStart); // → drives WeekNav's `isCurrentWeek`
addDays(weekStart, 7); // next week's Monday
```

## resolveTheme / readStoredTheme / persistTheme

**Location:** `web/src/features/theme/utils/themeStorage.ts`

**Description:** The three pure functions behind theme persistence (S-059), split out of
`ThemeProvider` so they're testable without a render and so the degradation path (no
`localStorage`, corrupted value) is independently verifiable.

- `resolveTheme(value)` — normalizes any value to `'light' | 'dark'`; anything that isn't exactly
  `'dark'` or `'light'` (including `null`/`undefined`/garbage) falls back to `'light'`. Used on
  both the server (reading the cookie in the root layout) and the client (reading
  `localStorage`), so the two never disagree on what counts as a valid theme.
- `readStoredTheme()` — reads `localStorage[THEME_STORAGE_KEY]` (`'jiku.theme'`) through
  `resolveTheme`. Returns `'light'` if the key is absent, the value is invalid, or the
  `localStorage` access itself throws (private browsing, quota exceeded). Never throws.
- `persistTheme(theme)` — writes the theme to `localStorage` **and** to a reflected cookie
  (`jiku.theme; Path=/; Max-Age=31536000; SameSite=Lax`, deliberately **not** `HttpOnly` since the
  client has to write it) so the root layout can read it on the next server render. The two
  writes are in independent `try/catch` blocks: a `localStorage` failure must not skip the cookie
  write, or the no-FOUC guarantee (stamping `data-theme` before paint) breaks on the next visit.

No React dependency; consumed by `ThemeProvider` (client) and `app/layout.tsx` (server, only
`resolveTheme`).

**Signature:**

```ts
type Theme = 'light' | 'dark';

function resolveTheme(value: unknown): Theme;
function readStoredTheme(): Theme;
function persistTheme(theme: Theme): void;
```

**Usage:**

```ts
import { resolveTheme, readStoredTheme, persistTheme } from '@/features/theme/utils/themeStorage';

const theme = resolveTheme(cookieStore.get('jiku.theme')?.value); // server
readStoredTheme(); // client, on mount reconciliation
persistTheme('dark'); // client, on setTheme
```

## parseExternalLinks

**Location:** `web/src/shared/utils/parse-external-links.ts`

**Description:** Parses the `EXTERNAL_LINKS` env-driven JSON
(`[{"tool":"github","href":"https://...","label":"Código"}]`) into the list `ExternalLinksBlock`
renders as icon links in the sidebar footer — team-infrastructure shortcuts (repo, chat, docs),
not part of the product. `tool` selects the icon among a fixed set (`github`, `gitlab`,
`hedgedoc`, `mattermost`, `mail`); an unrecognized `tool` falls back to the generic (GitHub) icon.
Entries missing `href` or `label` are filtered out. A malformed JSON string is caught, logged with
`console.error`, and degrades to an empty list — a bad env var must not take down navigation.

Extracted from `Navbar` (S-060): the component was dead code since S-058 replaced it with
`ShellSidebar`/`SidebarNav`, but survived because this was its only real export still consumed.
The new module carries no `next-auth`, `next/image`, `usePathname` or SVG imports beyond what it
actually needs.

**Signature:**

```ts
interface ExternalLinkConfig {
  readonly href: string;
  readonly icon: string;
  readonly label: string;
}

function parseExternalLinks(raw?: string): ExternalLinkConfig[];
```

**Usage:**

```ts
import { parseExternalLinks } from '@/shared/utils/parse-external-links';

const links = parseExternalLinks(process.env.EXTERNAL_LINKS);
// [{ href: 'https://github.com/...', label: 'Código', icon: <github svg> }, ...]
```
