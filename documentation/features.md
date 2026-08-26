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

Nothing enforces that order: the state reflects what the team says it is. Requirements carry
responsible people, an activity feed, comments, subscribers and attachments. Resolving one is a
separate operation that records a resolution type and a conclusion.

**Tasks** are the concrete work, optionally linked to a requirement. Same shape: responsible
people, priority, estimated finish date, comments, activity history.

> Tasks are called `objectives` in the database and in the HTTP API, and `task` on the bus.
> Same entity.

**Worked time** is logged against a task or a requirement. **Unworked time** records absences
with a reason. **Time allocation** assigns expected weekly hours per person and project, which
is what the reports compare against.

Reports aggregate hours by person, by project and by requirement; the requirements report
exports to CSV.

**Attachments** go on tasks, requirements and comments, and can be referenced inline in text so
they render in place. Storage is any S3-compatible service. Each attachment has a visibility
level — that is what lets an internal comment carry a file the portal will not serve.

> State, type and priority values are stored in Spanish because they are baked into the database
> schema. They are opaque identifiers — see [known-limitations.md](known-limitations.md).

## Three rules that surprise people

The api enforces these, and they produce errors that look like bugs:

- You log **your own** hours, nobody else's.
- Only for **today and the ten days before it**.
- Worked and unworked time share a **daily limit**; absences count toward it.

## Who sees what

| Role | Sees |
|---|---|
| `admin` | everything, including settings |
| `user` | the internal frontend: all projects, tasks and requirements, plus their own hours |
| `external-user` | the portal, restricted to the projects they were explicitly granted |

Roles come from the identity provider as a claim on the token; they are not managed inside Jiku.

A client user reaches only the projects granted to them, can create requirements — the main
point of the portal — comment, subscribe, and download attachments whose visibility allows it.
They never see hours, internal comments or other clients' projects.

## What Jiku does not do

Stated plainly, because some of it used to exist and was removed before publishing:

- **No notifications.** Requirements have subscribers, but nothing sends them anything.
- **No scheduled jobs.** No reminders, no recurring reports.
- **No user administration.** Users come from the identity provider. Whoever connects to the bus
  is created automatically from the authentication event; someone who only uses the web and is
  not yet in the database gets a 401 — see [known-limitations.md](known-limitations.md).
- **No external-system integration.** The schema prepared to sync tasks with an external tracker
  was dropped: it never had code behind it.
- **No multi-tenancy.** One installation serves one organisation.
- **Spanish-only interface.** Both frontends are in Spanish, with no i18n layer yet.
