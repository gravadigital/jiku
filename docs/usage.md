# Usage

How the product is used day to day. For what it contains, see [features.md](features.md);
for the HTTP surface, [api-reference.md](api-reference.md).

> This document is thinner than the rest. It describes the flows the code supports; it does
> not yet have screenshots or a walkthrough of every screen.

## Before anyone can log in

Jiku does not create users. A person authenticates against the identity provider, and the
API then looks their identity up in the `users` table. **If they are not there, every request
returns 401 `user_not_found`.**

So the first step in a new installation is getting the team into that table, which today
means inserting them directly. This is the sharpest rough edge in day-to-day operation and it
is tracked in [known-limitations.md](known-limitations.md).

Roles come from the token, not from Jiku: `admin`, `user` or `external-user`, assigned in
the identity provider.

## The internal frontend

### Setting up work

1. **Create an actor** — the organisation the work is for. Optionally add its members.
2. **Create a project** for that actor. Assign the team, and fill in the properties you use
   (links to documentation, design, a task board).
3. Projects move through `analisis` → `activo` → `inactivo` / `finalizado` / `cancelado`, and
   accumulate status updates over time.

### Requirements

A requirement is what a client asks for. Create it against a project, give it a type
(feature, improvement, incident, other) and a priority, and assign responsible people.

It then moves along `analisis` → `planificacion` → `en_cola` → `desarrollo` → `revision` →
`resuelto`. The transition is free — nothing forces the order — so the state reflects what
the team says it is.

Along the way:

- **Comments** are internal or client-visible. Only client-visible ones reach the portal.
- **Subscribers** are people following the requirement.
- **Attachments** can be added to the requirement or to individual comments, and referenced
  inline in text so they render in place.
- **Resolving** is a separate operation from editing: it records a resolution type and a
  conclusion.

### Tasks

Tasks are the concrete work, optionally linked to a requirement. Same shape: responsible
people, priority, estimated finish date, comments, activity history.

The task list can be grouped by project or by responsible person.

### Logging hours

Worked time goes against a task or a requirement. Three rules the API enforces, worth knowing
because they produce errors that look like bugs otherwise:

- You log **your own** hours.
- Only for **the current day and the ten days before it**.
- Worked and unworked time share a **daily limit**; absences count toward it.

Absences are logged as unworked time with a reason.

**Time allocation** is separate: it assigns expected weekly hours per person and project,
which is what the reports compare against.

### Reports

Hours aggregate by person, by project and by requirement, filterable by period and project
type. The requirements report exports to CSV.

## The client portal

A client user (`external-user`) sees only the projects they were explicitly granted, through
`user_project_permission`.

They can:

- Browse their projects and the requirements in them.
- **Create a requirement** — this is the main point of the portal.
- Comment, and see only client-visible comments.
- Subscribe to a requirement to follow it.
- Download attachments whose visibility allows it.

They cannot see hours, internal comments, other clients' projects, or anything in the
internal frontend.

## Operating the bus

Writes go through NATS, so when a mutation fails there is one more place to look.

```sh
cd deploy
./bus-inspect.sh status    # connections and counters
./bus-inspect.sh logs      # commands core processed
./bus-inspect.sh tail      # live
```

`logs` and `tail` need `LOG_COMMANDS=true` on core, which is off by default because payloads
carry business data:

```
[cmd] clients.new <- {"name":"Example"}
[cmd] clients.new -> {"status":"success","data":{"id":10}}
```

If a write returns 503, the API could not reach the bus. If it times out, core did not answer
within `NATS_REQUEST_TIMEOUT_MS` — and because there is no JetStream, **that command may have
been applied anyway**. See [known-limitations.md](known-limitations.md).
