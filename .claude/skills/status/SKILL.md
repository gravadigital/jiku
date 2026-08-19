---
name: status
description: Show project or service status - pending requests, active stories, and suggested next actions
allowed-tools: "Read, Glob, Grep"
---

# Status

## Purpose

Show a focused status dashboard highlighting pending and active work items with suggested next actions. Automatically detects whether it's running in a product repo or a service repo.

**Flow:**

```
Step 0: Detect context (product or service)
  |
Step 1: Read relevant files
  |
Step 2: Present status dashboard
```

**Result:** Clear view of what needs attention and what to do next.

**This command does NOT:**

- Modify any files
- Create or update documentation
- Execute other commands

## CRITICAL RULES

1. **Use Spanish** for all output
2. **Focus on pending/active items** - Show details for items that need action, summarize completed items with counts only
3. **Always suggest next action** - Every pending/active item must have a `->` with the specific command to run
4. **Read-only** - This command only reads files, never modifies anything
5. **Be fast** - Read only what's needed (frontmatter and status fields, not full content)

## Execution

### Step 0: Detect Context

Determine the context following the **Configuration Resolution Convention** in `rules/skill.md` —
**check the monorepo signal first:**

1. **`docs/prd/` exists at the repo root → monorepo.** Ignore any `local-config.yaml` (in a monorepo it
   is unused/stale). There is no single "current service".
2. **No `docs/prd/` but `.claude/local-config.yaml` exists → multirepo.** Read its service name and paths.
3. **No `docs/prd/` and no `local-config.yaml`, but `docs/discovery/` exists → discovery done, product not
   initialized yet.** ABORT suggesting `/product-initialize` (it will transcribe the discovery).
4. **Neither → ABORT** suggesting `/product-discovery-functional` (optional) or `/product-initialize`, or `/service-setup-repo`.

Determine what to show:
   - **Monorepo:** product status + status of **all services** found under `docs/architectures/*/`. For
     each service, match its story-plans (`S-*.{service}.*.md`) and the "Servicios Afectados" rows.
   - **Multirepo:** service status only (read stories from the product repo path in `local-config.yaml`).

### Step 1: Read Relevant Files

#### For Product Status:

1. **Requests** - Glob `docs/requests/REQ-*.md`
   - For each file, read only the frontmatter to extract: `id`, `title`, `status`
   - Group by status: `captured`, `designed`, `formalized`

2. **Stories** - Glob `docs/stories/S-*.md`
   - For each file, read frontmatter to extract: `id`, `title`, `status`
   - For stories with status `Ready` or `In Progress`, also read the "Servicios Afectados" table to get per-service status
   - Group by status: `Ready`, `In Progress`, `Completed`

#### For Service Status:

1. **Identify stories assigned to this service** - From the stories read above (or from product repo if multirepo), filter stories where this service appears in the "Servicios Afectados" table

2. **Story Plans** - Glob `docs/story-plans/S-*.md`
   - Plan filenames are service-scoped: `S-{number}.{service}.{title-short}.md`. A multi-service story
     has one plan per service, so parse both the story ID and the service from each filename.
   - For each plan, read the task statuses to determine progress (e.g., "3/5 tareas")
   - Match plans to `(story, service)` so the dashboard shows, per story, which affected services have a
     plan and which don't (a story isn't fully planned until every affected service has its plan)

### Step 2: Present Status Dashboard

#### Product Status Format:

```
Estado del Producto: {{product_name from goals-and-context.md title, or folder name}}

== REQUESTS PENDIENTES ==

{{For each request with status "captured", sorted by id:}}
REQ-{{number}}: "{{title}}" [captured]
  -> /product-design-request REQ-{{number}}

{{For each request with status "designed", sorted by id:}}
REQ-{{number}}: "{{title}}" [designed]
  -> /product-create-stories REQ-{{number}}

{{If no pending requests:}}
No hay requests pendientes.

== STORIES ACTIVAS ==

{{For each story with status "Ready", sorted by id:}}
S-{{number}}: "{{title}}" [Ready]
  {{For each service in "Servicios Afectados" table:}}
  - {{service_name}}: {{status from Estado column}}
  {{end}}
  -> /service-planify-story S-{{number}} (en el repo del servicio)

{{For each story with status "In Progress", sorted by id:}}
S-{{number}}: "{{title}}" [In Progress]
  {{For each service in "Servicios Afectados" table:}}
  - {{service_name}}: {{status from Estado column}}{{if plan exists and status is not Done}} ({{completed_tasks}}/{{total_tasks}} tareas){{end}}
  {{end}}
  {{Determine next action based on per-service status:}}
  {{If a service has no plan:}}
  -> /service-planify-story S-{{number}} (en {{service_name}})
  {{Else if a service has plan with pending tasks:}}
  -> /service-implement-story S-{{number}} (en {{service_name}})
  {{end}}

{{If no active stories:}}
No hay stories activas.

== COMPLETADO ==

Requests formalizadas: {{count}}
Stories completadas: {{count}}
```

#### Service Status Format:

```
Estado del Servicio: {{service_name}}

== STORIES ASIGNADAS PENDIENTES ==

{{For each story assigned to this service where service status is not "Done", sorted by id:}}
S-{{number}}: "{{title}}" [{{story_status}}{{if plan exists}} - plan creado{{if in_progress}}, {{completed_tasks}}/{{total_tasks}} tareas{{end}}{{else}} - sin plan{{end}}]
  {{Determine next action:}}
  {{If no plan exists:}}
  -> /service-planify-story S-{{number}}
  {{Else if plan exists with pending tasks:}}
  -> /service-implement-story S-{{number}}
  {{end}}

{{If no pending stories:}}
No hay stories pendientes para este servicio.

== COMPLETADO ==

Stories completadas en este servicio: {{count}}
```

#### Monorepo Format:

Show both sections: product status first, then service status separated by a line.

```
{{Product Status (full format from above)}}

---

{{Service Status (full format from above)}}
```

## Output

Text output only. No files created or modified.
