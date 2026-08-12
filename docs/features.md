# What Jiku does

Jiku is a project management system for a services team, with a separate portal so clients
can follow and request work without access to the internal tool.

If you want to know how it is built, see [architecture.md](architecture.md). For how to use
it day to day, [usage.md](usage.md).

## The two surfaces

**The internal frontend** (`web`) is what the team uses: clients, projects, requirements,
tasks, time allocation and worked hours.

**The client portal** (`opus-web`) is what a client sees. It exposes a subset of the same
data through `/api/opus/*` endpoints, restricted by project permissions: a client user only
ever sees the projects they were granted access to.

## The domain

### Actors and projects

**Actors** (`clients` in the API) are the organisations work is done for. Each can have
members and several projects.

**Projects** belong to an actor and move through a lifecycle: `analisis`, `activo`,
`inactivo`, `finalizado`, `cancelado`. A project carries a team, a set of free-form
properties (links to documentation, design, a task board), and status updates over time.

### Requirements

A **requirement** is a unit of work a client asks for. It has a type — feature, improvement,
incident or other — a priority, and it moves through a lifecycle:

```
analisis → planificacion → en_cola → desarrollo → revision → resuelto
```

Requirements carry responsible people, an activity feed, comments (internal or client-visible),
subscribers who follow their progress, and attachments.

Resolving a requirement is its own operation, separate from editing it: it records a
resolution type and a conclusion.

> Those state and type values are stored in Spanish because they are baked into the database
> schema. They are opaque identifiers — see [known-limitations.md](known-limitations.md).

### Tasks

A **task** is a concrete piece of work, optionally linked to a requirement. Tasks have
responsible people, a priority, an estimated finish date, an activity history and comments.

> In the database and in the HTTP API these are called `objectives`. The bus protocol renamed
> them to `task`. Same thing — see
> [architecture.md](architecture.md#names-differ-between-the-bus-and-the-database).

### Time tracking

**Worked time** is logged against a task or a requirement, by person and date, with a few
rules enforced by the API: you log your own hours, and only for the current day and the ten
days before it.

**Unworked time** records absences with a reason, and counts toward the same daily limit as
worked hours.

**Time allocation** assigns expected weekly hours per person and project.

Reports aggregate hours by person, by project, and by requirement.

### Attachments

Files can be attached to tasks, requirements and comments, and referenced inline in
descriptions so they render in place. Storage is any S3-compatible service — AWS S3, MinIO,
DigitalOcean Spaces, Cloudflare R2.

Attachments have a visibility level, which is what lets an internal comment carry a file the
client portal will not serve.

## Roles

| Role            | What it sees                                                                 |
| --------------- | ---------------------------------------------------------------------------- |
| `admin`         | everything, including settings                                               |
| `user`          | the internal frontend: all projects, tasks, requirements and their own hours |
| `external-user` | the client portal, restricted to the projects they were granted              |

Roles come from the identity provider as a claim on the access token. They are not managed
inside Jiku.

## What Jiku does not do

Stated plainly, because some of it used to exist and was removed before publishing:

- **No notifications.** No email, no chat integrations. Requirements have subscribers, but
  nothing sends them anything.
- **No scheduled jobs.** There are no reminders or recurring reports.
- **No user administration.** Users come from the identity provider. Jiku reads their
  identity and role; it does not create or manage them. A person who authenticates but is
  not yet in the database gets a 401 — see
  [known-limitations.md](known-limitations.md).
- **No multi-tenancy.** One installation serves one organisation.
- **Spanish-only interface.** Both frontends are in Spanish, with no i18n layer yet.
