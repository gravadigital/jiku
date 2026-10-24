# What Jiku does

Two surfaces over one domain: an internal tool for the team, and a portal where clients follow
and request work without seeing anything internal.

## The domain

**Actors** are the organisations work is done for. Each has members and projects.

**Projects** belong to an actor and move through `analisis` → `activo` → `inactivo` /
`finalizado` / `cancelado`. A project carries a team, free-form properties (links to
documentation, design, a task board) and status updates over time.

**Requirements** are what a client asks for — feature, improvement, incident or other, with a
priority. They move along:

```
analisis → planificacion → en_cola → desarrollo → revision → resuelto
```

Nothing enforces that order: the state reflects what the team says it is, and any state is
reachable from any other — including back out of `resuelto` or `cancelado`, which clears the
stored resolution. Requirements carry responsible people, an activity feed, comments,
subscribers and attachments. Resolving one records a resolution type and a conclusion; both are
**required only for an `incidencia`**, and optional for every other type.

**Tasks** are the concrete work, optionally linked to a requirement. Same shape: responsible
people, priority, estimated finish date, comments, activity history.

> Tasks are called `objectives` in the database and in the HTTP API, and `task` on the bus.
> Same entity.

**Worked time** is logged against a task or a requirement. **Unworked time** records absences
with a reason. **Time allocation** assigns expected weekly hours per person and project, which
is what the reports compare against.

Reports aggregate hours by person, by project and by requirement; the requirements report
exports to CSV.

**Notifications** reach a requirement's subscribers by email, on four events: the requirement is
created, it is resolved, it is reopened, and a **public** comment lands on a **public**
requirement. The actor never gets a mail about their own action. Mail is enqueued inside the
same transaction that writes the change — if the write fails there is no mail — and delivered by
a separate process, so an unreachable mail server never blocks anyone's work. It needs
`SMTP_*` configured; see [configuration.md](configuration.md).

> The two visibility defaults run in opposite directions: a requirement defaults to `public`, a
> comment defaults to `internal`. A comment posted without an explicit visibility notifies nobody.

**Comments** on a task or a requirement can be edited afterwards by their author, or by an
`admin` — text and attachments alike. Editing never notifies, and the "edited" marker is shown
only on the internal frontend, never on the portal.

**Attachments** go on tasks, requirements and comments, and can be referenced inline in text so
they render in place. Storage is any S3-compatible service. Each attachment has a visibility
level — that is what lets an internal comment carry a file the portal will not serve.

> State, type and priority values are stored in Spanish because they are baked into the database
> schema. They are opaque identifiers — see [known-limitations.md](known-limitations.md).

## Documentation (optional module)

If jiku-docs is installed — a separate service, optional — documentation lives next to the work.
Without it nothing of this appears; with it down, the screens show a notice and disable the
actions that need it.

On the internal frontend:

- A **documentation panel** on every project, requirement and task, plus a `/docs` page that
  browses folders level by level and searches.
- A viewer, and a **markdown editor** with a preview. Editing takes a **reservation** on the
  document, so two people cannot overwrite each other; it is renewed while the editor is open and
  expires on its own.
- **Attachments** on documents.
- **Shared links**, read-only, for sharing a document with someone who has no account. The link is shown
  **once**, expires after at most 180 days and can be revoked.

The portal shows only documents marked `public` and linked to the client's projects, read-only.

## Three rules that surprise people

`core` enforces these, and they produce errors that look like bugs:

- You log **your own** hours, nobody else's.
- Only for **today and the ten days before it**.
- Worked and unworked time share a **daily limit**; absences count toward it.

The internal frontend ships a **light and a dark theme**, with a selector in the sidebar; the
choice is remembered per browser. The portal does not have one.

## Who sees what

| Role | Sees |
|---|---|
| `admin` | everything, including settings |
| `user` | the internal frontend: all projects, tasks and requirements, plus their own hours |
| `external-user` | the portal, restricted to the projects they were explicitly granted |

Roles come from the identity provider as a claim on the token; they are not managed inside Jiku.
Who may see or edit a document is decided by jiku-docs, not by Jiku.

A client user reaches only the projects granted to them, can create requirements — the main
point of the portal — comment, subscribe, and download attachments whose visibility allows it.
They never see hours, internal comments or other clients' projects.

**Requirements also carry a visibility level, and the portal serves only the public ones.**
That trim does not depend on the role: a `user` or an `admin` browsing the portal sees exactly
the same requirements a client does. Marking a requirement `internal` is what keeps it off the
screen the team shares with the client — it stays fully visible on the internal frontend.

## What Jiku does not do

Stated plainly, because some of it used to exist and was removed before publishing:

- **No reminders or recurring reports.** Apart from the notification delivery process, the only
  timers are health checks: the api checks the documentation module every 30 seconds and the
  frontends every 60.
- **The documentation screens are not an administration tool.** Folders and their permissions are
  managed outside Jiku, and the interface does not show version history, move, delete or restore
  a document (the api supports them), nor update in real time.
- **No user administration.** Users come from the identity provider. Whoever connects to the bus
  is created automatically from the authentication event; someone who only uses the web and is
  not yet in the database gets a 401 — see [known-limitations.md](known-limitations.md).
- **No external-system integration.** The schema prepared to sync tasks with an external tracker
  was dropped: it never had code behind it.
- **No multi-tenancy.** One installation serves one organisation.
- **Spanish-only interface.** Both frontends are in Spanish, with no i18n layer yet.
