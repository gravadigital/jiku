# Migrations System

This directory contains migration scripts that automatically update project structure when updating Grava Workflow versions.

## How It Works

When you run `/update-tools`, the system:

1. Reads `.claude/.grava-version` (or detects the version from the repo structure and creates the file)
2. Compares with the target — the `.claude/VERSION` shipped by the new copy
3. Executes, in order, every migration whose target falls inside that range
4. Writes the target into `.claude/.grava-version`

The gate is `PROJECT_VERSION < MIGRATION_TARGET <= WORKFLOW_TARGET`, so a migration runs exactly once
per project.

**Reachability rule.** `WORKFLOW_TARGET` is `.claude/VERSION`, so a migration declaring a target
**above** it is unreachable: it never runs and nothing warns. That is a legitimate state for a change
still under test — it stays dormant until a release reaches it — but it has to be deliberate, and the
release process has a step for checking it.

## Migration Types

| Type | Extension | When | How it runs |
|------|-----------|------|-------------|
| **Script** | `.sh` | The change is mechanical: move files, edit YAML, delete folders | `migrate.sh` executes it directly, in order |
| **Agent** | `.md` | The change needs interpretation: infer a layout, derive content, resolve a conflict between two values | `migrate.sh` lists it in `.claude/agent-migrations-pending.md`; the agent executes it during the same `/update-tools` |

The target is declared differently in each: `TARGET_VERSION="X.Y.Z"` in a `.sh`,
`target_version: "X.Y.Z"` in the frontmatter of a `.md`.

Pick agent over script whenever a script would have to **guess**. A `.sh` that invents a value
produces documentation nobody can tell apart from a real decision.

## Migration Files

- `001-consolidate-tasks.sh` - Migrates from v1.5.0 → v1.6.0 (task structure change)
- `002-add-story-plans-path.sh` - Migrates from v1.8.0 → v1.9.0 (adds story_plans to local-config.yaml)
- `003-migrate-epics-to-files.sh` - Migrates from v1.10.0 → v1.11.0 (migrates epics from epic-list.md to individual files in docs/epics/)
- `004-remove-epics.sh` - Migrates to v3.0.0 (removes the epic concept; renames epic-candidates.md to feature-groups.md, leaves existing E-XXX.S-XX stories as-is)
- `005-add-monorepo-support.sh` - Migrates to v4.0.0 (adds the `mode` field and `product_flows` path to local-config.yaml; creates docs/flows/ in a product repo)
- `006-infer-domain-entities.md` - Migrates to v4.1.0 (**agent migration**: infers the `## Domain Entities` section of docs/prd/requirements.md from the existing technical documentation)
- `007-add-references-support.sh` - Migrates to v5.2.0 (creates docs/references/ with an empty index.md and adds `product_references` to local-config.yaml)
- `008-notify-architecture-migration.md` - Migrates to v6.0.0 (**agent migration**: detects services still on the legacy multi-section architecture format and tells the user to run `/product-migrate-architecture`)
- `009-remove-monorepo-local-config.sh` - Migrates to v6.1.0 (deletes local-config.yaml in monorepo — the file is no longer used there; monorepo is auto-detected from docs/prd/)
- `010-consolidate-screen-template.sh` - Migrates to v6.2.0 (removes the stale screen-mid-tmpl.yaml; the two screen templates were consolidated into screen-tmpl.yaml)
- `011-add-viewports-to-ux.md` - Migrates to v6.2.0 (**agent migration**: declares viewports per surface and generates the desktop layout of every existing screen, with a per-surface review gate — a bash script cannot infer layouts)
- `012-wireframes-html.md` - Migrates to v6.2.0 (**agent migration**: regenerates wireframes as a self-contained HTML book and retires `.excalidraw` — deriving `screens.json` from the specs is interpretation, and the render surfaces spec bugs that need a human decision)
- `013-agents-to-specs.sh` - Migrates to v8.0.0 (removes the persona agent files; their specification content now lives in `.claude/specs/`, only `ux-researcher` survives as a real subagent, and QA review becomes the forked skill `/service-qa-review`)

## Agent Migration Format (`.md`)

```markdown
---
target_version: "6.2.0"
requires: "docs/ux/"            # optional: path that must exist for the migration to apply
description: "One line, in Spanish — this is what the pending list shows the user"
---

# Migration NNN: Title

## Purpose            # what changed and why a script cannot do it
## Execution          # numbered steps; step 0 is the idempotency check ("already applied → stop")
```

Any further `##` section is a **template** the steps fill in (the proposal table a gate shows the
user, the final report). Keep them out of `## Execution` so the steps stay readable.

An agent migration is a **prompt**, so it has to be explicit about the same things a script is:
how to detect it already ran, what to do per file, and where to stop and ask. If it rewrites product
or UX documentation, batch a review gate — do not apply screen-by-screen edits silently.

`migrate.sh` collects them into `.claude/agent-migrations-pending.md` **accumulatively**: entries the
agent has not executed yet survive a later run. `/update-tools` deletes that file only after running
all of them.

## Migration Script Format (`.sh`)

Each migration script must:

```bash
#!/bin/bash
# Migration: 001-consolidate-tasks
# From version: 1.5.0
# To version: 1.6.0
# Description: Consolidates task files from docs/tasks/{story_id}/ to docs/story-plans/{story}.md

TARGET_VERSION="1.6.0"

# Your migration logic here...
```

### Required Variables

- `TARGET_VERSION` - The version this migration targets

### Execution Model

`migrate.sh` runs each `.sh` migration in an **isolated child process** (`bash "$migration_file"`), never with `source`. Consequences to keep in mind when writing one:

- The script **must call its own `main`** (or otherwise do its work) at the end — nothing else will invoke it.
- It gets **no** variables or functions from the orchestrator: define your own `log_*` helpers, colors and paths.
- Variables it defines (`TARGET_VERSION` included) **cannot** leak into the orchestrator. This isolation is what keeps a chain of several migrations running; do not switch it back to `source`.
- Exit non-zero to signal failure — the orchestrator aborts the whole chain on a failed migration.

### Best Practices

- Make migrations **idempotent** (can run multiple times safely)
- Check if migration is needed before executing
- Provide clear console output about what's happening
- Handle edge cases gracefully
- Migrate data completely before removing old structure
- Assume users have git/backups (this is a development tool)

## Version Detection

When a project doesn't have `.grava-version`:

- If it has `docs/story-plans/` → Assumes v1.6.0+ (new project)
- If it has `docs/tasks/` → Assumes v1.5.0 (legacy, needs migration)
- Otherwise → Creates `.grava-version` with current version

## Manual Migration

If you need to run migrations manually:

```bash
bash .claude/scripts/migrate.sh
```

This will:
1. Detect or create `.grava-version`
2. Execute pending migrations
3. Update `.grava-version` to current version

## Troubleshooting

- **Migration failed**: Check the migration script output, fix the issue, and re-run
- **Want to skip a migration**: Not recommended, but you can manually update `.grava-version`
- **Need to re-run a migration**: Temporarily lower the version in `.grava-version` and run `/update-tools`
